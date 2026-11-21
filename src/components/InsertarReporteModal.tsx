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
} from 'lucide-react';
import { Sheet } from './ui';
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

  const pie = (
    <>
      {paso === 'formulario' && siguiente !== null && (
        <>
          <button onClick={onClose} className="btn btn-ghost flex-1 sm:flex-none">Cancelar</button>
          <button onClick={previsualizar} disabled={consultando} className="btn btn-primary flex-1">
            {consultando && <Loader2 className="size-4 animate-spin" />}
            Continuar
            <ArrowRight className="size-4" />
          </button>
        </>
      )}
      {paso === 'confirmar' && (
        <>
          <button onClick={() => setPaso('formulario')} className="btn btn-ghost flex-1 sm:flex-none">Volver</button>
          <button
            onClick={confirmar}
            className={`btn flex-1 ${seMueven && seMueven > 0 ? 'bg-amber-400 text-slate-900 hover:bg-amber-500' : 'btn-primary'}`}
          >
            {seMueven && seMueven > 0 ? `Insertar y renumerar ${seMueven}` : 'Insertar'}
          </button>
        </>
      )}
      {(paso === 'listo' || (paso === 'formulario' && siguiente === null && !cargandoEstado)) && (
        <button onClick={onClose} className="btn btn-primary flex-1">Cerrar</button>
      )}
    </>
  );

  return (
    <Sheet
      titulo="Insertar reporte olvidado"
      subtitulo="Los reportes posteriores se corren en uno"
      icono={<CornerDownLeft className="size-5" />}
      onClose={onClose}
      ancho="lg"
      pie={paso === 'guardando' ? undefined : pie}
    >


          {error && (
            <div className="notice notice-error mb-4" role="alert">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* --- Paso 1: formulario --- */}
          {paso === 'formulario' && (
            <>
              {cargandoEstado ? (
                <div className="py-10 text-center">
                  <Loader2 className="mx-auto mb-2 size-6 animate-spin text-blue-700" />
                  <p className="text-sm text-slate-500">Consultando el consecutivo…</p>
                </div>
              ) : siguiente === null ? (
                <div className="py-10 text-center">
                  <WifiOff className="mx-auto mb-3 size-10 text-slate-400" />
                  <p className="text-sm text-slate-600 max-w-sm mx-auto">
                    Esta operación necesita conexión: el número de reporte depende
                    de todos los registros del servidor, y el celular no puede
                    calcularlo por su cuenta.
                  </p>
                </div>
              ) : (
                <>
                  {/* Número */}
                  <div className="soft mb-6 p-5">
                    <label className="field-label">
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
                      className="input text-xl font-bold tabular-nums"
                    />

                    <p className="field-hint">
                      El último asignado es el <strong>{siguiente - 1}</strong>. Un
                      registro nuevo normal tomaría el <strong>{siguiente}</strong>.
                    </p>

                    {huecos.length > 0 && (
                      <div className="mt-2.5">
                        <p className="mb-2 text-[13px] font-bold text-slate-700">
                          Números libres dentro de la secuencia:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {huecos.slice(0, 14).map((h) => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => setNumero(String(h))}
                              aria-pressed={numero === String(h)}
                              className="pill-tab min-h-10 px-3.5 tabular-nums"
                            >
                              {h}
                            </button>
                          ))}
                          {huecos.length > 14 && (
                            <span className="self-center px-1 text-[13px] text-slate-500">
                              +{huecos.length - 14} más
                            </span>
                          )}
                        </div>
                        <p className="field-hint">
                          Usar un hueco no mueve ningún reporte.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Datos */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <div className="mt-5">
                    <p className="field-label">
                      Clase <span className="font-medium text-slate-500">· puede marcar varias</span>
                    </p>
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
                          className="pill-tab px-5"
                        >
                          {etiqueta}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
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

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div className="soft p-6 text-center">
                <p className="text-sm text-slate-500">
                  El reporte quedará como
                </p>
                <p className="mt-1 text-5xl font-medium tracking-[-0.02em] text-slate-900 tabular-nums">
                  #{numero}
                </p>
                <p className="mt-2 text-[15px] font-bold text-slate-900">{equipo}</p>
                <p className="text-[13px] text-slate-500">{fecha}</p>
              </div>

              {seMueven && seMueven > 0 ? (
                <div className="notice notice-warn mt-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
                    <div>
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
                <div className="notice notice-ok mt-4">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                  <p>
                    Ese número está libre: no se mueve ningún reporte existente.
                  </p>
                </div>
              )}
            </div>
          )}

          {paso === 'guardando' && (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto mb-3 size-8 animate-spin text-blue-700" />
              <p className="text-sm text-slate-600">Insertando y renumerando…</p>
            </div>
          )}

          {paso === 'listo' && resultado && (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto mb-4 size-14 text-emerald-700" />
              <p className="text-xl font-medium text-slate-900">
                Guardado como reporte #{resultado.numero}
              </p>
              <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                {resultado.movidos > 0
                  ? `Se corrieron ${resultado.movidos} reporte(s) posteriores.`
                  : 'No se movió ningún otro reporte.'}
              </p>
            </div>
          )}
    </Sheet>
  );
};

/* ------------------------------------------------------------------ */

const estilo = 'input';

const Campo: React.FC<{ etiqueta: string; children: React.ReactNode }> = ({ etiqueta, children }) => (
  <label className="block">
    <span className="field-label">{etiqueta}</span>
    {children}
  </label>
);
