const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
});

const numberFormatter = new Intl.NumberFormat('es-CO');

export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

export function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? numberFormatter.format(number) : '0';
}

export function truncate(value, max = 80) {
    const text = String(value ?? '');
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Misma regla del modelo Java: 2*impacto + 2*riesgo + 2 si no hay respaldo. */
export function criticityScore(impacto, riesgoSeguridad, hayRespaldo) {
    return 2 * Number(impacto) + 2 * Number(riesgoSeguridad) + (hayRespaldo ? 0 : 2);
}

export function criticityLevel(impacto, riesgoSeguridad, hayRespaldo) {
    const score = criticityScore(impacto, riesgoSeguridad, hayRespaldo);
    if (Number(riesgoSeguridad) === 3 || score >= 11) return 'ALTA';
    if (score >= 7) return 'MEDIA';
    return 'BAJA';
}

export function criticityBadge(nivel) {
    const key = String(nivel || 'BAJA').toLowerCase();
    return `<span class="badge badge-crit ${escapeHtml(key)}">${escapeHtml(nivel || '—')}</span>`;
}

export function estadoBadge(estado) {
    const key = String(estado || '').toLowerCase();
    return `<span class="badge badge-estado ${escapeHtml(key)}">${escapeHtml(estado || '—')}</span>`;
}

export function tipoBadge(tipo) {
    return `<span class="badge badge-tipo">${escapeHtml(tipo || '—')}</span>`;
}

export function actionBadge(tipo) {
    const key = String(tipo || '').toLowerCase();
    const labels = {
        crear: 'Creación',
        modificar: 'Modificación',
        cancelar: 'Cancelación',
        cerrar: 'Cierre',
        baja_equipo: 'Baja de equipo',
    };
    const label = labels[key] || tipo || '—';
    return `<span class="badge badge-action ${escapeHtml(key)}">${escapeHtml(label)}</span>`;
}

export function debounce(fn, delay = 180) {
    let timer = null;
    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
    };
}

export function emptyState({ icon = 'inbox', title = 'Sin datos', description = '' }) {
    return `
        <div class="empty-state">
            <div>
                <div class="empty-state-icon"><i class="bi bi-${escapeHtml(icon)}" aria-hidden="true"></i></div>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(description)}</p>
            </div>
        </div>`;
}

export function loadingPage() {
    return `
        <div class="loading-page" role="status" aria-label="Cargando información">
            <div class="skeleton title"></div>
            <div class="skeleton text"></div>
            <div class="row g-3 mt-4">
                ${Array.from({ length: 4 }, () => '<div class="col-6 col-xl-3"><div class="skeleton card"></div></div>').join('')}
            </div>
            <div class="skeleton mt-4" style="height: 18rem; border-radius: .9rem;"></div>
        </div>`;
}

export function errorPanel(message) {
    return `
        <div class="alert alert-danger d-flex gap-2 align-items-start" role="alert">
            <i class="bi bi-exclamation-octagon-fill mt-1" aria-hidden="true"></i>
            <div>
                <strong>No se pudo cargar la información.</strong>
                <div class="mt-1">${escapeHtml(message)}</div>
                <div class="small mt-2 opacity-75">Use «Actualizar» para reintentar.</div>
            </div>
        </div>`;
}

export function pageHeader({ eyebrow, title, subtitle, actions = '' }) {
    return `
        <div class="page-head">
            <div>
                <span class="eyebrow">${escapeHtml(eyebrow)}</span>
                <h1>${escapeHtml(title)}</h1>
                <p>${escapeHtml(subtitle)}</p>
            </div>
            ${actions ? `<div class="page-actions">${actions}</div>` : ''}
        </div>`;
}

export function statCard({ label, value, detail, icon, tone = 'blue' }) {
    return `
        <div class="col-6 col-xl-3">
            <div class="stat-card tone-${escapeHtml(tone)}">
                <div class="stat-top">
                    <span class="stat-label">${escapeHtml(label)}</span>
                    <span class="stat-icon"><i class="bi bi-${escapeHtml(icon)}" aria-hidden="true"></i></span>
                </div>
                <div class="stat-value">${escapeHtml(value)}</div>
                <div class="stat-detail">${escapeHtml(detail)}</div>
            </div>
        </div>`;
}

export function distributionRows(data, colorMap = {}) {
    const entries = Object.entries(data || {});
    const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);

    if (!entries.length) {
        return '<p class="text-secondary small mb-0">Sin datos para mostrar.</p>';
    }

    return entries.map(([label, rawValue]) => {
        const value = Number(rawValue || 0);
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        const color = colorMap[label] || 'var(--sgmi-blue)';
        return `
            <div class="dist-row">
                <div class="dist-meta">
                    <span>${escapeHtml(label)}</span>
                    <strong>${formatNumber(value)} <span class="fw-normal text-secondary">· ${percent}%</span></strong>
                </div>
                <div class="progress" role="progressbar" aria-label="${escapeHtml(label)}"
                     aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${total || 0}">
                    <div class="progress-bar" style="width: ${percent}%; background-color: ${color};"></div>
                </div>
            </div>`;
    }).join('');
}
