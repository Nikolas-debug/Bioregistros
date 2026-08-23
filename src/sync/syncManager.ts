/**
 * Gestor de sincronización IndexedDB → Laravel → PostgreSQL.
 *
 * Cómo funciona, en una frase: todo lo que el técnico guarda entra a una
 * bandeja de salida en IndexedDB; este módulo la vacía contra el servidor
 * y borra de IndexedDB únicamente lo que el servidor confirmó por id.
 *
 * Reglas que sostienen el diseño:
 *  1. Nada se borra del celular sin confirmación explícita del servidor.
 *  2. El id lo genera el celular, y el servidor hace upsert por ese id.
 *     Reenviar un registro no lo duplica, así que un corte de red a mitad
 *     de camino es inofensivo.
 *  3. Un registro rechazado se queda en la cola con el motivo anotado;
 *     no bloquea a los demás del lote.
 *  4. Se reintenta con espera creciente para no castigar al servidor ni
 *     a la batería del celular.
 */

import { api, ApiError } from '../api/client';
import { dbManager } from '../db/indexedDB';
import { ElementoCola, MaintenanceRecord, ResultadoSync } from '../types';

/** Cuántos registros van por petición. */
const TAMANO_LOTE = 100;

/** Cada cuánto se intenta vaciar la cola estando en línea (ms). */
const INTERVALO_AUTO = 60_000;

/** Espera entre reintentos, según cuántas veces ha fallado ese registro. */
const ESPERAS = [0, 30_000, 120_000, 600_000, 1_800_000]; // 0s, 30s, 2m, 10m, 30m

/** Tras este número de intentos se deja de reintentar solo; hay que revisarlo. */
const MAX_INTENTOS = 8;

export type EstadoSync = 'inactivo' | 'sincronizando' | 'sin-conexion' | 'error';

export interface InstantaneaSync {
  estado: EstadoSync;
  pendientes: number;
  ultimoResultado: ResultadoSync | null;
  ultimaSincronizacion: number | null;
  hayServidor: boolean;
}

type Oyente = (s: InstantaneaSync) => void;

class SyncManager {
  private estado: EstadoSync = 'inactivo';
  private pendientes = 0;
  private ultimoResultado: ResultadoSync | null = null;
  private ultimaSincronizacion: number | null = null;
  private hayServidor = false;

  private oyentes = new Set<Oyente>();
  private temporizador: number | null = null;
  private enCurso: Promise<ResultadoSync> | null = null;

  /* ---------------------------------------------------------------- */
  /*  Arranque                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Se llama una sola vez al montar la aplicación.
   * Devuelve la función de limpieza para el useEffect de React.
   */
  iniciar(): () => void {
    this.refrescarPendientes();

    const alRecuperarRed = () => {
      // Un pequeño respiro: cuando el móvil dice "online" la red suele
      // tardar un par de segundos en servir de verdad.
      setTimeout(() => this.sincronizar('red-recuperada'), 2000);
    };

    const alPerderRed = () => {
      this.hayServidor = false;
      this.cambiarEstado('sin-conexion');
    };

    const alVolverAlFrente = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.sincronizar('app-visible');
      }
    };

    window.addEventListener('online', alRecuperarRed);
    window.addEventListener('offline', alPerderRed);
    document.addEventListener('visibilitychange', alVolverAlFrente);

    // Barrido periódico mientras la app está abierta.
    this.temporizador = window.setInterval(() => {
      if (navigator.onLine) this.sincronizar('periodico');
    }, INTERVALO_AUTO);

    // Primer intento al abrir.
    if (navigator.onLine) {
      this.sincronizar('arranque');
    } else {
      this.cambiarEstado('sin-conexion');
    }

    return () => {
      window.removeEventListener('online', alRecuperarRed);
      window.removeEventListener('offline', alPerderRed);
      document.removeEventListener('visibilitychange', alVolverAlFrente);
      if (this.temporizador) window.clearInterval(this.temporizador);
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Suscripción para la interfaz                                     */
  /* ---------------------------------------------------------------- */

  suscribir(oyente: Oyente): () => void {
    this.oyentes.add(oyente);
    oyente(this.instantanea());
    return () => this.oyentes.delete(oyente);
  }

  instantanea(): InstantaneaSync {
    return {
      estado: this.estado,
      pendientes: this.pendientes,
      ultimoResultado: this.ultimoResultado,
      ultimaSincronizacion: this.ultimaSincronizacion,
      hayServidor: this.hayServidor,
    };
  }

  private avisar() {
    const s = this.instantanea();
    this.oyentes.forEach((o) => o(s));
  }

  private cambiarEstado(estado: EstadoSync) {
    this.estado = estado;
    this.avisar();
  }

  async refrescarPendientes(): Promise<number> {
    this.pendientes = await dbManager.contarPendientes();
    this.avisar();
    return this.pendientes;
  }

  /* ---------------------------------------------------------------- */
  /*  El proceso principal                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Vacía la cola contra el servidor.
   * Si ya hay una sincronización corriendo, devuelve esa misma promesa en
   * vez de lanzar una segunda (evita envíos duplicados si el usuario
   * toca "sincronizar" mientras el temporizador ya disparó).
   */
  async sincronizar(motivo = 'manual'): Promise<ResultadoSync> {
    if (this.enCurso) return this.enCurso;

    this.enCurso = this.ejecutar(motivo).finally(() => {
      this.enCurso = null;
    });

    return this.enCurso;
  }

  private async ejecutar(motivo: string): Promise<ResultadoSync> {
    const vacio = (mensaje: string): ResultadoSync => ({
      ok: true,
      enviados: 0,
      guardados: 0,
      fallidos: 0,
      pendientes: this.pendientes,
      mensaje,
    });

    // 1. ¿Hay algo que enviar?
    const colaCompleta = await dbManager.obtenerCola(1000);
    this.pendientes = colaCompleta.length;

    if (colaCompleta.length === 0) {
      this.cambiarEstado('inactivo');
      return vacio('No hay registros pendientes.');
    }

    // 2. ¿Hay red?
    if (!navigator.onLine) {
      this.cambiarEstado('sin-conexion');
      return {
        ...vacio(`Sin conexión. ${colaCompleta.length} registro(s) esperando.`),
        ok: false,
      };
    }

    // 3. ¿Hay servidor de verdad? (wifi de hospital sin salida es común)
    this.cambiarEstado('sincronizando');
    this.hayServidor = await api.hayServidor();

    if (!this.hayServidor) {
      this.cambiarEstado('sin-conexion');
      return {
        ...vacio(
          `No se pudo contactar el servidor. ${colaCompleta.length} registro(s) esperando.`,
        ),
        ok: false,
      };
    }

    // 4. Solo los que ya cumplieron su tiempo de espera de reintento.
    const ahora = Date.now();
    const listos = colaCompleta.filter((item) => this.tocaReintentar(item, ahora));

    if (listos.length === 0) {
      this.cambiarEstado('inactivo');
      return vacio(
        `${colaCompleta.length} registro(s) en espera de reintento programado.`,
      );
    }

    console.info(
      `[sync] ${motivo}: enviando ${listos.length} de ${colaCompleta.length} pendientes`,
    );

    // 5. Envío por lotes.
    let guardados = 0;
    let fallidos = 0;
    const erroresVisibles: { id: string; detalle: string }[] = [];

    const borrarDelHistorial = await dbManager.leerPreferencia(
      'borrarTrasSincronizar',
      false,
    );

    for (let i = 0; i < listos.length; i += TAMANO_LOTE) {
      const lote = listos.slice(i, i + TAMANO_LOTE);

      try {
        const respuesta = await api.enviarLote(
          lote.map((item) => ({
            ...this.aFormatoServidor(item.payload),
            origen: item.payload.origen || 'offline',
          })),
        );

        // --- Confirmados: salen de la cola. La fila se borra solo cuando
        //     PostgreSQL la tiene, y de paso se guarda el numero de reporte
        //     que asigno el servidor.
        const confirmados = respuesta.aceptados.filter((a) => a.uuid);
        await dbManager.confirmarSincronizados(confirmados, borrarDelHistorial);
        guardados += confirmados.length;

        // --- Rechazados: se quedan, con el motivo anotado.
        if (respuesta.rechazados.length > 0) {
          const fallos = respuesta.rechazados.map((r) => ({
            id: r.uuid,
            error: Object.values(r.errores || {}).flat().join(' · ') || r.motivo,
          }));

          await dbManager.marcarFallidos(fallos);
          fallidos += fallos.length;
          erroresVisibles.push(
            ...fallos.map((f) => ({ id: f.id, detalle: f.error })),
          );
        }
      } catch (e) {
        // Falló el lote entero (red o servidor caído a mitad de camino).
        // Nada se borra: se reintenta después.
        const detalle =
          e instanceof ApiError ? e.message : 'Error inesperado al sincronizar.';

        await dbManager.marcarFallidos(
          lote.map((item) => ({ id: item.id, error: detalle })),
        );
        fallidos += lote.length;

        if (e instanceof ApiError && e.esDeRed) {
          // Sin red: no tiene sentido seguir con los demás lotes.
          break;
        }
      }
    }

    await this.refrescarPendientes();
    this.ultimaSincronizacion = Date.now();
    this.cambiarEstado(fallidos > 0 ? 'error' : 'inactivo');

    const resultado: ResultadoSync = {
      ok: fallidos === 0,
      enviados: listos.length,
      guardados,
      fallidos,
      pendientes: this.pendientes,
      mensaje:
        fallidos === 0
          ? `${guardados} registro(s) guardados en el servidor.`
          : `${guardados} guardados, ${fallidos} con problemas. Quedan ${this.pendientes} en el dispositivo.`,
      errores: erroresVisibles.slice(0, 20),
    };

    this.ultimoResultado = resultado;
    this.avisar();

    return resultado;
  }

  /** Espera creciente: 0s, 30s, 2m, 10m, 30m, y de ahí en adelante 30m. */
  private tocaReintentar(item: ElementoCola, ahora: number): boolean {
    const intentos = item.intentos || 0;

    if (intentos === 0) return true;
    if (intentos >= MAX_INTENTOS) return false; // requiere revisión manual

    const espera = ESPERAS[Math.min(intentos, ESPERAS.length - 1)];

    return ahora - (item.ultimoIntento || item.creadoEn) >= espera;
  }

  /* ---------------------------------------------------------------- */
  /*  Utilidades para la interfaz                                      */
  /* ---------------------------------------------------------------- */

  /** Fuerza el envío ignorando las esperas de reintento (botón manual). */
  async forzar(): Promise<ResultadoSync> {
    // Se ponen los contadores en cero *en IndexedDB*, no solo en memoria,
    // para que ningún registro quede aplazado en esta corrida.
    await dbManager.reiniciarIntentos();

    return this.sincronizar('forzado');
  }

  /**
   * Traduce un registro local al vocabulario del backend.
   *
   * El uuid viaja como clave de idempotencia. El numero de reporte NO se
   * envia: lo asigna el servidor, salvo que el registro ya tenga uno (por
   * ejemplo si vino de un seguimiento historico en Excel).
   */
  private aFormatoServidor(r: MaintenanceRecord): Record<string, unknown> {
    return {
      uuid: r.id,
      numero_reporte: r.numeroReporte ?? null,
      serie: r.serialNumber,
      inventario: r.inventoryCode,
      equipo: r.equipment,
      marca: r.brand,
      modelo: r.model,
      servicio: r.service,
      ubicacion: r.specificLocation,
      fecha: r.date,
      hora: r.time || null,
      preventivo: r.preventivo,
      correctivo: r.correctivo,
      otro: r.otro,
      descripcion: r.failureComments,
      observaciones: r.additionalObservations,
      estado: r.finalStatus,
      repuestos: r.spareParts,
      tecnico: r.technicianName,
      createdAt: r.createdAt,
    };
  }

  /** Registros atascados que ya no se reintentan solos. */
  async pendientesConProblema(): Promise<ElementoCola[]> {
    const cola = await dbManager.obtenerCola(1000);
    return cola.filter((i) => (i.intentos || 0) >= 3);
  }
}

export const syncManager = new SyncManager();
