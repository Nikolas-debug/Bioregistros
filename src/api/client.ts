
export const API_URL: string =
  (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '/api';

/** Milisegundos antes de dar por perdida una petición. */
const TIMEOUT_MS = 20000;

/* ------------------------------------------------------------------ */
/*  Sesión                                                             */
/* ------------------------------------------------------------------ */

const LLAVE_TOKEN = 'biomedica.token';

/**
 * El token vive en localStorage porque tiene que sobrevivir a que se
 * cierre la aplicación: un técnico en ronda no puede estar escribiendo la
 * contraseña cada vez que el celular descarta la pestaña.
 *
 * Se lee y se escribe dentro de try/catch porque en modo incógnito, o con
 * el almacenamiento del sitio bloqueado, el acceso lanza excepción.
 */
export const sesion = {
  token(): string | null {
    try {
      return localStorage.getItem(LLAVE_TOKEN);
    } catch {
      return null;
    }
  },

  guardar(token: string): void {
    try {
      localStorage.setItem(LLAVE_TOKEN, token);
    } catch {
      // Sin almacenamiento la sesión dura lo que dure la pestaña.
      tokenEnMemoria = token;
    }
  },

  borrar(): void {
    try {
      localStorage.removeItem(LLAVE_TOKEN);
    } catch {
      // ignorado
    }
    tokenEnMemoria = null;
  },
};

let tokenEnMemoria: string | null = null;

function tokenActual(): string | null {
  return sesion.token() ?? tokenEnMemoria;
}

/**
 * Se avisa cuando el servidor rechaza el token, para que la aplicación
 * muestre la pantalla de ingreso sin que cada llamada tenga que saberlo.
 */
type OyenteSesion = () => void;
const oyentesSesion = new Set<OyenteSesion>();

export function alPerderSesion(oyente: OyenteSesion): () => void {
  oyentesSesion.add(oyente);
  return () => oyentesSesion.delete(oyente);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** true cuando no hubo respuesta del servidor (sin red, servidor caído). */
  get esDeRed(): boolean {
    return this.status === 0;
  }
}

async function request<T>(
  ruta: string,
  opciones: RequestInit = {},
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      signal: controlador.signal,
      headers: {
        Accept: 'application/json',
        ...(opciones.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(tokenActual() ? { Authorization: `Bearer ${tokenActual()}` } : {}),
        ...(opciones.headers || {}),
      },
    });

    const texto = await respuesta.text();
    let cuerpo: any = null;
    try {
      cuerpo = texto ? JSON.parse(texto) : null;
    } catch {
      cuerpo = texto;
    }

    // El token venció o fue revocado: la sesión se cae y la interfaz
    // vuelve a la pantalla de ingreso. Los datos locales no se tocan.
    if (respuesta.status === 401) {
      sesion.borrar();
      oyentesSesion.forEach((o) => o());
    }

    // 207 = éxito parcial: parte del lote se guardó. No es un error.
    if (!respuesta.ok && respuesta.status !== 207) {
      throw new ApiError(
        cuerpo?.mensaje || cuerpo?.message || `Error ${respuesta.status} del servidor`,
        respuesta.status,
        cuerpo,
      );
    }

    return cuerpo as T;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;

    const mensaje =
      e?.name === 'AbortError'
        ? 'El servidor no respondió a tiempo.'
        : 'No hay conexión con el servidor.';

    throw new ApiError(mensaje, 0, null);
  } finally {
    clearTimeout(temporizador);
  }
}

/* ------------------------------------------------------------------ */
/* Tipos de respuesta                                                  */
/* ------------------------------------------------------------------ */

export interface RespuestaSync {

  aceptados: { uuid: string; id: number; numero_reporte: number | null }[];
  rechazados: {
    uuid: string;
    fila: number;
    motivo: 'validacion' | 'servidor';
    errores: Record<string, string[]>;
  }[];
  resumen: { recibidos: number; guardados: number; fallidos: number };
}

/** Lo que devuelve GET /sync/descargar. */
export interface RespuestaDescarga {
  registros: any[];
  /** Hora del servidor: es el marcador para la próxima bajada. */
  servidor_hora: string;
  /** true si el lote se llenó y faltan registros por traer. */
  hay_mas?: boolean;
  /** Desde dónde pedir el siguiente lote. */
  siguiente_desde?: string | null;
  total?: number;
}

export interface RespuestaImportacion {
  simulacion: boolean;
  columnas_detectadas: string[];
  columnas_ignoradas: string[];
  filas_procesadas: number;
  importados: number;
  reportes: number[];
  errores: { fila: number; equipo: string; errores: string[] }[];
  vista_previa: any[];
  mensaje: string;
}

/** Estado del consecutivo de reportes en el servidor. */
export interface EstadoReportes {
  siguiente: number;
  huecos: number[];
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export interface PerfilUsuario {
  id: string;
  name: string;
  email: string;
  role: string;
  institution: string;
  avatarUrl: string;
  isLoggedIn: boolean;
}

export const api = {
  /* ---------------- Sesión ---------------- */

  async iniciarSesion(email: string, password: string): Promise<PerfilUsuario> {
    const r = await request<{ token: string; usuario: PerfilUsuario }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      15000,
    );

    sesion.guardar(r.token);
    return r.usuario;
  },

  async cerrarSesion(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' }, 8000);
    } catch {
      // Si no hay red igual se cierra en el dispositivo.
    }
    sesion.borrar();
  },

  /** Comprueba que el token guardado siga sirviendo. */
  async miPerfil(): Promise<PerfilUsuario> {
    const r = await request<{ usuario: PerfilUsuario }>('/auth/yo', {}, 10000);
    return r.usuario;
  },

  hayToken(): boolean {
    return !!tokenActual();
  },

  actualizarPerfil(datos: {
    name?: string;
    cargo?: string;
    institucion?: string;
  }): Promise<{ usuario: PerfilUsuario }> {
    return request('/auth/perfil', { method: 'PUT', body: JSON.stringify(datos) });
  },

  async cambiarContrasena(
    actual: string,
    nueva: string,
    confirmacion: string,
  ): Promise<{ mensaje: string }> {
    const r = await request<{ mensaje: string; token: string }>('/auth/contrasena', {
      method: 'PUT',
      body: JSON.stringify({
        actual,
        nueva,
        nueva_confirmation: confirmacion,
      }),
    });

    if (r.token) sesion.guardar(r.token);
    return r;
  },


  async hayServidor(): Promise<boolean> {
    try {
      await request('/sync/ping', { method: 'GET' }, 5000);
      return true;
    } catch {
      return false;
    }
  },

  /** Envía un lote de registros pendientes de IndexedDB. */
  enviarLote(registros: any[]): Promise<RespuestaSync> {
    return request<RespuestaSync>('/sync/mantenimientos', {
      method: 'POST',
      body: JSON.stringify({ registros }),
    });
  },

  /** Estadísticas del servidor, para comparar con lo que hay en el celular. */
  estadoServidor(): Promise<any> {
    return request('/sync/estado');
  },

  /**
   * Trae del servidor los registros modificados desde una fecha.
   *
   * Es lo que hace que el mismo usuario vea lo mismo en el celular y en el
   * PC: la base del servidor es una sola y compartida; IndexedDB es solo
   * la copia de cada dispositivo.
   *
   * `hay_mas` avisa que quedaron registros por fuera del lote y hay que
   * volver a pedir desde `siguiente_desde`.
   */
  descargar(desde?: string, limite = 1000): Promise<RespuestaDescarga> {
    const q = new URLSearchParams();
    if (desde) q.set('desde', desde);
    q.set('limite', String(limite));

    return request<RespuestaDescarga>(
      `/sync/descargar?${q.toString()}`,
      {},
      60000, // el primer barrido de un dispositivo nuevo puede traer miles
    );
  },

  /** Sube un Excel al servidor. Con simular=true solo valida. */
  importarExcel(archivo: File, simular = false): Promise<RespuestaImportacion> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    if (simular) datos.append('simular', '1');

    return request<RespuestaImportacion>(
      '/importar/excel',
      { method: 'POST', body: datos },
      120000, // los archivos grandes tardan
    );
  },

  /** URL de descarga de la plantilla de registro masivo. */
  urlPlantilla(): string {
    return `${API_URL}/importar/plantilla`;
  },

  /** Que numero de reporte le tocaria a un registro nuevo. */
  siguienteReporte(): Promise<EstadoReportes> {
    return request<EstadoReportes>('/reportes/siguiente');
  },

  /** Cuantos reportes se moverian al insertar uno olvidado en esa posicion. */
  previsualizarInsercion(numero: number): Promise<{
    numero: number;
    se_mueven: number;
    ultimo: number | null;
  }> {
    return request(`/reportes/previsualizar-insercion?numero=${numero}`);
  },

  /**
   * Inserta un reporte olvidado en la posicion indicada y corre los
   * posteriores. Es el unico camino que renumera registros existentes.
   */
  insertarReporte(registro: any, numeroReporte: number): Promise<any> {
    return request('/reportes/insertar', {
      method: 'POST',
      body: JSON.stringify({ ...registro, numero_reporte: numeroReporte }),
    });
  },

  /** Cierra los huecos de la numeracion. Con simular=true no escribe nada. */
  compactarReportes(desde = 1, simular = true): Promise<any> {
    return request('/reportes/compactar', {
      method: 'POST',
      body: JSON.stringify({ desde, simular }),
    });
  },

  /**
   * Borra un mantenimiento del servidor.
   *
   * Hace falta desde que la aplicación baja lo que hay en PostgreSQL: si
   * solo se borrara en el dispositivo, la siguiente bajada lo traería de
   * vuelta. `cerrarHueco` corre los consecutivos posteriores.
   */
  eliminarMantenimiento(idServidor: number, cerrarHueco = false): Promise<any> {
    return request(
      `/mantenimientos/${idServidor}${cerrarHueco ? '?cerrar_hueco=1' : ''}`,
      { method: 'DELETE' },
    );
  },

  listarMantenimientos(params: Record<string, any> = {}): Promise<any> {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as any,
    ).toString();
    return request(`/mantenimientos${q ? `?${q}` : ''}`);
  },

  estadisticas(anio?: number): Promise<any> {
    return request(`/mantenimientos/estadisticas${anio ? `?anio=${anio}` : ''}`);
  },

  equiposProximos(): Promise<any> {
    return request('/dispositivos/proximos');
  },
};
