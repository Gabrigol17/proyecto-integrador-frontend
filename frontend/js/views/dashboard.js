import { api } from '../api.js';
import {
    criticityBadge,
    criticityLevel,
    criticityScore,
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
    const media = Number(stats.ordenesPorCriticidad?.MEDIA || 0);
    const baja = Number(stats.ordenesPorCriticidad?.BAJA || 0);

    const topOrder = first ? `
        <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span class="order-id">OM-${escapeHtml(first.id)}</span>
            <span class="badge badge-tipo">${escapeHtml(first.tipo)}</span>
            ${criticityBadge(first.criticidad || criticityLevel(first.impacto, first.riesgoSeguridad, first.hayRespaldo))}
            <span class="badge rounded-pill text-bg-dark border border-secondary-subtle">
                ${criticityScore(first.impacto, first.riesgoSeguridad, first.hayRespaldo)} pts
            </span>
        </div>
        <p class="mb-1 fw-semibold text-code">${escapeHtml(first.codigoEquipo)}</p>
        <p class="order-description mb-2">“${escapeHtml(first.descripcion)}”</p>
        <p class="criteria-line mb-0">
            Impacto ${escapeHtml(first.impacto)}/3 · Riesgo ${escapeHtml(first.riesgoSeguridad)}/3 ·
            Respaldo ${first.hayRespaldo ? 'Sí' : 'No (+2 pts)'} · Consecutivo #${escapeHtml(first.consecutivo)}
        </p>` : emptyState({
        icon: 'check2-circle',
        title: 'Sin órdenes pendientes',
        description: 'La cola de prioridad está vacía. Registre una orden para que aparezca aquí.',
    });

    return `
        ${pageHeader({
            eyebrow: 'Resumen operativo',
            title: 'Panel principal',
            subtitle: 'Indicadores calculados con las órdenes, equipos y áreas persistidos en PostgreSQL.',
            actions: `
                <a class="btn btn-outline-secondary" href="#/cola">
                    <i class="bi bi-sort-down" aria-hidden="true"></i> Abrir cola
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

        <div class="row g-3 mb-4">
            ${statCard({ label: 'Órdenes registradas', value: stats.totalOrdenes, detail: 'Histórico en PostgreSQL', icon: 'clipboard-data', tone: 'blue' })}
            ${statCard({ label: 'Pendientes', value: stats.pendientes, detail: 'En la cola de prioridad', icon: 'hourglass-split', tone: 'cyan' })}
            ${statCard({ label: 'Cerradas', value: stats.cerradas, detail: 'Atendidas', icon: 'check2-circle', tone: 'green' })}
            ${statCard({ label: 'Canceladas', value: stats.canceladas, detail: 'Retiradas de la cola', icon: 'x-circle', tone: 'red' })}
            ${statCard({ label: 'Equipos activos', value: stats.equiposEnIndice, detail: `Índice AVL · altura ${stats.alturaArbolEquipos}`, icon: 'diagram-3', tone: 'cyan' })}
            ${statCard({ label: 'Criticidad alta', value: alta, detail: 'Órdenes históricas', icon: 'exclamation-triangle', tone: 'red' })}
            ${statCard({ label: 'Criticidad media', value: media, detail: 'Órdenes históricas', icon: 'dash-circle', tone: 'amber' })}
            ${statCard({ label: 'Criticidad baja', value: baja, detail: 'Órdenes históricas', icon: 'arrow-down-circle', tone: 'green' })}
        </div>

        <div class="row g-3">
            <div class="col-lg-8">
                <section class="panel top-order-card h-100" aria-labelledby="top-order-title">
                    <div class="panel-header">
                        <div>
                            <h2 class="panel-title" id="top-order-title">
                                <i class="bi bi-lightning-charge me-1 text-info" aria-hidden="true"></i>
                                Próxima orden a atender
                            </h2>
                            <p class="panel-subtitle">Tope de la cola de prioridad: mayor criticidad y, en empate, la más antigua.</p>
                        </div>
                        <span class="badge rounded-pill text-bg-primary">TOPE DEL HEAP · O(1)</span>
                    </div>
                    <div class="panel-body position-relative">
                        ${topOrder}
                        ${first ? `
                            <a class="btn btn-sm btn-outline-secondary mt-3 position-relative" href="#/cola" style="z-index: 1;">
                                <i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> Gestionar en la cola
                            </a>` : ''}
                    </div>
                </section>
            </div>

            <div class="col-lg-4">
                <section class="panel h-100" aria-labelledby="structures-title">
                    <div class="panel-header">
                        <div>
                            <h2 class="panel-title" id="structures-title">Estado de las estructuras</h2>
                            <p class="panel-subtitle">Estado actual del heap, del AVL y de la pila LIFO persistente.</p>
                        </div>
                    </div>
                    <div class="panel-body">
                        <div class="row g-2">
                            <div class="col-6">
                                <div class="structure-tile">
                                    <div class="structure-name">Cola de prioridad</div>
                                    <div class="structure-value">${escapeHtml(stats.ordenesEnCola)}</div>
                                    <div class="structure-detail">Órdenes pendientes en el heap</div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="structure-tile">
                                    <div class="structure-name">Índice AVL</div>
                                    <div class="structure-value">${escapeHtml(stats.equiposEnIndice)}</div>
                                    <div class="structure-detail">Equipos indexados</div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="structure-tile">
                                    <div class="structure-name">Altura AVL</div>
                                    <div class="structure-value">${escapeHtml(stats.alturaArbolEquipos)}</div>
                                    <div class="structure-detail">Autobalanceado · |fb| ≤ 1</div>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="structure-tile">
                                    <div class="structure-name">Pila de acciones</div>
                                    <div class="structure-value">${escapeHtml(stats.accionesPorDeshacer)}</div>
                                    <div class="structure-detail">Acciones por deshacer</div>
                                </div>
                            </div>
                        </div>
                        <p class="small text-secondary mt-3 mb-0">
                            <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
                            La pila de acciones se persiste y se conserva al reiniciar el backend.
                        </p>
                    </div>
                </section>
            </div>
        </div>`;
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
                    subtitle: 'No se pudieron recuperar los indicadores.',
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
