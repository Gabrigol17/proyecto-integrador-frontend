import { api } from '../api.js';
import {
    criticityBadge,
    criticityLevel,
    emptyState,
    errorPanel,
    escapeHtml,
    loadingPage,
    pageHeader,
    statCard,
} from '../utils.js';

function render(stats, queue) {
    const first = queue[0] || null;
    const alta = Number(stats.ordenesPorCriticidad?.ALTA || 0);

    const topOrder = first ? `
        <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span class="order-id">OM-${escapeHtml(first.id)}</span>
            <span class="badge badge-tipo">${escapeHtml(first.tipo)}</span>
            ${criticityBadge(first.criticidad || criticityLevel(first.impacto, first.riesgoSeguridad, first.hayRespaldo))}
        </div>
        <p class="mb-1 fw-semibold text-code">${escapeHtml(first.codigoEquipo)}</p>
        <p class="order-description mb-2">“${escapeHtml(first.descripcion)}”</p>
        <p class="criteria-line mb-0">
            Impacto ${escapeHtml(first.impacto)}/3 · Riesgo ${escapeHtml(first.riesgoSeguridad)}/3 ·
            Respaldo ${first.hayRespaldo ? 'Sí' : 'No'}
        </p>` : emptyState({
        icon: 'check2-circle',
        title: 'Sin órdenes pendientes',
        description: 'No hay órdenes pendientes. Registra una orden para que aparezca aquí.',
    });

    return `
        ${pageHeader({
            eyebrow: 'Resumen operativo',
            title: 'Panel principal',
            subtitle: 'Resumen del estado de mantenimiento de la planta.',
            actions: `
                <a class="btn btn-outline-secondary" href="#/cola">
                    <i class="bi bi-sort-down" aria-hidden="true"></i> Ver pendientes
                </a>
                <a class="btn btn-primary" href="#/ordenes">
                    <i class="bi bi-plus-lg" aria-hidden="true"></i> Ir a órdenes
                </a>`,
        })}

        ${Number(stats.totalOrdenes) === 0 ? `
            <div class="alert alert-info d-flex align-items-center gap-2" role="alert">
                <i class="bi bi-info-circle-fill" aria-hidden="true"></i>
                <span>No hay órdenes registradas todavía. Cree la primera desde «Órdenes de mantenimiento».</span>
            </div>` : ''}

        <section class="panel top-order-card mb-4" aria-labelledby="top-order-title">
            <div class="panel-header">
                <div>
                    <h2 class="panel-title" id="top-order-title">
                        <i class="bi bi-lightning-charge me-1 text-info" aria-hidden="true"></i>
                        Próxima orden a atender
                    </h2>
                    <p class="panel-subtitle">Se atiende primero la orden con mayor prioridad y antigüedad.</p>
                </div>
                <span class="badge rounded-pill text-bg-primary">PRÓXIMA EN ATENCIÓN</span>
            </div>
            <div class="panel-body position-relative">
                ${topOrder}
            </div>
        </section>

        <div class="row g-3">
            ${statCard({ label: 'Órdenes pendientes', value: stats.pendientes, detail: 'Por atender', icon: 'hourglass-split', tone: 'cyan' })}
            ${statCard({ label: 'Prioridad alta', value: alta, detail: 'En el historial', icon: 'exclamation-triangle', tone: 'red' })}
            ${statCard({ label: 'Equipos activos', value: stats.equiposEnIndice, detail: 'En la planta', icon: 'diagram-3', tone: 'green' })}
            ${statCard({ label: 'Órdenes registradas', value: stats.totalOrdenes, detail: 'En total', icon: 'clipboard-data', tone: 'blue' })}
        </div>

        <p class="small text-secondary mt-3 mb-0">
            <i class="bi bi-bar-chart-line me-1" aria-hidden="true"></i>
            Las distribuciones de órdenes cerradas, canceladas y de prioridad media o baja están en
            <a href="#/estadisticas">Indicadores y estadísticas</a>.
        </p>`;
}

export async function mount(root) {
    let active = true;
    root.innerHTML = loadingPage();

    async function load() {
        if (!active) return;
        root.innerHTML = loadingPage();
        try {
            const [stats, queue] = await Promise.all([api.estadisticas(), api.ordenes.cola()]);
            if (!active) return;
            root.innerHTML = render(stats, queue);
        } catch (error) {
            if (!active) return;
            root.innerHTML = `
                ${pageHeader({
                    eyebrow: 'Resumen operativo',
                    title: 'Panel principal',
                    subtitle: 'No se pudo cargar el resumen de la planta.',
                })}
                ${errorPanel(error.message)}`;
        }
    }

    await load();
    return {
        refresh: load,
        destroy: () => { active = false; },
    };
}
