
set -eu

RAIZ=$(cd "$(dirname "$0")" && pwd)
DESTINO="$(dirname "$RAIZ")/Bioregistros-respaldos"
SELLO=$(date +%Y-%m-%d_%H%M)
TRABAJO=$(mktemp -d)
trap 'rm -rf "$TRABAJO"' EXIT

URL="${DB_URL_RESPALDO:-}"
[ -z "$URL" ] && URL=$(security find-generic-password -s bioregistros-railway -w 2>/dev/null || true)
[ -z "$URL" ] && URL=$(grep '^DB_URL=' "$RAIZ/backend/.env" 2>/dev/null | cut -d= -f2- || true)

if [ -z "$URL" ]; then
  echo "No encontré la URL de la base (ni en DB_URL_RESPALDO, ni en el Llavero, ni en backend/.env)." >&2
  exit 1
fi

echo "==> Copiando la base (solo lectura)…"
pg_dump --format=custom --no-owner --no-privileges --dbname="$URL" --file="$TRABAJO/railway.dump"

# Un respaldo que no se puede leer no es respaldo: se comprueba antes de guardarlo.
TABLAS=$(pg_restore --list "$TRABAJO/railway.dump" | grep -c "TABLE DATA")
if [ "$TABLAS" -lt 5 ]; then
  echo "El respaldo salió incompleto ($TABLAS tablas). No se guardó nada." >&2
  exit 1
fi

echo "==> Exportando los mantenimientos a CSV…"
printf '\357\273\277' > "$TRABAJO/mantenimientos_completo.csv"   # BOM: Excel respeta las tildes
psql "$URL" -v ON_ERROR_STOP=1 -q -c "\copy (
  select m.numero_reporte as reporte, m.fecha, m.hora, d.equipo, d.marca, d.modelo,
         d.serie, d.inventario, m.servicio, m.ubicacion,
         case when m.preventivo then 'X' end as preventivo,
         case when m.correctivo then 'X' end as correctivo,
         case when m.otro then 'X' end as otro,
         m.descripcion, m.observaciones, m.estado, m.repuestos, m.tecnico, m.origen, m.uuid
    from mantenimientos m join dispositivos d on d.id = m.dispositivo_id
   where m.deleted_at is null
   order by m.numero_reporte
) to stdout with (format csv, header, delimiter ';')" >> "$TRABAJO/mantenimientos_completo.csv"

REGISTROS=$(($(wc -l < "$TRABAJO/mantenimientos_completo.csv") - 1))
ULTIMO=$(psql "$URL" -tAq -c "select coalesce(max(numero_reporte), 0) from mantenimientos")
URL=""

cat > "$TRABAJO/LEEME.txt" <<EOF
RESPALDO - Gestión Biomédica, Clínica del Niño
Tomado el $(date '+%d/%m/%Y a las %H:%M')
$REGISTROS mantenimientos (último reporte: $ULTIMO)

mantenimientos_completo.csv
    Todos los mantenimientos con su equipo, en el orden de columnas del
    seguimiento. Se abre con Excel (doble clic). Sirve para consultar
    cualquier reporte aunque la aplicación no esté disponible.

railway.dump
    Copia exacta de la base de datos completa. No se abre con Excel: es la
    que se usa para reconstruir el sistema si algo grave pasara en el
    servidor. NO LA BORRE NI LA MODIFIQUE.

Guarde el .zip tal cual. Los respaldos nuevos van al lado de los
anteriores; no hace falta borrar ninguno. Si un día hay que restaurar,
avise: se reconstruye desde railway.dump.
EOF

mkdir -p "$DESTINO"
ARCHIVO="$DESTINO/respaldo_$SELLO.zip"
( cd "$TRABAJO" && zip -q -9 "$ARCHIVO" railway.dump mantenimientos_completo.csv LEEME.txt )

echo "==> Listo: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1), $REGISTROS mantenimientos, último reporte $ULTIMO)"
