# Despliegue en Railway

Un solo servicio: Laravel sirve la API **y** la PWA desde el mismo dominio.
Sin CORS, sin dos certificados, sin dos despliegues que sincronizar.

```
┌─────────────────────── Railway ────────────────────────┐
│                                                        │
│   Servicio web                     PostgreSQL          │
│   ┌──────────────────┐             ┌──────────────┐    │
│   │ FrankenPHP       │────────────▶│ Bioregistros │    │
│   │  /        → PWA  │  interno    └──────────────┘    │
│   │  /api/*   → API  │                                 │
│   └──────────────────┘                                 │
└────────────────────────────────────────────────────────┘
```

---

## 1. Limpieza previa

Estos archivos ya no aportan. Bórrelos antes de subir el repositorio:

| Archivo o carpeta | Por qué sobra |
|---|---|
| `_archivos-backend/` | Copia temporal de la instalación; su contenido ya está en `backend/` |
| `composer.phar` | En Railway lo pone la imagen de Docker |
| `bun.lock` | El proyecto usa npm, no bun |
| `metadata.json` | Quedó de AI Studio |
| `assets/.aistudio/` | Igual |
| `CONFIGURACION-ENV.txt` | Reemplazado por este documento |
| `backend/.env.respaldo` | Respaldo de una migración ya terminada |
| `bun.lock` | El proyecto usa npm, no bun |

En PowerShell, desde la carpeta del proyecto:

```powershell
Remove-Item -Recurse -Force _archivos-backend, assets\.aistudio -ErrorAction SilentlyContinue
Remove-Item -Force bun.lock, metadata.json, CONFIGURACION-ENV.txt -ErrorAction SilentlyContinue
Remove-Item -Force backend\.env.respaldo -ErrorAction SilentlyContinue
```

Los `.bat` y el `.ps1` **quédeselos**: sirven para levantar el proyecto en
su computador. El `.dockerignore` ya los excluye de la imagen.

### Lo que NO hay que borrar

| Carpeta o archivo | Por qué se queda |
|---|---|
| `backend/vendor/` | Sí, Railway la reconstruye sola — pero es la que hace funcionar `php artisan` **en su computador**. Si la borra, no puede correr migraciones ni crear usuarios en local. Ya está en `.gitignore`, así que no se sube al repositorio de todas formas. |
| `composer.phar` | Es su única forma de reinstalar `vendor/` si no tiene Composer instalado globalmente. Ocupa 3 MB. También está excluido de la imagen. |

> Si ya borró `backend/vendor/` y ahora `php artisan` falla con
> `Failed to open stream` señalando archivos dentro de `vendor/`, la
> reparación está en la sección **Reinstalar `vendor/` en su computador**,
> al final de este documento.

### Dependencias que sobraban

El `package.json` traía `@google/genai`, `express`, `dotenv`, `motion`,
`tsx`, `esbuild` y `@types/express`. Ninguna se usa en el código. Ya salieron.

**Después de reemplazar el `package.json` hay que regenerar el candado**, o
`npm ci` fallará en el despliegue porque el lock no coincide:

```bash
npm install
```

Eso reescribe `package-lock.json`. Confirme que la aplicación sigue
arrancando con `npm run dev` antes de subir nada.

---

## 2. Subir a GitHub

Railway despliega desde un repositorio.

```bash
git add .
git commit -m "Preparar despliegue"
git branch -M main
git remote add origin https://github.com/USUARIO/gestion-biomedica.git
git push -u origin main
```

**Antes del primer push**, verifique que los `.env` no se estén subiendo:

```bash
git status --porcelain | Select-String ".env"
```

No debe aparecer nada. Si aparece, el archivo ya está en el historial:

```bash
git rm --cached .env backend/.env
git commit -m "Sacar credenciales del repositorio"
```

---

## 3. Crear el proyecto en Railway

1. Entre a [railway.app](https://railway.app) y cree una cuenta.
2. **New Project → Deploy from GitHub repo** → elija su repositorio.
3. Railway detecta el `Dockerfile` y empieza a construir. **Va a fallar el
   primer intento**: todavía no hay base de datos ni `APP_KEY`. Es normal.

---

## 4. Agregar PostgreSQL

En el mismo proyecto: **New → Database → Add PostgreSQL**.

Railway lo crea con su propia contraseña y lo conecta por red interna, sin
exponerlo a internet.

---

## 5. Variables de entorno

En el servicio web → pestaña **Variables** → **Raw Editor**, pegue esto:

```
APP_NAME=Gestión Biomédica
APP_ENV=production
APP_DEBUG=false
APP_TIMEZONE=America/Bogota
APP_LOCALE=es
APP_FALLBACK_LOCALE=es

DB_CONNECTION=pgsql
DB_URL=${{Postgres.DATABASE_URL}}

SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
LOG_CHANNEL=stderr
LOG_LEVEL=warning
```

`${{Postgres.DATABASE_URL}}` es una referencia de Railway: apunta sola a la
base de datos del proyecto y se actualiza si cambia la contraseña. Si su
servicio de PostgreSQL tiene otro nombre, cambie `Postgres` por ese nombre.

### La llave de la aplicación — sin esto no arranca

Laravel cifra las cookies y las sesiones con `APP_KEY`. **Si falta, la
aplicación devuelve error 500 en todas las direcciones** y el registro se
llena de:

```
No application encryption key has been specified.
```

No se genera sola en el despliegue. Hay que ponerla a mano.

**Opción A — desde su computador**, si `backend/vendor/` ya está instalado:

```bash
cd backend
php artisan key:generate --show
```

**Opción B — en PowerShell**, sin necesitar PHP ni Composer:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
"base64:" + [Convert]::ToBase64String($bytes)
```

`APP_KEY` no es más que 32 bytes al azar en base64, así que las dos opciones
producen algo igual de válido.

Copie la salida completa —empieza por `base64:`— y agréguela en **Variables**:

```
APP_KEY=base64:loQueSalió...
```

Railway vuelve a desplegar solo al guardar la variable.

> Si `APP_KEY` cambia después, las sesiones abiertas dejan de servir y a Luis
> le tocará entrar de nuevo en el celular. No la regenere sin necesidad, y
> guárdela donde guarda las contraseñas.

---

## 6. Dominio

Servicio web → **Settings → Networking → Generate Domain**.

Queda algo como `gestion-biomedica-production.up.railway.app`. Ese es el
enlace que abre Luis en el celular.

Con dominio propio: **Custom Domain**, y en su proveedor de DNS un registro
`CNAME` apuntando al que Railway le indique.

---

## 7. Crear el usuario de Luis

Las migraciones corren solas en cada despliegue, así que las tablas ya
existen. Falta el usuario.

> **El usuario tiene que quedar en la base de datos de Railway**, que es la
> que consulta la aplicación cuando Luis entra desde el celular. Crearlo en
> su PostgreSQL local no sirve para nada allá.

### Forma recomendada: por variables de entorno

No necesita consola, ni SSH, ni PHP en su computador. En el servicio web →
**Variables**, agregue:

```
USUARIO_INICIAL_EMAIL=luis@biomedica.local
USUARIO_INICIAL_NOMBRE=Luis Machado
USUARIO_INICIAL_CARGO=Ingeniero Biomédico
USUARIO_INICIAL_INSTITUCION=NOMBRE DE LA CLÍNICA
USUARIO_INICIAL_PASSWORD=laQueUstedElija
```

La contraseña debe tener **8 caracteres o más**.

Al guardar, Railway redespliega. En el arranque se ejecuta solo el comando
`usuario:sembrar`, que crea el usuario. En **Deployments → el último → View
Logs** debe aparecer:

```
==> Usuario inicial
  usuario:sembrar — creado luis@biomedica.local.
```

**Cuando confirme que Luis ya entra, borre `USUARIO_INICIAL_PASSWORD`** de
las variables. Las demás pueden quedarse; sin la contraseña el comando no
hace nada y el usuario sigue existiendo igual.

Para **cambiar la contraseña** más adelante: vuelva a poner la variable con
el valor nuevo, espere el redespliegue, y bórrela otra vez. Eso cierra la
sesión abierta en el celular, así que a Luis le tocará entrar de nuevo.

> El comando no toca nada si el usuario ya existe con esos mismos datos.
> Por eso un redespliegue cualquiera no cierra la sesión de nadie.

### Forma alterna: consola en el contenedor

Si prefiere escribir la contraseña sin que quede guardada en ningún lado:

```bash
npm install -g @railway/cli
railway login
railway link                              # elija proyecto Y servicio
ssh-keygen -t ed25519                     # una sola vez, si no tiene llave
railway ssh --service NOMBRE-DEL-SERVICIO
```

Confirme con `pwd` que responde `/app` — si responde una ruta de Windows,
la sesión no se abrió y está en su consola de siempre. Ya adentro:

```bash
php artisan usuario:crear
```

Pregunta los datos uno por uno y la contraseña no se ve al escribir.

### Forma alterna: contra la base por internet

Requiere `backend/vendor/` funcionando en su computador. En Railway,
servicio PostgreSQL → Variables → copie `DATABASE_PUBLIC_URL`:

```powershell
cd backend
$env:DB_URL="postgresql://postgres:...@turntable.proxy.rlwy.net:12345/railway"
php artisan usuario:crear
Remove-Item Env:\DB_URL
```

Esa URL apunta a la misma base que usa Railway, solo que por internet.
Bórrela de su consola al terminar.

---

## 8. Comprobar que quedó bien

```bash
curl https://SU-DOMINIO.up.railway.app/api/sync/ping
```

Debe responder algo como:

```json
{"ok":true,"servidor":"Gestión Biomédica","hora":"2026-08-23T14:30:00-05:00","zona":"America/Bogota"}
```

**Mire la hora**: si termina en `-05:00` y coincide con su reloj, la zona
horaria quedó bien. Si sale en UTC, falta `APP_TIMEZONE` en las variables.

Después, en el navegador:

1. Abra el dominio → debe salir la pantalla de ingreso.
2. Entre con la cuenta de Luis.
3. Registre un mantenimiento → el indicador pasa a "Todo sincronizado".
4. En el celular: **Añadir a pantalla de inicio**. Se instala como
   aplicación, sin barra del navegador.

### Probar el modo sin conexión

Es lo que hay que verificar de verdad antes de dárselo a Luis:

1. Abra la app, entre con su cuenta.
2. Active el modo avión.
3. Registre dos mantenimientos → deben aparecer como "2 por subir".
4. Quite el modo avión → suben solos en menos de un minuto.
5. Compruebe en la app que quedaron con número de reporte.

---

## 9. Cada actualización

```bash
git add .
git commit -m "lo que cambió"
git push
```

Railway reconstruye y despliega solo. Las migraciones nuevas corren en el
arranque. Si algo sale mal: **Deployments → el anterior → Redeploy**.

---

## Reinstalar `vendor/` en su computador

Si `php artisan` falla con mensajes como:

```
Failed to open stream: No such file or directory
  ...\backend\vendor\composer/../nunomaduro/collision/...
  ...\backend\vendor\composer/../symfony/error-handler/...
```

lo que pasa es que la carpeta `vendor/` quedó a medias: el autocargador de
Composer sigue apuntando a paquetes cuyos archivos ya no están. Pasa cuando
un borrado recursivo en Windows se atasca en rutas largas y deja la carpeta
partida por la mitad. **No se repara sobreescribiendo: hay que borrarla
entera y volver a instalar.**

### 1. Borrarla de verdad

`Remove-Item -Recurse` es el que se atasca. Use el de `cmd`, que no tiene ese
problema:

```powershell
cd C:\Users\NRMac\Desktop\gestión-biomédica\backend
cmd /c "rmdir /s /q vendor"
```

Confirme que ya no existe:

```powershell
Test-Path vendor        # debe decir False
```

### 2. Asegurar que hay Composer

```powershell
composer --version
```

Si responde con un número de versión, siga al paso 3. Si dice que no
reconoce el comando, y tampoco tiene el `composer.phar`, recupérelo:

```powershell
cd C:\Users\NRMac\Desktop\gestión-biomédica
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php
Remove-Item composer-setup.php
```

Y de ahí en adelante, donde diga `composer` use `php ..\composer.phar`.

### 3. Instalar

```powershell
cd C:\Users\NRMac\Desktop\gestión-biomédica\backend
composer install
```

Tarda unos minutos la primera vez.

**Si se queja de `ext-gd`** (lo pide `phpoffice/phpspreadsheet`), tiene dos
salidas. La buena es habilitar la extensión: abra el `php.ini` que le indique
el mensaje, busque `;extension=gd`, quítele el punto y coma, guarde y repita
el `composer install`. La rápida, si solo necesita correr comandos de artisan
y no la importación de Excel:

```powershell
composer install --ignore-platform-reqs
```

Con esa bandera la importación masiva de `.xlsx` **no va a funcionar en
local** — en Railway sí, porque la imagen de Docker sí trae `gd`.

### 4. Comprobar

```powershell
php artisan --version
```

Si imprime la versión de Laravel, quedó. Ahí ya corren `php artisan migrate`
y los demás comandos.

---

## Lo que hay que tener presente

**Una sola cuenta.** Iniciar sesión en un dispositivo cierra la sesión del
anterior: hay un token por usuario. Para el mes de prueba con Luis está
bien. Cuando entren más técnicos, el cambio es pasar a Laravel Sanctum, que
maneja varios tokens por persona.

**El plan gratuito de Railway duerme el servicio** tras un rato sin uso, y
la primera petición después tarda unos segundos. Para un piloto no molesta;
para uso diario en la clínica conviene el plan de pago.

**Respaldos.** Railway hace copias de PostgreSQL en los planes de pago. En
el gratuito, la única copia es la que usted haga:

```bash
pg_dump "$DATABASE_PUBLIC_URL" > respaldo_$(date +%F).sql
```

Con datos reales de mantenimientos de la clínica, eso no es opcional.

**Sigue sin haber HTTPS forzado a nivel de aplicación.** Railway sirve todo
por HTTPS, así que en la práctica está cubierto, pero si algún día lo pone
detrás de otro proxy, revíselo.
