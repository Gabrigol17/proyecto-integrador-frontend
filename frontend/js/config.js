/**
 * URL base de la API REST.
 *
 * Cambie esta constante si el backend se mueve a otro servicio. También se
 * puede probar un backend local agregando ?api=http://localhost:8080/api a la
 * URL del frontend, sin modificar el código.
 */
const apiOverride = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('api')
    : null;

export const API_URL = (apiOverride || 'https://proyecto-integrador-3cer-semestre.onrender.com/api')
    .replace(/\/+$/, '');

export const REQUEST_TIMEOUT_MS = 20000;
