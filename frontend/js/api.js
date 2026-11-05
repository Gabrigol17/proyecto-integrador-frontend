import { API_URL, REQUEST_TIMEOUT_MS } from './config.js';

/** Error uniforme para fallos HTTP, de red o de tiempo de espera. */
export class ApiError extends Error {
    constructor(message, status = 0, details = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
    }
}

async function request(path, { method = 'GET', body, signal } = {}) {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => {
        controller.abort(new DOMException('Tiempo de espera agotado', 'TimeoutError'));
    }, REQUEST_TIMEOUT_MS);

    if (signal) {
        if (signal.aborted) {
            controller.abort(signal.reason);
        } else {
            signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
        }
    }

    try {
        const response = await fetch(`${API_URL}${path}`, {
            method,
            mode: 'cors',
            headers: body === undefined
                ? { Accept: 'application/json' }
                : { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
        });

        const raw = await response.text();
        let data = null;

        if (raw) {
            try {
                data = JSON.parse(raw);
            } catch {
                data = raw;
            }
        }

        if (!response.ok) {
            const message = data && typeof data === 'object' && data.mensaje
                ? data.mensaje
                : `La API respondió con el código ${response.status}.`;
            throw new ApiError(message, response.status, data);
        }

        return data;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
            throw new ApiError('La solicitud tardó demasiado. Verifique la conexión con la API.', 0, error);
        }

        throw new ApiError(
            'No se pudo conectar con la API. Verifique que el servicio esté disponible y que CORS esté habilitado.',
            0,
            error,
        );
    } finally {
        globalThis.clearTimeout(timeout);
    }
}

function query(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            search.set(key, value);
        }
    }
    const text = search.toString();
    return text ? `?${text}` : '';
}

export const api = {
    estado: () => request('/estado'),

    areas: {
        listar: () => request('/areas'),
        obtener: (idArea) => request(`/areas/${encodeURIComponent(idArea)}`),
        crear: (data) => request('/areas', { method: 'POST', body: data }),
        actualizar: (idArea, data) => request(`/areas/${encodeURIComponent(idArea)}`, { method: 'PUT', body: data }),
        eliminar: (idArea) => request(`/areas/${encodeURIComponent(idArea)}`, { method: 'DELETE' }),
    },

    equipos: {
        listar: () => request('/equipos'),
        obtener: (codigo) => request(`/equipos/${encodeURIComponent(codigo)}`),
        crear: (data) => request('/equipos', { method: 'POST', body: data }),
        actualizar: (codigo, data) => request(`/equipos/${encodeURIComponent(codigo)}`, { method: 'PUT', body: data }),
        // No se usa eliminarOrdenes=true: el frontend conserva el historial.
        eliminar: (codigo) => request(`/equipos/${encodeURIComponent(codigo)}?eliminarOrdenes=false`, { method: 'DELETE' }),
    },

    ordenes: {
        listar: ({ estado, codigoEquipo } = {}) => request(`/ordenes${query({ estado, codigoEquipo })}`),
        obtener: (id) => request(`/ordenes/${encodeURIComponent(id)}`),
        cola: () => request('/ordenes/cola'),
        historial: () => request('/ordenes/historial'),
        crear: (data) => request('/ordenes', { method: 'POST', body: data }),
        actualizar: (id, data) => request(`/ordenes/${encodeURIComponent(id)}`, { method: 'PUT', body: data }),
        cerrar: (id) => request(`/ordenes/${encodeURIComponent(id)}/cerrar`, { method: 'POST' }),
        cancelar: (id) => request(`/ordenes/${encodeURIComponent(id)}/cancelar`, { method: 'POST' }),
        atenderSiguiente: () => request('/ordenes/atender-siguiente', { method: 'POST' }),
        deshacer: () => request('/ordenes/historial/deshacer', { method: 'POST' }),
    },

    estadisticas: () => request('/estadisticas'),
};
