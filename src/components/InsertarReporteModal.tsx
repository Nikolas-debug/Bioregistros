/**
 * Insertar un reporte olvidado.
 *
 * Es la única pantalla que renumera reportes ya existentes, así que está
 * separada del registro normal a propósito: primero se consulta cuántos se
 * moverían, se muestra ese número, y solo entonces se confirma.
 *
 * Requiere conexión. El número de reporte depende de toda la tabla, y el
 * celular no puede calcularlo ni reservarlo estando sin red: dos técnicos
 * offline elegirían el mismo y uno pisaría al otro.
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CornerDownLeft,
  Loader2,
  WifiOff,
  X,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import { ESTADOS_SUGERIDOS, SERVICIOS_SUGERIDOS } from '../types';

interface Props {
  onClose: () => void;
  onInsertado: () => void;
  tecnicoPorDefecto?: string;
}

type Paso = 'formulario' | 'confirmar' | 'guardando' | 'listo';

export const InsertarReporteModal: React.FC<Props> = ({
  onClose,
  onInsertado,
  tecnicoPorDefecto,
}) => {
  const [paso, setPaso] = useState<Paso>('formulario');
  const [error, setError] = useState<string | null>(null);

  /* --- Estado del consecutivo en el servidor --- */
  const [siguiente, setSiguiente] = useState<number | null>(null);
  const [huecos, setHuecos] = useState<number[]>([]);
  const [cargandoEstado, setCargandoEstado] = useState(true);

  /* --- Previsualización --- */
  const [seMueven, setSeMueven] = useState<number | null>(null);
  const [consultando, setConsultando] = useState(false);

  /* --- Resultado --- */
  const [resultado, setResultado] = useState<{ numero: number; movidos: number } | null>(null);

  /* --- Formulario --- */
  const hoy = new Date().toISOString().split('T')[0];
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [equipo, setEquipo] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [serie, setSerie] = useState('');
  const [inventario, setInventario] = useState('');
  const [servicio, setServicio] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [preventivo, setPreventivo] = useState(true);
  const [correctivo, setCorrectivo] = useState(false);
  const [otro, setOtro] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [estado, setEstado] = useState('FUNCIONAL');
  const [repuestos, setRepuestos] = useState('');

  /* ---------------- Estado del consecutivo ---------------- */

  useEffect(() => {
    let vigente = true;

    api
      .siguienteReporte()
      .then((r) => {
        if (!vigente) return;
        setSiguiente(r.siguiente);
        setHuecos(r.huecos || []);
        // Se propone el primer hueco: casi siempre es justo el número que
        // le falta a quien viene a insertar un reporte olvidado.
        setNumero(String(r.huecos?.[0] ?? r.siguiente));
      })
      .catch((e) => {
        if (!vigente) return;
        setError(
          e instanceof ApiError && e.esDeRed
            ? 'Esta operación necesita conexión con el servidor.'
            : 'No se pudo consultar el consecutivo de reportes.',
        );
      })
      .finally(() => vigente && setCargandoEstado(false));

    return () => {
      vigente = false;
    };
  }, []);

  /* ---------------- Previsualizar ---------------- */

  const previsualizar = async () => {
    setError(null);

    const n = parseInt(numero, 10);
    if (!Number.isFinite(n) || n < 1) {
      setError('Escriba el número de reporte que debe quedar.');
      return;
    }
    if (!equipo.trim()) {
      setError('Escriba el nombre del equipo.');
      return;
    }
    if (!preventivo && !correctivo && !otro) {
      setError('Marque al menos una clase.');
      return;
    }

    setConsultando(true);
    try {
      const r = await api.previsualizarInsercion(n);
      setSeMueven(r.se_mueven);
      setPaso('confirmar');
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'No se pudo consultar cuántos se moverían.',
      );
    } finally {
      setConsultando(false);
    }
  };

  /* ---------------- Confirmar ---------------- */

  const confirmar = async () => {
    const n = parseInt(numero, 10);
    setPaso('guardando');
    setError(null);

    try {
      const r = await api.insertarReporte(
        {
          fecha,
          equipo: equipo.trim(),
          marca: marca.trim(),
          modelo: modelo.trim(),
          serie: serie.trim(),
          inventario: inventario.trim(),
          servicio: servicio.trim(),
          ubicacion: ubicacion.trim(),
          preventivo,
          correctivo,
          otro,
          descripcion: descripcion.trim(),
          observaciones: observaciones.trim(),
          estado: estado.trim(),
          repuestos: repuestos.trim(),
          tecnico: tecnicoPorDefecto || '',
        },
        n,
      );

      setResultado({ numero: n, movidos: r.reportes_movidos ?? 0 });
      onInsertado();
      setPaso('listo');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo insertar el reporte.');
      setPaso('confirmar');
    }
  };

  /* ---------------- Interfaz ---------------- */

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <CornerDownLeft className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Insertar reporte olvidado</h2>
              <p className="text-xs text-slate-500">
                Los reportes posteriores se corren en uno
              </p>
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

          {/* --- Paso 1: formulario --- */}
          {paso === 'formulario' && (
            <>
              {cargandoEstado ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-600 mb-2" />
                  <p className="text-sm text-slate-500">Consultando el consecutivo…</p>
                </div>
              ) : siguiente === null ? (
                <div className="py-10 text-center">
                  <WifiOff className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                  <p className="text-sm text-slate-600 max-w-sm mx-auto">
                    Esta operación necesita conexión: el número de reporte depende
                    de todos los registros del servidor, y el celular no puede
                    calcularlo por su cuenta.
                  </p>
                </div>
              ) : (
                <>
                  {/* Número */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
                    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1.5">
                      Número de reporte
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={numero}
                      onChange={(e) => {
                        setNumero(e.target.value);
                        setError(null);
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-lg font-bold tabular-nums focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    />

                    <p className="mt-2 text-[11px] text-slate-500">
                      El último asignado es el <strong>{siguiente - 1}</strong>. Un
                      registro nuevo normal tomaría el <strong>{siguiente}</strong>.
                    </p>

                    {huecos.length > 0 && (
                      <div className="mt-2.5">
                        <p className="text-[11px] text-slate-600 mb-1.5">
                          Números libres dentro de la secuencia:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {huecos.slice(0, 14).map((h) => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => setNumero(String(h))}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold tabular-nums border transition ${
                                numero === String(h)
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                              }`}
                            >
                              {h}
                            </button>
                          ))}
                          {huecos.length > 14 && (
                            <span className="px-1 py-1 text-[11px] text-slate-400">
                              +{huecos.length - 14} más
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          Usar un hueco no mueve ningún reporte.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Datos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Campo etiqueta="Fecha *">
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className={estilo}
                      />
                    </Campo>
                    <Campo etiqueta="Equipo *">
                      <input
                        type="text"
                        value={equipo}
                        onChange={(e) => setEquipo(e.target.value)}
                        placeholder="Ej. MONITOR MULTIPARAMETROS"
                        className={estilo}
                      />
                    </Campo>
                    <Campo etiqueta="Marca">
                      <input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} className={estilo} />
                    </Campo>
                    <Campo etiqueta="Modelo">
                      <input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} className={estilo} />
                    </Campo>
                    <Campo etiqueta="Serie">
                      <input type="text" value={serie} onChange={(e) => setSerie(e.target.value)} className={estilo} />
                    </Campo>
                    <Campo etiqueta="Inventario">
                      <input type="text" value={inventario} onChange={(e) => setInventario(e.target.value)} className={estilo} />
                    </Campo>
                    <Campo etiqueta="Servicio">
                      <input
                        type="text"
                        list="ins-servicios"
                        value={servicio}
                        onChange={(e) => setServicio(e.target.value)}
                        className={estilo}
                      />
                      <datalist id="ins-servicios">
                        {SERVICIOS_SUGERIDOS.map((s) => <option key={s} value={s} />)}
                      </datalist>
                    </Campo>
                    <Campo etiqueta="Ubicación">
                      <input type="text" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={estilo} />
                    </Campo>
                  </div>

                  {/* Clase */}
                  <div className="mt-3">
                    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1.5">
                      Clase <span className="font-normal normal-case text-slate-400">(puede marcar varias)</span>
                    </label>
                    <div className="flex gap-2">
                      {([
                        ['Preventivo', preventivo, setPreventivo],
                        ['Correctivo', correctivo, setCorrectivo],
                        ['Otro', otro, setOtro],
                      ] as const).map(([etiqueta, activa, cambiar]) => (
                        <button
                          key={etiqueta}
                          type="button"
                          aria-pressed={activa}
                          onClick={() => cambiar((v: boolean) => !v)}
                          className={`px-3.5 py-2 rounded-full text-xs font-semibold transition ${
                            activa
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {etiqueta}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    <Campo etiqueta="Descripción">
                      <textarea
                        rows={2}
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        placeholder="Qué se encontró"
                        className={estilo}
                      />
                    </Campo>
                    <Campo etiqueta="Observaciones">
                      <textarea
                        rows={2}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Qué se hizo"
                        className={estilo}
                      />
                    </Campo>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Campo etiqueta="Estado">
                        <input
                          type="text"
                          list="ins-estados"
                          value={estado}
                          onChange={(e) => setEstado(e.target.value)}
                          className={estilo}
                        />
                        <datalist id="ins-estados">
                          {ESTADOS_SUGERIDOS.map((e) => <option key={e} value={e} />)}
                        </datalist>
                      </Campo>
                      <Campo etiqueta="Repuestos">
                        <input type="text" value={repuestos} onChange={(e) => setRepuestos(e.target.value)} className={estilo} />
                      </Campo>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* --- Paso 2: confirmar --- */}
          {paso === 'confirmar' && (
            <div className="py-6">
              <div className="rounded-2xl border border-slate-200 p-5 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  El reporte quedará como
                </p>
                <p className="text-4xl font-bold text-slate-900 tabular-nums">
                  #{numero}
                </p>
                <p className="mt-1 text-sm text-slate-600">{equipo}</p>
                <p className="text-xs text-slate-500">{fecha}</p>
              </div>

              {seMueven && seMueven > 0 ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-900">
                      <p className="font-semibold">
                        Se van a renumerar {seMueven} reporte(s).
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed">
                        Todos los que hoy tienen del <strong>{numero}</strong> en
                        adelante subirán en uno. Si alguno ya se imprimió o se envió
                        a la clínica, ese papel dejará de coincidir con el sistema.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-900">
                    Ese número está libre: no se mueve ningún reporte existente.
                  </p>
                </div>
              )}
            </div>
          )}

          {paso === 'guardando' && (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-3" />
              <p className="text-sm text-slate-600">Insertando y renumerando…</p>
            </div>
          )}

          {paso === 'listo' && resultado && (
            <div className="py-12 text-center">
              <CheckCircle2 className="w-14 h-14 mx-auto text-green-600 mb-4" />
              <p className="text-lg font-semibold text-slate-900">
                Guardado como reporte #{resultado.numero}
              </p>
              <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                {resultado.movidos > 0
                  ? `Se corrieron ${resultado.movidos} reporte(s) posteriores.`
                  : 'No se movió ningún otro reporte.'}
              </p>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="border-t border-slate-200 px-5 py-4 flex gap-3 shrink-0">
          {paso === 'formulario' && siguiente !== null && (
            <>
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={previsualizar}
                disabled={consultando}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Continuar
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {paso === 'confirmar' && (
            <>
              <button
                onClick={() => setPaso('formulario')}
                className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Volver
              </button>
              <button
                onClick={confirmar}
                className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white ${
                  seMueven && seMueven > 0
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                {seMueven && seMueven > 0
                  ? `Insertar y renumerar ${seMueven}`
                  : 'Insertar'}
              </button>
            </>
          )}

          {(paso === 'listo' || (paso === 'formulario' && siguiente === null)) && (
            <button
              onClick={onClose}
              className="flex-1 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const estilo =
  'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 ' +
  'placeholder:text-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 ' +
  'focus:border-transparent';

const Campo: React.FC<{ etiqueta: string; children: React.ReactNode }> = ({
  etiqueta,
  children,
}) => (
  <div>
    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1.5">
      {etiqueta}
    </label>
    {children}
  </div>
);
