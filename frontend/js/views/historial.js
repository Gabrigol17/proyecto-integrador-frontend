import { api } from '../api.js';
import {
    actionBadge,
    emptyState,
    errorPanel,
    escapeHtml,
    formatDateTime,
    loadingPage,
    pageHeader,
} from '../utils.js';
import {
    closeModal,
    confirmDialog,
    notifyDataChanged,
    showToast,
} from '../ui.js';

function render(actions) {
    const rows = actions.length
        ? actions.map((action, index) => {
            const previous = action.estadoPrevio || null;
            return `
                <tr class="${index === 0 ? 'top-row' : ''}">
                    <td class="mono ${index === 0 ? 'text-warning' : 'text-secondary'}">${index === 0 ? '1 · TOPE' : index + 1}</td>
                    <td>${actionBadge(action.tipo)}</td>
                    <td class="mono">OM-${escapeHtml(action.idOrden)}</td>
                    <td class="mono text-code">${escapeHtml(previous?.codigoEquipo || '—')}</td>
                    <td>${escapeHtml(previous?.estado || '—')}</td>
                    <td class="description-cell">${escapeHtml(previous?.descripcion || '—')}</td>
                    <td class="text-secondary text-nowrap">${escapeHtml(formatDateTime(action.fecha))}</td>
                </tr>`;
        }).join('')
        : `<tr><td colspan="7">${emptyState({
            icon: 'clock-history',
            title: 'La pila está vacía',
            description: 'No hay acciones disponibles para deshacer.',
        })}</td></tr>`;

    const top = actions[0] || null;

    return `
        ${pageHeader({
            eyebrow: 'Pila',
            title: 'Historial de acciones',
            subtitle: 'Cada operación guarda una copia del estado previo. La reversión se confirma en PostgreSQL antes de desapilar.',
            actions: `
                <button type="button" class="btn btn-warning" id="btn-undo-history" ${actions.length ? '' : 'disabled'}>
                    <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i> Deshacer última acción
                </button>`,
        })}

        <div class="row g-3">
            <div class="col-xl-8">
                <section class="panel" aria-labelledby="history-table-title">
                    <div class="panel-header">
                        <div>
                            <h2 class="panel-title" id="history-table-title">Acciones apiladas</h2>
                            <p class="panel-subtitle">El orden de la tabla es el orden real de la pila: el tope está arriba.</p>
                        </div>
                        <span class="badge rounded-pill text-bg-dark border border-secondary-subtle">${actions.length} acción(es)</span>
                    </div>
                    <div class="panel-body pt-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle">
                                <thead>
                                    <tr>
                                        <th scope="col">Posición</th>
                                        <th scope="col">Acción</th>
                                        <th scope="col">Orden</th>
                                        <th scope="col">Equipo</th>
                                        <th scope="col">Estado previo</th>
                                        <th scope="col">Descripción</th>
                                        <th scope="col">Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </div>

            <div class="col-xl-4">
                <section class="panel h-100" aria-labelledby="stack-properties-title">
                    <div class="panel-header">
                        <div>
                            <h2 class="panel-title" id="stack-properties-title">Propiedades de la pila</h2>
                            <p class="panel-subtitle">Estructura temporal en memoria del backend.</p>
                        </div>
                    </div>
                    <div class="panel-body">
                        <dl class="property-list">
                            <div>
                                <dt>Acciones disponibles</dt>
                                <dd class="fs-4 fw-bold text-warning">${actions.length}</dd>
                            </div>
                            <div>
                                <dt>Tope actual</dt>
                                <dd>
                                    ${top
                                        ? `${actionBadge(top.tipo)} <span class="mono ms-1">OM-${escapeHtml(top.idOrden)}</span>`
                                        : '<span class="text-secondary">Sin acciones registradas.</span>'}
                                </dd>
                            </div>
                            <div>
                                <dt>Última actualización</dt>
                                <dd>${top ? escapeHtml(formatDateTime(top.fecha)) : '—'}</dd>
                            </div>
                        </dl>


                        <p class="small text-secondary mt-3 mb-2">
                            Tipos registrados: CREAR, MODIFICAR, CANCELAR y CERRAR.
                        </p>
                        <p class="small text-secondary mb-0">
                            <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
                            La pila no se guarda en PostgreSQL: se pierde al reiniciar el backend.
                        </p>
                    </div>
                </section>
            </div>
        </div>`;
}

export async function mount(root) {
    let active = true;
    let actions = [];

    async function undo() {
        const top = actions[0];
        if (!top) {
            showToast('No hay acciones previas para deshacer.', 'warning');
            return;
        }

        const confirmed = await confirmDialog({
            title: 'Deshacer última acción',
            message: '¿Deshacer la acción en el tope de la pila?',
            details: `Tipo: ${top.tipo} · Orden: OM-${top.idOrden}. La reversión se aplicará primero en PostgreSQL.`,
            confirmText: 'Deshacer',
            variant: 'warning',
            icon: 'arrow-counterclockwise',
        });
        if (!confirmed) return;

        try {
            await api.ordenes.deshacer();
            showToast(`Se revirtió la acción ${top.tipo} de OM-${top.idOrden}.`);
            notifyDataChanged();
            await load();
        } catch (error) {
            showToast(error.message, 'danger');
        }
    }

    function attachEvents() {
        root.querySelector('#btn-undo-history')?.addEventListener('click', undo);
    }

    async function load() {
        if (!active) return;
        root.innerHTML = loadingPage();
        try {
            const data = await api.ordenes.historial();
            if (!active) return;
            actions = Array.isArray(data) ? data : [];
            root.innerHTML = render(actions);
            attachEvents();
        } catch (error) {
            if (!active) return;
            root.innerHTML = errorPanel(error.message);
        }
    }

    await load();
    return {
        refresh: load,
        destroy: () => {
            active = false;
            closeModal();
        },
    };
}
