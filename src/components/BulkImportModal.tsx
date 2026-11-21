/**
 * Registro masivo desde Excel.
 *
 * Flujo en tres pasos: elegir archivo → revisar lo que se leyó → confirmar.
 * Nunca se guarda nada sin que el usuario vea antes cuántas filas están
 * bien, cuáles tienen error y por qué.
 *
 * Funciona sin conexión: las filas entran a IndexedDB y el syncManager las
 * sube cuando haya red.
 */

import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import { Sheet } from './ui';
import { dbManager } from '../db/indexedDB';
import { syncManager } from '../sync/syncManager';
import { descargarPlantilla, leerExcel, ResultadoLectura } from '../utils/excelImport';
import { etiquetaClases } from '../types';

interface Props {
  onClose: () => void;
  onImportado: () => void;
  tecnicoPorDefecto?: string;
}

type Paso = 'elegir' | 'leyendo' | 'revisar' | 'guardando' | 'listo';

export const BulkImportModal: React.FC<Props> = ({
  onClose,
  onImportado,
  tecnicoPorDefecto,
}) => {
  const [paso, setPaso] = useState<Paso>('elegir');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [lectura, setLectura] = useState<ResultadoLectura | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [omitirErroneas, setOmitirErroneas] = useState(true);
  const [resumenFinal, setResumenFinal] = useState<{ guardados: number; omitidos: number } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  /* -------------------- Lectura -------------------- */

  const procesarArchivo = async (f: File) => {
    setError(null);
    setArchivo(f);
    setPaso('leyendo');

    try {
      // Se comparan los numeros de reporte, no los uuid: es lo que
      // identifica un seguimiento para la clinica.
      const reportesExistentes = await dbManager.reportesExistentes();

      const resultado = await leerExcel(f, {
        reportesExistentes,
        tecnicoPorDefecto,
      });

      if (resultado.totalFilas === 0) {
        throw new Error('No se encontró ninguna fila con datos.');
      }

      setLectura(resultado);
      setPaso('revisar');
    } catch (e: any) {
      setError(e?.message || 'No se pudo leer el archivo.');
      setPaso('elegir');
    }
  };

  const alSoltar = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    const f = e.dataTransfer.files?.[0];
    if (f) procesarArchivo(f);
  };

  /* -------------------- Guardado -------------------- */

  const confirmar = async () => {
    if (!lectura) return;

    const aGuardar = lectura.filas
      .filter((f) => (omitirErroneas ? f.errores.length === 0 : true))
      .map((f) => f.registro);

    if (aGuardar.length === 0) {
      setError('No hay filas válidas para guardar.');
      return;
    }

    setPaso('guardando');

    try {
      await dbManager.agregarRegistrosEnLote(aGuardar);

      setResumenFinal({
        guardados: aGuardar.length,
        omitidos: lectura.totalFilas - aGuardar.length,
      });

      onImportado();

      // Si hay red, se intenta subir de una vez; si no, quedan en la cola.
      syncManager.sincronizar('importacion-masiva').catch(() => {});

      setPaso('listo');
    } catch (e: any) {
      setError(e?.message || 'No se pudieron guardar los registros.');
      setPaso('revisar');
    }
  };

  /* -------------------- Interfaz -------------------- */

  const pie = (
    <>
      {paso === 'revisar' && (
        <>
          <button
            onClick={() => { setPaso('elegir'); setLectura(null); setArchivo(null); }}
            className="btn btn-ghost flex-1 sm:flex-none"
          >
            Cambiar archivo
          </button>
          <button
            onClick={confirmar}
            disabled={lectura!.validas === 0 && omitirErroneas}
            className="btn btn-primary flex-1"
          >
            Importar <span className="tabular-nums">{omitirErroneas ? lectura!.validas : lectura!.totalFilas}</span> registro(s)
          </button>
        </>
      )}
      {paso === 'listo' && (
        <button onClick={onClose} className="btn btn-primary flex-1">Terminar</button>
      )}
      {(paso === 'elegir' || paso === 'leyendo') && (
        <button onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
      )}
    </>
  );

  return (
    <Sheet
      titulo="Registro masivo"
      subtitulo="Cargar mantenimientos desde Excel"
      icono={<FileSpreadsheet className="size-5" />}
      onClose={onClose}
      ancho="xl"
      pie={paso === 'guardando' ? undefined : pie}
    >


          {error && (
            <div className="notice notice-error mb-4" role="alert">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* --- Paso 1: elegir archivo --- */}
          {paso === 'elegir' && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={alSoltar}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                className={`cursor-pointer rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  arrastrando ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
                }`}
              >
                <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-slate-900 text-white">
                  <Upload className="size-5" />
                </span>
                <p className="text-[15px] font-bold text-slate-900">
                  Arrastre el archivo aquí o toque para buscarlo
                </p>
                <p className="mt-1 text-[13px] text-slate-500">
                  Formatos aceptados: .xlsx, .xls y .csv
                </p>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) procesarArchivo(f);
                  e.target.value = '';
                }}
              />

              <button
                onClick={descargarPlantilla}
                className="btn btn-ghost mt-4 w-full whitespace-normal"
              >
                <Download className="size-4 shrink-0" />
                Descargar plantilla con el formato correcto
              </button>

              <div className="mt-6 text-[13px] leading-relaxed text-slate-600">
                <p className="mb-1 text-sm font-bold text-slate-900">Cómo debe venir el archivo</p>
                <p>
                  Sirve el seguimiento tal como lo llevan: FECHA, REPORTE, EQUIPO,
                  MARCA, MODELO, SERIE, SERVICIO, UBICACIÓN, INVENTARIO, PREVENTIVO,
                  CORRECTIVO, OTRO, DESCRIPCIÓN, OBSERVACIONES, ESTADO y REPUESTOS.
                  Se reconocen sin importar mayúsculas, tildes ni el orden, y no
                  importa si arriba del encabezado hay un título como “INFORME DE
                  GESTIÓN”: la fila de títulos se busca sola. Solo{' '}
                  <strong>EQUIPO</strong> es obligatorio; una fila sin fecha toma la
                  de la fila de arriba. Las columnas REGISTRO y CLASE se ignoran
                  porque vienen vacías.
                </p>
              </div>
            </>
          )}

          {/* --- Leyendo --- */}
          {paso === 'leyendo' && (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto mb-3 size-8 animate-spin text-blue-700" />
              <p className="text-sm text-slate-600">Leyendo {archivo?.name}…</p>
            </div>
          )}

          {/* --- Paso 2: revisar --- */}
          {paso === 'revisar' && lectura && (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2.5">
                <Tarjeta valor={lectura.totalFilas} etiqueta="Filas leídas" tono="slate" />
                <Tarjeta valor={lectura.validas} etiqueta="Listas" tono="green" />
                <Tarjeta valor={lectura.conError} etiqueta="Con error" tono="red" />
              </div>

              <p className="mb-3 text-[13px] text-slate-500">
                Hoja <strong>{lectura.hojaLeida}</strong> · encabezado en la fila{' '}
                <strong>{lectura.filaEncabezado}</strong> ·{' '}
                {lectura.columnasDetectadas.length} columnas reconocidas
                {lectura.columnasIgnoradas.length > 0 && (
                  <> · ignoradas: {lectura.columnasIgnoradas.join(', ')}</>
                )}
              </p>

              {/* Lo que el lector tuvo que deducir. Se muestra aparte
                  porque es lo que conviene revisar de un vistazo antes de
                  darle importar. */}
              {(lectura.columnasPorPosicion.length > 0 || lectura.fechasHeredadas > 0) && (
                <div className="notice notice-info mb-3 flex-col gap-1 text-[13px]">
                  {lectura.columnasPorPosicion.length > 0 && (
                    <p>
                      Columnas sin título reconocidas por su posición:{' '}
                      {lectura.columnasPorPosicion
                        .map((c) => `${c.columna} → ${c.campo}`)
                        .join(', ')}
                      .
                    </p>
                  )}
                  {lectura.fechasHeredadas > 0 && (
                    <p>
                      {lectura.fechasHeredadas} fila(s) venían sin fecha y tomaron la
                      de la fila de arriba, como en el seguimiento en papel.
                    </p>
                  )}
                </div>
              )}

              {lectura.reporteMin && lectura.reporteMax && (
                <div className="mb-3 rounded-2xl bg-slate-100 p-4 text-[13px] text-slate-700">
                  Reportes del archivo:{' '}
                  <strong>{lectura.reporteMin} – {lectura.reporteMax}</strong>
                  {lectura.reportesFaltantes.length > 0 && (
                    <span className="block mt-1 text-amber-800">
                      Faltan {lectura.reportesFaltantes.length} número(s) dentro de
                      ese rango: {lectura.reportesFaltantes.slice(0, 12).join(', ')}
                      {lectura.reportesFaltantes.length > 12 && '…'}
                      <span className="block text-slate-500 mt-0.5">
                        Se importan tal cual vienen. Si quiere cerrar los huecos,
                        hágalo después desde el servidor.
                      </span>
                    </span>
                  )}
                </div>
              )}

              {lectura.anulados.length > 0 && (
                <div className="mb-3 rounded-2xl bg-slate-100 p-4 text-[13px] text-slate-700">
                  {lectura.anulados.length} fila(s) dicen <strong>ANULADO</strong> y no se importan
                  {lectura.anulados.some((a) => a.numeroReporte) && (
                    <>
                      {' '}(reporte{lectura.anulados.length > 1 ? 's' : ''}{' '}
                      <span className="tabular-nums">
                        {lectura.anulados.map((a) => a.numeroReporte ?? `fila ${a.fila}`).join(', ')}
                      </span>
                      )
                    </>
                  )}
                  .
                </div>
              )}

              {lectura.duplicadas > 0 && (
                <div className="notice notice-warn mb-3 text-[13px]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {lectura.duplicadas} fila(s) traen un número de reporte que ya
                    existe. Las repetidas dentro del archivo se rechazan; las que ya
                    están en la base se <strong>actualizan</strong>.
                  </span>
                </div>
              )}

              {/* Tabla de vista previa */}
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="max-h-72 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr className="text-left text-xs text-slate-600">
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Fila</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Reporte</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Equipo</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Fecha</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Clase</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Estado</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Observación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lectura.filas.slice(0, 200).map((f) => (
                        <tr
                          key={f.fila}
                          className={f.errores.length ? 'bg-rose-50' : undefined}
                        >
                          <td className="px-3 py-2 text-slate-500 tabular-nums">{f.fila}</td>
                          <td className="px-3 py-2 font-bold text-slate-700 tabular-nums">
                            {f.registro.numeroReporte ?? '—'}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {f.registro.equipment || '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {f.registro.date || '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {etiquetaClases(f.registro)}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {f.registro.finalStatus || '—'}
                          </td>
                          <td className="px-3 py-2">
                            {f.errores.length > 0 ? (
                              <span className="text-rose-700">{f.errores.join(' · ')}</span>
                            ) : f.advertencias.length > 0 ? (
                              <span className="text-amber-700">
                                {f.advertencias.join(' · ')}
                              </span>
                            ) : (
                              <span className="font-bold text-emerald-700">Correcta</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {lectura.filas.length > 200 && (
                  <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Se muestran las primeras 200 filas de {lectura.filas.length}.
                    Al confirmar se procesan todas.
                  </p>
                )}
              </div>

              {lectura.conError > 0 && (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={omitirErroneas}
                    onChange={(e) => setOmitirErroneas(e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 accent-slate-900"
                  />
                  <span className="text-sm text-slate-700">
                    Omitir las {lectura.conError} filas con error e importar solo las
                    correctas.
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Si lo desmarca, la importación se detendrá hasta que corrija el
                      archivo.
                    </span>
                  </span>
                </label>
              )}
            </>
          )}

          {/* --- Guardando --- */}
          {paso === 'guardando' && (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto mb-3 size-8 animate-spin text-blue-700" />
              <p className="text-sm text-slate-600">Guardando en el dispositivo…</p>
            </div>
          )}

          {/* --- Listo --- */}
          {paso === 'listo' && resumenFinal && (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto mb-4 size-14 text-emerald-700" />
              <p className="text-xl font-medium text-slate-900">
                {resumenFinal.guardados} registro(s) importados
              </p>
              {resumenFinal.omitidos > 0 && (
                <p className="text-sm text-amber-700 mt-1">
                  {resumenFinal.omitidos} fila(s) se omitieron por errores.
                </p>
              )}
              <p className="text-sm text-slate-500 mt-3 max-w-sm mx-auto">
                Quedaron guardados en el dispositivo y en la cola de
                sincronización. Se subirán al servidor automáticamente en cuanto
                haya conexión.
              </p>
            </div>
          )}
    </Sheet>
  );
};

/* ------------------------------------------------------------------ */

const Tarjeta: React.FC<{ valor: number; etiqueta: string; tono: 'slate' | 'green' | 'red' }> = ({
  valor,
  etiqueta,
  tono,
}) => {
  const tonos = {
    slate: 'bg-slate-100 text-slate-900',
    green: 'bg-emerald-50 text-emerald-900',
    red: 'bg-rose-50 text-rose-900',
  };
  return (
    <div className={`rounded-2xl p-3 text-center ${tonos[tono]}`}>
      <p className="text-2xl font-medium tabular-nums">{valor}</p>
      <p className="text-xs font-bold opacity-80">{etiqueta}</p>
    </div>
  );
};
