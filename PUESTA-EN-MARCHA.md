# Gestión Biomédica — PWA offline + API Laravel

Guía para dejar funcionando la sincronización IndexedDB → Laravel → PostgreSQL
y el registro masivo desde Excel.

---

## 1. Crear el proyecto Laravel

En la carpeta del proyecto (`Desktop\gestión-biomédica`):

```bash
composer create-project laravel/laravel backend
cd backend
composer require phpoffice/phpspreadsheet
```

Luego **copie encima** los archivos que le entregué. Quedan así:

```
backend/
├── app/
│   ├── Http/Controllers/Api/
│   │   ├── SyncController.php          ← puente con IndexedDB
│   │   ├── ImportacionController.php   ← registro masivo (Excel)
│   │   ├── MantenimientoController.php
│   │   └── DispositivoController.php
│   ├── Models/
│   │   ├── Dispositivo.php
│   │   └── Mantenimiento.php
│   └── Services/
│       └── RegistroSyncService.php     ← único punto de mapeo de campos
├── bootstrap/app.php                   ← registra routes/api.php
├── config/cors.php
├── database/migrations/
│   ├── ..._create_dispositivos_table.php
│   └── ..._create_mantenimientos_table.php
├── routes/api.php
└── .env.ejemplo
```

## 2. Configurar PostgreSQL

Copie `.env.ejemplo` sobre el `.env` del backend (o pegue el bloque de base de
datos) y genere la llave:

```bash
php artisan key:generate
```

Cree la base si no existe:

```sql
CREATE DATABASE "Bioregistros";
```

Verifique que PHP tenga la extensión de Postgres activa —en `php.ini`:

```ini
extension=pdo_pgsql
extension=pgsql
```

Y corra las migraciones:

```bash
php artisan migrate
php artisan serve          # queda en http://127.0.0.1:8000
```

## 3. Levantar la PWA

En la raíz del proyecto:

```bash
npm install
npm run dev                # http://localhost:3000
```

El `vite.config.ts` ya reenvía todo lo que empiece por `/api` al puerto 8000,
así que en desarrollo no hay problemas de CORS.

Para probar desde un celular en la red de la clínica:

```bash
php artisan serve --host=0.0.0.0
```

y en el `.env` del front: `VITE_API_URL=http://192.168.X.X:8000/api`

---

## 4. Cómo funciona la sincronización

**El principio:** nada se borra del celular hasta que PostgreSQL confirme que
lo tiene.

```
El técnico guarda un mantenimiento
        │
        ├──→ maintenance_records   (para verlo sin conexión)
        └──→ cola_sincronizacion   (bandeja de salida)   ← una sola transacción
                    │
                    │  syncManager: al guardar, al recuperar red,
                    │  al volver la app al frente, y cada 60 s
                    ▼
          POST /api/sync/mantenimientos   { registros: [...] }
                    │
                    ▼
          Laravel → updateOrCreate por id_mantenimiento
                    │
                    ├── aceptados  → se BORRAN de cola_sincronizacion
                    └── rechazados → se quedan, con el motivo anotado
```

Tres decisiones que vale la pena conocer:

**El id lo genera el celular, no el servidor.** El servidor hace `updateOrCreate`
sobre ese id. Si la red se cae justo después de que el servidor guardó pero antes
de que llegara la respuesta, el celular reenvía el mismo registro y no se
duplica nada.

**Un registro malo no bloquea el lote.** El endpoint responde `207` con las dos
listas separadas: lo bueno se guarda y sale de la cola, lo malo se queda en el
celular con el error visible para que el técnico lo corrija.

**Se comprueba el servidor, no solo el wifi.** `navigator.onLine` dice que hay
red, no que el backend responda —cosa frecuente en el wifi de un hospital. Por
eso antes de cada envío se hace un `ping` corto a `/api/sync/ping`.

Los reintentos son escalonados: 0 s, 30 s, 2 min, 10 min, 30 min. Después de 8
intentos el registro queda marcado para revisión manual en vez de seguir
golpeando el servidor.

### ¿Y si quiere que el registro desaparezca del celular al subirse?

Por defecto el registro se queda en el historial local marcado como `synced`,
para que el técnico pueda consultarlo sin conexión. Si prefiere que se borre
del todo y que la app dependa solo de PostgreSQL:

```js
await dbManager.guardarPreferencia('borrarTrasSincronizar', true);
```

De la **cola** siempre se borra al confirmarse; esa preferencia solo decide qué
pasa con la copia de consulta.

---

## 5. Registro masivo desde Excel

Quedaron dos caminos, con el **mismo formato de archivo**:

| Camino | Dónde | Cuándo sirve |
|---|---|---|
| En la PWA | Botón *Registro masivo desde Excel*, en Registrar y en Documentos | Funciona sin conexión: las filas entran a la cola y suben después |
| En el servidor | `POST /api/importar/excel` | Cargas grandes desde el escritorio, con PostgreSQL a la mano |

La plantilla se descarga desde el mismo modal, o desde
`GET /api/importar/plantilla`.

**Del archivo:** la primera fila son los encabezados; se reconocen sin importar
mayúsculas, tildes ni el orden de las columnas. Solo **Equipo** y **Fecha** son
obligatorias.

Las fechas se aceptan como `AAAA-MM-DD`, `DD/MM/AAAA` o como fecha nativa de
Excel. Los estados y tipos se interpretan con tolerancia: *"mtto preventivo"*,
*"PREVENTIVO"* y *"prev."* caen todos en `Preventivo`.

Antes de guardar nada, el modal muestra cuántas filas están bien, cuáles tienen
error y por qué —fila por fila, con el número de fila del Excel para que sea
fácil corregirlo.

> El mapa de columnas está duplicado a propósito en dos lugares:
> `ImportacionController::COLUMNAS` (PHP) y `COLUMNAS` en
> `src/utils/excelImport.ts`. Si agrega una columna nueva, cámbiela en ambos.

---

## 6. Endpoints disponibles

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/api/sync/ping` | ¿Hay servidor de verdad? |
| POST | `/api/sync/mantenimientos` | Subir el lote pendiente de IndexedDB |
| GET | `/api/sync/estado` | Cuántos registros hay en el servidor |
| GET | `/api/sync/descargar?desde=` | Bajar registros (celular nuevo) |
| POST | `/api/importar/excel` | Registro masivo (`simular=1` solo valida) |
| GET | `/api/importar/plantilla` | Plantilla .xlsx |
| GET | `/api/mantenimientos` | Listado con filtros y paginación |
| GET | `/api/mantenimientos/estadisticas?anio=` | Totales por tipo, estado y mes |
| GET | `/api/dispositivos` | Inventario |
| GET | `/api/dispositivos/{serie}` | Hoja de vida del equipo |
| GET | `/api/dispositivos/proximos` | Preventivos vencidos o por vencer |

---

## 7. Sobre el diagrama de la base de datos

Se respetó la estructura que envió —`Dispositivo` con `Serie` como llave
primaria, `Mantenimiento` con `id_equipo` como llave foránea— y se agregaron
las columnas que la PWA ya venía capturando y que se habrían perdido al
sincronizar: fecha, hora, ubicación específica, técnico y tarjeta profesional,
más tres columnas de trazabilidad (`origen`, `creado_en_dispositivo`,
`sincronizado_en`) que permiten saber si un registro llegó desde el celular,
desde un Excel o desde el escritorio.

`Repuestos` estaba como `SET` en el diagrama. En PostgreSQL no existe ese tipo
(es de MySQL), así que quedó como texto con los repuestos separados por coma. Si
más adelante necesita consultar por repuesto individual, lo natural sería una
tabla `mantenimiento_repuestos`.

---

## 8. Seguridad — pendiente

La API quedó **abierta**, como acordamos, para arrancar en la red interna.
Cuando quiera cerrarla:

```bash
php artisan install:api          # instala Sanctum
```

y en `routes/api.php` envuelva las rutas:

```php
Route::middleware('auth:sanctum')->group(function () {
    // ...las rutas actuales
});
```

El `LoginScreen.tsx` de la PWA hoy no valida contra el servidor; habría que
apuntarlo a un endpoint de login y guardar el token para reusarlo al
sincronizar. Mientras tanto, no exponga el puerto 8000 fuera de la red de la
clínica.
