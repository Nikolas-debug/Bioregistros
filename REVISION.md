# Revisión del proyecto — 23 de agosto de 2026

Estado tras revisar el código completo y la instalación en su equipo.

---

## Lo que quedó bien

Laravel 12.12.2 instalado, `.env` apuntando a PostgreSQL, llave generada y
**las migraciones corrieron**: las tablas `dispositivos` y `mantenimientos`
ya existen en `Bioregistros`. Esa era la parte difícil.

---

## Pendiente suyo — 1 cosa, y es la única que bloquea

### PhpSpreadsheet no se instaló

Revisé `backend/vendor/` y no está la carpeta `phpoffice/`. La causa es que
esa librería exige varias extensiones de PHP —`gd`, `dom`, `simplexml`,
`xml`, `xmlwriter`, `iconv` y `zip`— y si falta **una sola**, Composer se
niega a instalarla.

El script `activar-extensiones-php.bat` ya contempla todas. Entonces:

1. Ejecute `activar-extensiones-php.bat`
2. Cierre las consolas abiertas
3. Ejecute `instalar-backend.bat`

Ese segundo paso ahora **verifica de verdad** que la carpeta quedó creada.
Antes decía "instalado" sin comprobar nada, que es por lo que usted no se
enteró de que había fallado. Ese descuido era mío.

**Qué se pierde mientras tanto:** solo la importación de Excel *del lado del
servidor* (`POST /api/importar/excel`). El registro masivo desde la PWA
funciona igual, porque lee el Excel en el navegador con la librería `xlsx`
de JavaScript. Todo lo demás —sincronización, registros, reportes— no
depende de PhpSpreadsheet.

---

## Lo que corregí en esta revisión

### Un bug que borraba registros en silencio

Los códigos se generaban así:

```js
`#MN-${year}-${Math.floor(1000 + Math.random() * 9000)}`
```

Cuatro dígitos al azar son **9000 combinaciones por año**. Por la paradoja
del cumpleaños, con unos 100 mantenimientos registrados la probabilidad de
que dos códigos coincidan pasa del 40%. Y como IndexedDB guarda con `put`,
el segundo registro **sobreescribía al primero sin avisar**. En PostgreSQL
pasaría lo mismo, porque el código es la llave primaria.

Con varios técnicos trabajando sin conexión el problema empeora: cada
dispositivo sortea números a ciegas, sin saber qué eligieron los demás.

Ahora el código incluye el instante de creación en base 36 más cuatro
caracteres al azar (`MN-2026-K3F9A2QXT7`). Para chocar, dos dispositivos
tendrían que registrar en el mismo milisegundo y además sacar el mismo
sorteo entre 1,6 millones.

De paso quité el `#` del inicio, que no aportaba nada y ensuciaba la llave.

### Los equipos se duplicaban

El identificador del equipo también era aleatorio, así que el mismo
ventilador podía quedar registrado tres veces con tres códigos distintos.
Ahora se deriva del número de serie, que es único de fábrica.

### Nombres quemados en el código

`RegisterTab.tsx` tenía esto:

```js
technicianName: technicianName || 'Luis Machado'
```

Si el nombre venía vacío, el registro quedaba **firmado por otra persona**.
En un equipo biomédico la firma es parte de la trazabilidad, así que eso no
puede pasar. Lo mismo con `'T.P. BIO-88942'` como tarjeta profesional por
defecto en la exportación a Excel.

### Datos de ejemplo (como acordamos)

Se eliminaron los 8 mantenimientos y 5 equipos de demo. La app arranca
vacía. Los dispositivos que ya los tengan sembrados los borran solos al
abrir: la base local pasa a la versión 3 y elimina únicamente esos ids
conocidos, nunca nada que haya escrito un técnico.

El botón de Ajustes que decía *"Restablecer Registros Demo"* ahora dice
**"Borrar todos los datos de este dispositivo"** y hace eso de verdad,
avisando primero cuántos registros quedarían sin subir.

### Pantalla de inicio de sesión

Tenía el correo y la contraseña escritos en el código
(`Biomedica2026!`, visible para cualquiera que abra el archivo) y un botón
de huella dactilar que no verificaba nada.

La reemplacé por una pantalla de identificación honesta: nombre, tarjeta
profesional, institución y cargo. **No pide contraseña a propósito.**
Mientras la API no tenga autenticación, un campo de contraseña que acepta
cualquier cosa es peor que no tenerlo, porque da una sensación de seguridad
que no existe. Los datos quedan guardados en el dispositivo, así que no hay
que escribirlos en cada uso.

### La PWA no se podía instalar

El `manifest.json` pedía `icon-192.png` e `icon-512.png` y **ninguno de los
dos existía**. Sin iconos, Android y iOS no ofrecen "Agregar a pantalla de
inicio" —o sea, la PWA no era instalable, que es justamente lo que la hace
útil para un técnico en ronda.

Creé los iconos, incluido uno *maskable* (el que Android recorta en círculo)
y el `apple-touch-icon` de iOS.

### Credenciales expuestas en el repositorio

El `.gitignore` no ignoraba `.env`. Como la carpeta tiene `.git`, la
contraseña de PostgreSQL se habría subido al repositorio.

Ya está corregido, junto con `backend/vendor/` (miles de archivos que no
deben versionarse). **Si ya hizo algún commit**, el archivo sigue en el
historial y hay que sacarlo:

```bash
git rm --cached .env backend/.env
git commit -m "Sacar credenciales del repositorio"
```

---

## Detalle menor

El `.env` de la raíz todavía tiene estas cinco líneas:

```
DB_HOST="localhost"
DB_PORT="5500"
DB_NAME="Bioregistros"
DB_USER="postgres"
DB_PASSWORD="root"
```

No hacen nada: Vite solo expone al navegador las variables que empiezan por
`VITE_`, y ningún código las lee. Puede borrarlas. Como usted confirmó que
PostgreSQL está en el puerto por defecto, el `5500` de ahí tampoco
corresponde —y el backend, que sí importa, quedó bien en 5432.

---

## Lo que sigue pendiente

### Autenticación

Es lo único serio que falta. La API está abierta: cualquiera en la red puede
leer, crear o borrar mantenimientos sin identificarse. **No exponga el
puerto 8000 fuera de la red de la institución** hasta cerrarla.

Cuando quiera hacerlo: `php artisan install:api` y envolver las rutas en
`Route::middleware('auth:sanctum')`. La pantalla de identificación ya está
lista para pasar a validar contra el servidor.

### Probar la sincronización de punta a punta

Vale la pena hacerlo antes de seguir construyendo, para confirmar que el
circuito completo funciona:

1. `iniciar-backend.bat` y en otra ventana `npm run dev`
2. Registrar un mantenimiento → el indicador debe pasar a "Todo sincronizado"
3. Abrir las herramientas del navegador (F12) → pestaña Red → marcar
   **Sin conexión**
4. Registrar dos mantenimientos más → deben quedar como "2 por subir"
5. Quitar el modo sin conexión → deben subir solos en menos de un minuto
6. Confirmar en pgAdmin: `SELECT * FROM mantenimientos;`

Si el paso 5 no ocurre solo, el botón "Sincronizar" del indicador fuerza el
intento y muestra el error concreto.
