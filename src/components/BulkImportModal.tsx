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
  X,
} from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Registro masivo</h2>
              <p className="text-xs text-slate-500">Cargar mantenimientos desde Excel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {error && (
            <div className="mb-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
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
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
                  arrastrando
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                }`}
              >
                <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <p className="font-medium text-slate-800">
                  Arrastre el archivo aquí o toque para buscarlo
                </p>
                <p className="text-xs text-slate-500 mt-1">
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
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="w-4 h-4" />
                Descargar plantilla con el formato correcto
              </button>

              <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-800 mb-1">Cómo debe venir el archivo</p>
                <p>
                  La primera fila son los encabezados, tal como están en el
                  seguimiento: FECHA, REPORTE, EQUIPO, MARCA, MODELO, SERIE,
                  SERVICIO, UBICACIÓN, INVENTARIO, PREVENTIVO, CORRECTIVO, OTRO,
                  DESCRIPCIÓN, OBSERVACIONES, ESTADO y REPUESTOS. Se reconocen sin
                  importar mayúsculas, tildes ni el orden. Solo{' '}
                  <strong>EQUIPO</strong> y <strong>FECHA</strong> son obligatorias.
                  Las columnas REGISTRO y CLASE se ignoran porque vienen vacías.
                </p>
              </div>
            </>
          )}

          {/* --- Leyendo --- */}
          {paso === 'leyendo' && (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-3" />
              <p className="text-sm text-slate-600">Leyendo {archivo?.name}…</p>
            </div>
          )}

          {/* --- Paso 2: revisar --- */}
          {paso === 'revisar' && lectura && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Tarjeta valor={lectura.totalFilas} etiqueta="Filas leídas" tono="slate" />
                <Tarjeta valor={lectura.validas} etiqueta="Listas" tono="green" />
                <Tarjeta valor={lectura.conError} etiqueta="Con error" tono="red" />
              </div>

              <p className="text-xs text-slate-500 mb-3">
                Hoja <strong>{lectura.hojaLeida}</strong> ·{' '}
                {lectura.columnasDetectadas.length} columnas reconocidas
                {lectura.columnasIgnoradas.length > 0 && (
                  <> · ignoradas: {lectura.columnasIgnoradas.join(', ')}</>
                )}
              </p>

              {lectura.reporteMin && lectura.reporteMax && (
                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
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

              {lectura.duplicadas > 0 && (
                <div className="mb-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {lectura.duplicadas} fila(s) traen un número de reporte que ya
                    existe. Las repetidas dentro del archivo se rechazan; las que ya
                    están en la base se <strong>actualizan</strong>.
                  </span>
                </div>
              )}

              {/* Tabla de vista previa */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr className="text-left text-slate-600">
                        <th className="px-3 py-2 font-medium">Fila</th>
                        <th className="px-3 py-2 font-medium">Reporte</th>
                        <th className="px-3 py-2 font-medium">Equipo</th>
                        <th className="px-3 py-2 font-medium">Fecha</th>
                        <th className="px-3 py-2 font-medium">Clase</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                        <th className="px-3 py-2 font-medium">Observación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lectura.filas.slice(0, 200).map((f) => (
                        <tr
                          key={f.fila}
                          className={f.errores.length ? 'bg-red-50/60' : undefined}
                        >
                          <td className="px-3 py-2 text-slate-400">{f.fila}</td>
                          <td className="px-3 py-2 font-mono text-slate-700">
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
                              <span className="text-red-700">{f.errores.join(' · ')}</span>
                            ) : f.advertencias.length > 0 ? (
                              <span className="text-amber-700">
                                {f.advertencias.join(' · ')}
                              </span>
                            ) : (
                              <span className="text-green-700">Correcta</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {lectura.filas.length > 200 && (
                  <p className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                    Se muestran las primeras 200 filas de {lectura.filas.length}.
                    Al confirmar se procesan todas.
                  </p>
                )}
              </div>

              {lectura.conError > 0 && (
                <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={omitirErroneas}
                    onChange={(e) => setOmitirErroneas(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-blue-600"
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
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-3" />
              <p className="text-sm text-slate-600">Guardando en el dispositivo…</p>
            </div>
          )}

          {/* --- Listo --- */}
          {paso === 'listo' && resumenFinal && (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-14 h-14 mx-auto text-green-600 mb-4" />
              <p className="text-lg font-semibold text-slate-900">
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
        </div>

        {/* Pie */}
        <div className="border-t border-slate-200 px-5 py-4 flex gap-3 shrink-0">
          {paso === 'revisar' && (
            <>
              <button
                onClick={() => { setPaso('elegir'); setLectura(null); setArchivo(null); }}
                className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cambiar archivo
              </button>
              <button
                onClick={confirmar}
                disabled={lectura!.validas === 0 && omitirErroneas}
                className="flex-1 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-40"
              >
                Importar {omitirErroneas ? lectura!.validas : lectura!.totalFilas} registro(s)
              </button>
            </>
          )}

          {paso === 'listo' && (
            <button
              onClick={onClose}
              className="flex-1 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Terminar
            </button>
          )}

          {(paso === 'elegir' || paso === 'leyendo') && (
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const Tarjeta: React.FC<{ valor: number; etiqueta: string; tono: 'slate' | 'green' | 'red' }> = ({
  valor,
  etiqueta,
  tono,
}) => {
  const tonos = {
    slate: 'bg-slate-50 text-slate-900 border-slate-200',
    green: 'bg-green-50 text-green-800 border-green-200',
    red: 'bg-red-50 text-red-800 border-red-200',
  };

  return (
    <div className={`rounded-xl border p-3 text-center ${tonos[tono]}`}>
      <p className="text-2xl font-bold tabular-nums">{valor}</p>
      <p className="text-[11px] uppercase tracking-wide opacity-70">{etiqueta}</p>
    </div>
  );
};
