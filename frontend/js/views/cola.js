import { api } from '../api.js';
import {
    criticityBadge,
    criticityScore,
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

function render(queue) {
    const first = queue[0] || null;
    const topContent = first ? `
        <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span class="order-id">OM-${escapeHtml(first.id)}</span>
            <span class="badge badge-tipo">${escapeHtml(first.tipo)}</span>
            ${criticityBadge(first.criticidad)}
            <span class="badge rounded-pill text-bg-dark border border-secondary-subtle">
                ${criticityScore(first.impacto, first.riesgoSeguridad, first.hayRespaldo)} pts
            </span>
        </div>
        <p class="mb-1 fw-semibold text-code">${escapeHtml(first.codigoEquipo)}</p>
        <p class="order-description mb-2">“${escapeHtml(first.descripcion)}”</p>
        <p class="criteria-line mb-0">
            Impacto ${escapeHtml(first.impacto)}/3 · Riesgo ${escapeHtml(first.riesgoSeguridad)}/3 ·
            Respaldo ${first.hayRespaldo ? 'Sí' : 'No (+2 pts)'} · Consecutivo #${escapeHtml(first.consecutivo)}
        </p>
        <p class="small text-secondary mt-2 mb-0">Creada: ${escapeHtml(formatDateTime(first.fechaCreacion))}</p>`
        : emptyState({
            icon: 'check2-circle',
            title: 'La cola está vacía',
            description: 'No hay órdenes pendientes. Registre una orden para encolarla en el heap.',
        });

    const rows = queue.length
        ? queue.map((order, index) => `
            <tr data-id="${escapeHtml(order.id)}" class="${index === 0 ? 'top-row' : ''}">
                <td class="mono ${index === 0 ? 'text-warning' : 'text-secondary'}">${index === 0 ? '1º · tope' : `${index + 1}º`}</td>
                <td class="mono">OM-${escapeHtml(order.id)}</td>
                <td class="mono text-code">${escapeHtml(order.codigoEquipo)}</td>
                <td>${escapeHtml(order.tipo)}</td>
                <td class="mono">${criticityScore(order.impacto, order.riesgoSeguridad, order.hayRespaldo)} pts</td>
                <td>${criticityBadge(order.criticidad)}</td>
                <td class="description-cell">${escapeHtml(order.descripcion)}</td>
            </tr>`).join('')
        : `<tr><td colspan="7">${emptyState({
            icon: 'inbox',
            title: 'Sin órdenes pendientes',
            description: 'La cola de prioridad no tiene elementos.',
        })}</td></tr>`;

    return `
        ${pageHeader({
            eyebrow: 'Heap binario',
            title: 'Cola de prioridad',
            subtitle: 'Órdenes PENDIENTE ordenadas por el heap: mayor criticidad y, en empate, el menor consecutivo.',
            actions: `
                <a class="btn btn-outline-secondary" href="#/ordenes">
                    <i class="bi bi-clipboard-check" aria-hidden="true"></i> Ver órdenes
                </a>`,
        })}

        <section class="panel top-order-card mb-3" aria-labelledby="queue-top-title">
            <div class="panel-header">
                <div>
                    <h2 class="panel-title" id="queue-top-title">
                        <i class="bi bi-lightning-charge me-1 text-info" aria-hidden="true"></i>
                        Siguiente orden a atender
                    </h2>
                    <p class="panel-subtitle">El orden lo calcula la estructura del backend; la interfaz no reordena la cola.</p>
                </div>
                <span class="badge rounded-pill text-bg-primary">TOPE DEL HEAP · RAÍZ O(1)</span>
            </div>
            <div class="panel-body position-relative">
                <div class="d-flex flex-wrap align-items-start justify-content-between gap-3">
                    <div class="flex-grow-1">${topContent}</div>
                    <button type="button" class="btn btn-primary position-relative" id="btn-attend-next"
                            style="z-index: 1;" ${queue.length ? '' : 'disabled'}>
                        <i class="bi bi-check2-circle" aria-hidden="true"></i> Atender la más prioritaria
                    </button>
                </div>
            </div>
        </section>

        <section class="panel" aria-labelledby="queue-table-title">
            <div class="panel-header">
                <div>
                    <h2 class="panel-title" id="queue-table-title">Órdenes pendientes en la cola</h2>
                    <p class="panel-subtitle">Recorrido del heap sin modificar la estructura original.</p>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="section-label" id="queue-total">${queue.length} orden(es)</span>
                    <button type="button" class="btn btn-sm btn-outline-danger" id="btn-cancel-queue" disabled>
                        <i class="bi bi-x-circle" aria-hidden="true"></i> Cancelar seleccionada
                    </button>
                </div>
            </div>
            <div class="panel-body pt-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th scope="col">Pos. heap</th>
                                <th scope="col">ID</th>
                                <th scope="col">Equipo</th>
                                <th scope="col">Tipo</th>
                                <th scope="col">Puntaje</th>
                                <th scope="col">Criticidad</th>
                                <th scope="col">Descripción</th>
                            </tr>
                        </thead>
                        <tbody id="queue-tbody">${rows}</tbody>
                    </table>
                </div>
            </div>
        </section>`;
}

export async function mount(root) {
    let active = true;
    let queue = [];
    let selectedId = null;

    function selectedOrder() {
        return queue.find((order) => Number(order.id) === Number(selectedId)) || null;
    }

    function updateCancelButton() {
        const button = root.querySelector('#btn-cancel-queue');
        if (button) button.disabled = !selectedOrder();
    }

    function attachEvents() {
        root.querySelector('#queue-tbody')?.addEventListener('click', (event) => {
            const row = event.target.closest('tr[data-id]');
            if (!row) return;
            selectedId = Number(row.dataset.id);
            root.querySelectorAll('#queue-tbody tr[data-id]').forEach((item) => item.classList.remove('selected-row'));
            row.classList.add('selected-row');
            updateCancelButton();
        });

        root.querySelector('#btn-attend-next')?.addEventListener('click', attendNext);
        root.querySelector('#btn-cancel-queue')?.addEventListener('click', () => {
            const order = selectedOrder();
            if (order) cancelOrder(order);
        });
    }

    async function attendNext() {
        const first = queue[0];
        if (!first) return;

        const confirmed = await confirmDialog({
            title: 'Atender la orden más prioritaria',
            message: `¿Atender y cerrar la orden OM-${first.id} (${first.codigoEquipo})?`,
            details: 'Pasará a estado CERRADA en PostgreSQL y saldrá de la cola. Podrá deshacerse desde el historial.',
            confirmText: 'Atender y cerrar',
            variant: 'primary',
            icon: 'check2-circle',
        });
        if (!confirmed) return;

        try {
            await api.ordenes.atenderSiguiente();
            showToast('Orden prioritaria atendida y cerrada.');
            selectedId = null;
            notifyDataChanged();
            await load();
        } catch (error) {
            showToast(error.message, 'danger');
        }
    }

    async function cancelOrder(order) {
        const confirmed = await confirmDialog({
            title: 'Cancelar orden',
            message: `¿Cancelar la orden OM-${order.id} (${order.codigoEquipo})?`,
            details: 'Pasará a estado CANCELADA y saldrá de la cola. Podrá deshacerse desde el historial.',
            confirmText: 'Cancelar orden',
        });
        if (!confirmed) return;

        try {
            await api.ordenes.cancelar(order.id);
            showToast(`OM-${order.id} cancelada y retirada de la cola.`);
            selectedId = null;
            notifyDataChanged();
            await load();
        } catch (error) {
            showToast(error.message, 'danger');
        }
    }

    async function load() {
        if (!active) return;
        root.innerHTML = loadingPage();
        try {
            const data = await api.ordenes.cola();
            if (!active) return;
            queue = Array.isArray(data) ? data : [];
            root.innerHTML = render(queue);
            attachEvents();
            updateCancelButton();
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
