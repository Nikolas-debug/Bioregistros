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
| `backend/vendor/` | Se instala en el contenedor (y ya está en `.gitignore`) |

En PowerShell, desde la carpeta del proyecto:

```powershell
Remove-Item -Recurse -Force _archivos-backend, assets\.aistudio -ErrorAction SilentlyContinue
Remove-Item -Force composer.phar, bun.lock, metadata.json, CONFIGURACION-ENV.txt -ErrorAction SilentlyContinue
Remove-Item -Force backend\.env.respaldo -ErrorAction SilentlyContinue
```

Los `.bat` y el `.ps1` **quédeselos**: sirven para levantar el proyecto en
su computador. El `.dockerignore` ya los excluye de la imagen.

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

### La llave de la aplicación

Laravel cifra las sesiones con `APP_KEY`. Genérela en su computador:

```bash
cd backend
php artisan key:generate --show
```

Copie la salida completa —empieza por `base64:`— y agréguela como variable:

```
APP_KEY=base64:loQueSalió...
```

> Si `APP_KEY` cambia después, las sesiones abiertas dejan de servir. No la
> regenere sin necesidad.

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

Instale la CLI de Railway:

```bash
npm install -g @railway/cli
railway login
railway link          # elija el proyecto
```

Y entre al contenedor:

```bash
railway ssh
php artisan usuario:crear
```

Le va a preguntar:

```
Correo o usuario de acceso  →  luis@biomedica.local
Nombre completo             →  Luis Machado
Cargo                       →  Ingeniero Biomédico
Institución                 →  (el nombre de la clínica)
Contraseña                  →  (no se ve al escribir)
Escríbala otra vez          →
```

**La contraseña no queda escrita en ningún archivo del proyecto ni en el
historial de la consola.** Si se pierde, se vuelve a correr el mismo
comando y se cambia.

### Si `railway ssh` no está disponible

Use el proxy público de la base de datos desde su computador. En Railway,
servicio PostgreSQL → Variables → copie `DATABASE_PUBLIC_URL`. Entonces:

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
