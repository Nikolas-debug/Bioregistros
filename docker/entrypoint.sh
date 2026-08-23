#!/bin/sh
# =====================================================================
#  Arranque del contenedor.
#
#  Railway asigna el puerto en la variable PORT, que cambia entre
#  despliegues. FrankenPHP lo lee de SERVER_NAME.
# =====================================================================
set -e

export SERVER_NAME=":${PORT:-8080}"

echo "==> Preparando la aplicación"

# La configuración en caché evita leer y parsear los archivos de config
# en cada petición. Hay que rehacerla en cada despliegue porque las
# variables de entorno de Railway pueden haber cambiado.
php artisan config:clear
php artisan config:cache
php artisan route:cache

echo "==> Migraciones"

# --force porque en producción artisan pide confirmación interactiva y
# aquí no hay nadie para responder.
php artisan migrate --force

echo "==> Escuchando en el puerto ${PORT:-8080}"

exec frankenphp run --config /etc/caddy/Caddyfile
