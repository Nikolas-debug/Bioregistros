# =====================================================================
#  Gestión Biomédica — imagen para Railway
#
#  Un solo contenedor sirve la PWA y la API desde el mismo dominio.
#  Eso evita CORS, dos certificados y dos servicios que mantener.
#
#  Se construye en tres etapas para que la imagen final no cargue con
#  Node ni con las dependencias de desarrollo de Composer.
# =====================================================================

# ---------------------------------------------------------------------
#  Etapa 1: compilar la PWA
# ---------------------------------------------------------------------
FROM node:20-alpine AS frontend

WORKDIR /build

# Primero solo los manifiestos: mientras no cambien, Docker reutiliza la
# capa de node_modules y el despliegue tarda segundos en vez de minutos.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# En producción la API vive en el mismo dominio, así que /api basta.
ENV VITE_API_URL=/api
RUN npm run build


# ---------------------------------------------------------------------
#  Etapa 2: dependencias de PHP
# ---------------------------------------------------------------------
FROM composer:2 AS vendor

WORKDIR /app
COPY backend/composer.json backend/composer.lock ./

# --no-scripts porque artisan todavía no está aquí; el autoload se genera
# en la etapa final, cuando ya está el código completo.
#
# --ignore-platform-reqs porque la imagen composer:2 es minimalista y no
# trae la extensión gd (la exige phpoffice/phpspreadsheet). Composer solo
# está descargando paquetes aquí, no ejecutando código PHP que la use; la
# extensión sí queda instalada en la etapa 3, que es la que de verdad
# corre la aplicación. Sin esta bandera, "Verifying lock file contents
# can be installed on current platform" falla el build entero.
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-autoloader \
    --prefer-dist \
    --no-interaction \
    --ignore-platform-reqs


# ---------------------------------------------------------------------
#  Etapa 3: imagen final
# ---------------------------------------------------------------------
FROM dunglas/frankenphp:1-php8.3

# pdo_pgsql y pgsql para PostgreSQL.
# zip y gd los exige PhpSpreadsheet (un .xlsx es un zip por dentro).
RUN install-php-extensions \
    pdo_pgsql pgsql \
    zip gd \
    intl opcache

WORKDIR /app

COPY backend/ ./
COPY --from=vendor /app/vendor ./vendor
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# La PWA compilada queda dentro de public/, junto al index.php de Laravel.
COPY --from=frontend /build/dist/ ./public/

RUN composer dump-autoload --optimize --no-dev --no-interaction \
    && mkdir -p storage/framework/{cache,sessions,views} storage/logs \
    && chmod -R ug+w storage bootstrap/cache

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# opcache: sin esto PHP vuelve a compilar cada archivo en cada petición.
RUN { \
      echo 'opcache.enable=1'; \
      echo 'opcache.memory_consumption=128'; \
      echo 'opcache.max_accelerated_files=10000'; \
      echo 'opcache.validate_timestamps=0'; \
    } > /usr/local/etc/php/conf.d/opcache.ini

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
