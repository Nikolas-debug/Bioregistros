# Adaptación al formato de seguimiento

Cambios hechos tras analizar `SEGUIMIENTO MAYO 2026.xlsx` (149 filas).

---

## Pasos para aplicarlo

```bash
cd backend
php artisan config:clear      # sin esto la hora sigue mal
php artisan migrate:fresh     # ¡borra y recrea las tablas!
```

`migrate:fresh` **borra todo lo que haya en `dispositivos` y
`mantenimientos`**. Las tablas cambiaron demasiado para migrarlas campo a
campo. Como todavía no hay datos reales de la clínica, es el camino limpio.

En la PWA no hay que hacer nada: la base local del navegador se actualiza
sola a la versión 4 al abrir.

---

## 1. La hora estaba mal — causa encontrada

Laravel 12 trae `'timezone' => 'UTC'` **escrito directamente** en
`config/app.php`, y **no lee `APP_TIMEZONE` del `.env`**. Por eso, aunque el
`.env` decía `America/Bogota`, `sincronizado_en` guardaba las 16:19:33 en
vez de las 11:19:33.

Ahora esa línea dice:

```php
'timezone' => env('APP_TIMEZONE', 'America/Bogota'),
```

Y las fechas que manda el celular se convierten explícitamente a la zona de
la aplicación antes de guardarse, para que la columna coincida con el reloj
de quien registró.

> Hay que correr `php artisan config:clear`. Si la configuración quedó en
> caché, el cambio no se aplica.

---

## 2. La llave primaria

Las dos tablas usan ahora `id BIGSERIAL` — un entero que se incrementa
solo, sin significado de negocio. Se eliminaron los algoritmos que
generaban códigos de texto.

**En `dispositivos` la serie ya no puede ser la llave primaria**, y esto lo
decidió el archivo real: de 149 filas, **26 no traen número de serie**. Una
llave primaria no admite vacíos. La serie sigue siendo única cuando existe,
mediante un índice parcial de PostgreSQL.

Para no duplicar equipos, se busca primero por serie y, si no hay, por
código de inventario.

**En `mantenimientos` hay además una columna `uuid`**. La genera el celular
y es lo que hace idempotente la sincronización: reenviar el mismo uuid
actualiza en vez de duplicar. Sin ella, un corte de red a mitad de camino
crearía registros repetidos. No es la llave primaria; es una restricción de
unicidad más.

---

## 3. El número de reporte

`numero_reporte` es ahora una columna común y corriente, no la llave
primaria. Puede moverse, que era justo lo que usted necesitaba.

Su restricción de unicidad es **DEFERRABLE**, un detalle que hace posible
todo lo demás: PostgreSQL la verifica al cerrar la transacción y no fila por
fila. Sin eso, un `UPDATE ... SET numero_reporte = numero_reporte + 1`
fallaría a mitad de camino al chocar consigo mismo.

**Un registro normal se va al final** con el siguiente número libre. No se
mueve nada.

**Insertar un reporte olvidado** es una acción aparte y explícita:

```
GET  /api/reportes/previsualizar-insercion?numero=3570
     → { "se_mueven": 348 }        cuántos se correrían

POST /api/reportes/insertar
     { ...datos del reporte, "numero_reporte": 3570 }
     → inserta y corre los posteriores en uno
```

Se consulta primero cuántos se moverían, porque renumerar reportes que quizá
ya se imprimieron o se enviaron no debería pasar por accidente.

### Sobre los huecos

El archivo de mayo tiene huecos: falta el 3595, el 3596 y todo el bloque del
3601 al 3618, entre otros. **La importación los respeta tal como vienen** —
son el registro histórico, y reescribirlos en silencio sería peor que el
hueco.

Cuando quiera cerrarlos, hay una herramienta que primero simula:

```
POST /api/reportes/compactar   { "desde": 1, "simular": true }
     → lista de qué número pasaría a cuál, sin escribir nada

POST /api/reportes/compactar   { "desde": 1, "simular": false }
     → lo aplica
```

Y al borrar un reporte puede cerrar el hueco de una vez:
`DELETE /api/mantenimientos/{id}?cerrar_hueco=1`

---

## 4. Las tres casillas X

En el seguimiento, la clase no es un valor sino **tres casillas
independientes**. El archivo lo confirma: hay una fila marcada como
preventivo *y* correctivo a la vez, y tres filas sin ninguna marca.

Por eso ahora son tres booleanos: `preventivo`, `correctivo`, `otro`. Un
solo campo habría perdido esa información.

El formulario de la app pasó de tres botones excluyentes a tres casillas que
se encienden por separado. Una fila sin ninguna marca queda como *Otro*, que
es mejor que descartarla.

---

## 5. Estado y servicio: texto libre

`ESTADO` viene lleno en el 47% de las filas, y a veces trae el nombre de un
repuesto en vez de un estado (`SENSOR SPO2 CABEL AC`, `DISPLEY`). `SERVICIO`
trae `HOSPITALISACION`, `UCI NEO.`, `TORRE B`, `CKU.635`, `NNS364`.

Una lista cerrada habría rechazado datos reales u obligado al técnico a
escoger algo falso. Ambas columnas son texto libre, y en la app aparecen
como campos con sugerencias que no obligan.

Para contar y filtrar hay una función `grupoEstado()` que agrupa por
significado: `FUNCIONAL`, `funcional` y `Operativo` cuentan igual. Cuando en
esa casilla hay el nombre de un repuesto, se agrupa como *en espera*, que es
lo que en la práctica significa.

---

## 6. Tarjeta profesional: eliminada

Salió de la base de datos, del formulario, del perfil, de la exportación y
de la pantalla de identificación. El seguimiento no la tiene. Se conserva
solo el nombre del técnico.

---

## 7. Columnas que reconoce el importador

Salen del archivo real, incluido el encabezado `  INVENTARIO1532000224` (el
importador le quita los números pegados):

| Columna del Excel | Va a |
|---|---|
| FECHA | `fecha` — obligatoria |
| REPORTE | `numero_reporte` |
| EQUIPO | `equipo` — obligatoria |
| MARCA, MODELO, SERIE | equipo |
| SERVICIO, UBICACIÓN | servicio y ubicación del reporte |
| INVENTARIO | `inventario` |
| PREVENTIVO / CORRECTIVO / OTRO | las tres casillas (X, x, SÍ, 1) |
| DESCRIPCION | `descripcion` |
| OBSERVACIONES | `observaciones` |
| ESTADO | `estado` |
| REPUESTOS | `repuestos` |

**REGISTRO y CLASE se ignoran**: vienen vacías en las 149 filas.

Antes de guardar, el modal muestra el rango de reportes del archivo, cuáles
faltan dentro de ese rango, y fila por fila qué está bien y qué no.

Reimportar el mismo archivo **no duplica**: el uuid se deriva del número de
reporte, así que las filas se actualizan.

---

## 8. Servicio y ubicación se guardan dos veces

Están en `dispositivos` (dónde está el equipo hoy) y en `mantenimientos`
(dónde estaba el día del reporte). No es un descuido: los equipos se
trasladan, y el seguimiento de mayo debe seguir diciendo dónde estaba ese
equipo en mayo, aunque hoy esté en otro piso.

---

## Endpoints nuevos

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/api/reportes/siguiente` | Qué número sigue, y los huecos |
| GET | `/api/reportes/previsualizar-insercion?numero=` | Cuántos se moverían |
| POST | `/api/reportes/insertar` | Insertar un olvidado y correr los demás |
| POST | `/api/reportes/compactar` | Cerrar huecos (con `simular`) |
| DELETE | `/api/mantenimientos/{id}?cerrar_hueco=1` | Borrar cerrando el hueco |

---

## Lo que sigue pendiente

- **PhpSpreadsheet** todavía no está instalado (ver `REVISION.md`). Sin él
  no funciona la importación del servidor; la de la PWA sí.
- **Autenticación.** La API sigue abierta.
- La pantalla para insertar un reporte olvidado **no existe todavía en la
  app**: los endpoints están listos, pero hay que construir el formulario.
  Por ahora se hace desde la API.
