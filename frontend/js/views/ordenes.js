import { api } from '../api.js';
import {
    criticityBadge,
    criticityLevel,
    criticityScore,
    emptyState,
    errorPanel,
    escapeHtml,
    formatDateTime,
    estadoBadge,
    loadingPage,
    pageHeader,
    tipoBadge,
} from '../utils.js';
import {
    closeModal,
    confirmDialog,
    notifyDataChanged,
    openModal,
    setButtonBusy,
    showToast,
} from '../ui.js';

function render(orders, equipos) {
    return `
        ${pageHeader({
            eyebrow: 'Operación diaria',
            title: 'Órdenes de mantenimiento',
            subtitle: 'Registro, consulta y cambio de estado. Solo las órdenes PENDIENTE se pueden modificar, cerrar o cancelar.',
            actions: `
                <button type="button" class="btn btn-primary" id="btn-new-order" ${equipos.length ? '' : 'disabled'}>
                    <i class="bi bi-plus-lg" aria-hidden="true"></i> Nueva orden
                </button>`,
        })}

        ${!equipos.length ? `
            <div class="alert alert-warning d-flex align-items-center gap-2" role="alert">
                <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
                <span>Registre primero un equipo para poder crear órdenes.</span>
            </div>` : ''}

        <section class="panel mb-3" aria-label="Filtros de órdenes">
            <div class="panel-body py-3">
                <div class="row g-2 align-items-end">
                    <div class="col-12 col-lg-5">
                        <label class="form-label" for="orders-search">Buscar</label>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
                            <input type="search" class="form-control" id="orders-search"
                                   placeholder="ID, consecutivo, equipo, tipo o descripción">
                        </div>
                    </div>
                    <div class="col-6 col-lg-2">
                        <label class="form-label" for="orders-state">Estado</label>
                        <select class="form-select form-select-sm" id="orders-state">
                            <option value="">Todos</option>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="CERRADA">Cerrada</option>
                            <option value="CANCELADA">Cancelada</option>
                        </select>
                    </div>
                    <div class="col-6 col-lg-2">
                        <label class="form-label" for="orders-criticity">Criticidad</label>
                        <select class="form-select form-select-sm" id="orders-criticity">
                            <option value="">Todas</option>
                            <option value="ALTA">Alta</option>
                            <option value="MEDIA">Media</option>
                            <option value="BAJA">Baja</option>
                        </select>
                    </div>
                    <div class="col-12 col-lg-3 d-flex gap-2">
                        <button type="button" class="btn btn-sm btn-outline-secondary flex-fill" id="orders-clear">
                            <i class="bi bi-eraser" aria-hidden="true"></i> Limpiar
                        </button>
                        <span class="small text-secondary align-self-center" id="orders-count">${orders.length} órdenes</span>
                    </div>
                </div>
            </div>
        </section>

        <div class="d-flex flex-wrap gap-2 mb-3">
            <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-edit-order" disabled>
                <i class="bi bi-pencil" aria-hidden="true"></i> Modificar
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-close-order" disabled>
                <i class="bi bi-check2-circle" aria-hidden="true"></i> Cerrar
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger" id="btn-cancel-order" disabled>
                <i class="bi bi-x-circle" aria-hidden="true"></i> Cancelar
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-detail-order" disabled>
                <i class="bi bi-eye" aria-hidden="true"></i> Ver detalle
            </button>
        </div>

        <section class="panel" aria-labelledby="orders-table-title">
            <div class="panel-header">
                <div>
                    <h2 class="panel-title" id="orders-table-title">Historial de órdenes</h2>
                    <p class="panel-subtitle"></p>
                </div>
                <span class="section-label">Seleccione una fila</span>
            </div>
            <div class="panel-body pt-0">
                <div class="table-responsive" style="max-height: 34rem;">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th scope="col">ID</th>
                                <th scope="col">Consecutivo</th>
                                <th scope="col">Equipo</th>
                                <th scope="col">Tipo</th>
                                <th scope="col">Descripción</th>
                                <th scope="col">Impacto</th>
                                <th scope="col">Riesgo</th>
                                <th scope="col">Respaldo</th>
                                <th scope="col">Criticidad</th>
                                <th scope="col">Estado</th>
                                <th scope="col">Creada</th>
                            </tr>
                        </thead>
                        <tbody id="orders-tbody"></tbody>
                    </table>
                </div>
                <p class="small text-secondary mt-2 mb-0" id="orders-empty"></p>
            </div>
        </section>`;
}

export async function mount(root) {
    let active = true;
    let orders = [];
    let equipos = [];
    let selectedId = null;
    let filters = { q: '', estado: '', criticidad: '' };

    function filteredOrders() {
        const term = filters.q.trim().toLowerCase();
        return orders.filter((order) => {
            if (filters.estado && order.estado !== filters.estado) return false;
            if (filters.criticidad && order.criticidad !== filters.criticidad) return false;
            if (!term) return true;
            return [
                `om-${order.id}`,
                String(order.id),
                String(order.consecutivo),
                order.codigoEquipo,
                order.tipo,
                order.descripcion,
            ].join(' ').toLowerCase().includes(term);
        });
    }

    function selectedOrder() {
        return orders.find((order) => Number(order.id) === Number(selectedId)) || null;
    }

    function updateActions() {
        const order = selectedOrder();
        const pending = order?.estado === 'PENDIENTE';
        const edit = root.querySelector('#btn-edit-order');
        const close = root.querySelector('#btn-close-order');
        const cancel = root.querySelector('#btn-cancel-order');
        const detail = root.querySelector('#btn-detail-order');
        if (edit) edit.disabled = !pending;
        if (close) close.disabled = !pending;
        if (cancel) cancel.disabled = !pending;
        if (detail) detail.disabled = !order;
    }

    function refreshTable() {
        const rows = filteredOrders();
        if (selectedId && !rows.some((order) => Number(order.id) === Number(selectedId))) {
            selectedId = null;
        }

        const tbody = root.querySelector('#orders-tbody');
        const count = root.querySelector('#orders-count');
        const empty = root.querySelector('#orders-empty');
        if (count) count.textContent = `${rows.length} de ${orders.length} órdenes`;
        if (!tbody) return;

        tbody.innerHTML = rows.length
            ? rows.map((order) => `
                <tr data-id="${escapeHtml(order.id)}" class="${Number(order.id) === Number(selectedId) ? 'selected-row' : ''}">
                    <td class="mono text-secondary">OM-${escapeHtml(order.id)}</td>
                    <td class="mono">#${escapeHtml(order.consecutivo)}</td>
                    <td class="mono text-code">${escapeHtml(order.codigoEquipo)}</td>
                    <td>${tipoBadge(order.tipo)}</td>
                    <td class="description-cell">${escapeHtml(order.descripcion)}</td>
                    <td class="mono">${escapeHtml(order.impacto)}/3</td>
                    <td class="mono">${escapeHtml(order.riesgoSeguridad)}/3</td>
                    <td>${order.hayRespaldo ? 'Sí' : 'No'}</td>
                    <td>${criticityBadge(order.criticidad)}</td>
                    <td>${estadoBadge(order.estado)}</td>
                    <td class="text-secondary text-nowrap">${escapeHtml(formatDateTime(order.fechaCreacion))}</td>
                </tr>`).join('')
            : `<tr><td colspan="11">${emptyState({
                icon: orders.length ? 'search' : 'inbox',
                title: orders.length ? 'Sin coincidencias' : 'No hay órdenes registradas',
                description: orders.length
                    ? 'Ajuste los filtros o limpie la búsqueda.'
                    : 'Cree la primera orden desde el botón «Nueva orden».',
            })}</td></tr>`;

        if (empty) {
            empty.textContent = rows.length === 0 && orders.length > 0
                ? 'No hay órdenes que coincidan con los filtros aplicados.'
                : '';
        }
        updateActions();
    }

    function attachEvents() {
        const tbody = root.querySelector('#orders-tbody');
        const search = root.querySelector('#orders-search');
        const state = root.querySelector('#orders-state');
        const criticity = root.querySelector('#orders-criticity');

        search?.addEventListener('input', (event) => {
            filters.q = event.target.value;
            refreshTable();
        });
        state?.addEventListener('change', (event) => {
            filters.estado = event.target.value;
            refreshTable();
        });
        criticity?.addEventListener('change', (event) => {
            filters.criticidad = event.target.value;
            refreshTable();
        });
        root.querySelector('#orders-clear')?.addEventListener('click', () => {
            filters = { q: '', estado: '', criticidad: '' };
            if (search) search.value = '';
            if (state) state.value = '';
            if (criticity) criticity.value = '';
            refreshTable();
        });

        tbody?.addEventListener('click', (event) => {
            const row = event.target.closest('tr[data-id]');
            if (!row) return;
            selectedId = Number(row.dataset.id);
            refreshTable();
        });
        tbody?.addEventListener('dblclick', (event) => {
            const row = event.target.closest('tr[data-id]');
            if (!row) return;
            selectedId = Number(row.dataset.id);
            updateActions();
            const order = selectedOrder();
            if (order) showDetail(order);
        });

        root.querySelector('#btn-new-order')?.addEventListener('click', () => openForm(null));
        root.querySelector('#btn-edit-order')?.addEventListener('click', () => {
            const order = selectedOrder();
            if (order) openForm(order);
        });
        root.querySelector('#btn-close-order')?.addEventListener('click', () => {
            const order = selectedOrder();
            if (order) changeStatus(order, 'cerrar');
        });
        root.querySelector('#btn-cancel-order')?.addEventListener('click', () => {
            const order = selectedOrder();
            if (order) changeStatus(order, 'cancelar');
        });
        root.querySelector('#btn-detail-order')?.addEventListener('click', () => {
            const order = selectedOrder();
            if (order) showDetail(order);
        });
    }

    function updatePreview(form, scoreElement, levelElement) {
        const impacto = Number(form.impacto.value);
        const riesgo = Number(form.riesgoSeguridad.value);
        const respaldo = form.hayRespaldo.checked;
        const score = criticityScore(impacto, riesgo, respaldo);
        const level = criticityLevel(impacto, riesgo, respaldo);
        scoreElement.textContent = `${score} pts`;
        levelElement.innerHTML = criticityBadge(level);
    }

    function openForm(order = null) {
        if (!order && !equipos.length) {
            showToast('Registre primero un equipo para poder crear órdenes.', 'warning');
            return;
        }

        const editing = Boolean(order);
        const equipmentOptions = equipos.map((equipo) => `
            <option value="${escapeHtml(equipo.codigo)}" ${equipo.codigo === order?.codigoEquipo ? 'selected' : ''}>
                ${escapeHtml(equipo.codigo)} — ${escapeHtml(equipo.nombre)}
            </option>`).join('');

        const impact = Number(order?.impacto ?? 2);
        const risk = Number(order?.riesgoSeguridad ?? 2);
        const backup = Boolean(order?.hayRespaldo ?? false);

        const { element, modal } = openModal({
            title: editing ? `Modificar OM-${order.id}` : 'Nueva orden de mantenimiento',
            icon: editing ? 'pencil-square' : 'plus-circle',
            size: 'modal-lg',
            body: `
                <form id="order-form" novalidate>
                    <div id="order-form-error"></div>
                    <div class="row g-3">
                        <div class="col-12">
                            <label class="form-label" for="order-equipment">Equipo industrial <span class="text-danger">*</span></label>
                            <select class="form-select" id="order-equipment" name="codigoEquipo" required ${editing ? 'disabled' : ''}>
                                ${equipmentOptions}
                            </select>
                            <div class="form-text">
                                ${editing
                                    ? 'El equipo no se modifica: la orden conserva su equipo original.'
                                    : 'El id y el consecutivo los genera PostgreSQL al confirmar.'}
                            </div>
                        </div>
                        <div class="col-12 col-md-6">
                            <label class="form-label" for="order-type">Tipo de mantenimiento <span class="text-danger">*</span></label>
                            <select class="form-select" id="order-type" name="tipo" required>
                                <option value="CORRECTIVO" ${order?.tipo === 'CORRECTIVO' ? 'selected' : ''}>CORRECTIVO</option>
                                <option value="PREVENTIVO" ${order?.tipo === 'PREVENTIVO' ? 'selected' : ''}>PREVENTIVO</option>
                            </select>
                        </div>
                        <div class="col-12 col-md-6 d-flex align-items-end">
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="order-backup" name="hayRespaldo" ${backup ? 'checked' : ''}>
                                <label class="form-check-label" for="order-backup">Hay respaldo / redundancia (sin recargo)</label>
                            </div>
                        </div>
                        <div class="col-12">
                            <label class="form-label" for="order-description">Descripción de la falla o solicitud <span class="text-danger">*</span></label>
                            <textarea class="form-control" id="order-description" name="descripcion" rows="3"
                                      required placeholder="Fuga de vapor en la caldera…">${escapeHtml(order?.descripcion || '')}</textarea>
                        </div>
                        <div class="col-12 col-md-6">
                            <label class="form-label" for="order-impact">Impacto en producción: <b id="impact-value">${impact}</b>/3</label>
                            <input type="range" class="form-range" id="order-impact" name="impacto" min="1" max="3" step="1" value="${impact}">
                            <div class="d-flex justify-content-between small text-secondary"><span>1 · Bajo</span><span>2 · Medio</span><span>3 · Alto</span></div>
                        </div>
                        <div class="col-12 col-md-6">
                            <label class="form-label" for="order-risk">Riesgo para la seguridad: <b id="risk-value">${risk}</b>/3</label>
                            <input type="range" class="form-range" id="order-risk" name="riesgoSeguridad" min="1" max="3" step="1" value="${risk}">
                            <div class="d-flex justify-content-between small text-secondary"><span>1 · Bajo</span><span>2 · Medio</span><span>3 · Alto</span></div>
                        </div>
                        <div class="col-12">
                            <div class="criteria-preview d-flex align-items-center justify-content-between gap-3 flex-wrap">
                                <div>
                                    <div class="section-label">Puntaje calculado</div>
                                    <div class="criteria-score" id="order-score">—</div>
                                </div>
                                <div class="text-end">
                                    <div class="section-label mb-1">Nivel asignado</div>
                                    <div id="order-level">—</div>
                                </div>
                            </div>
                            <div class="form-text mt-2">2 × impacto + 2 × riesgo + 2 si no hay respaldo. ALTA ≥ 11 pts o riesgo 3; MEDIA ≥ 7; BAJA en otro caso.</div>
                        </div>
                    </div>
                </form>`,
            footer: `
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary" form="order-form" id="order-submit">
                    <i class="bi bi-floppy" aria-hidden="true"></i> ${editing ? 'Guardar cambios' : 'Registrar y encolar'}
                </button>`,
        });

        const form = element.querySelector('#order-form');
        const errorBox = element.querySelector('#order-form-error');
        const submit = element.querySelector('#order-submit');
        const scoreElement = element.querySelector('#order-score');
        const levelElement = element.querySelector('#order-level');
        const impactValue = element.querySelector('#impact-value');
        const riskValue = element.querySelector('#risk-value');

        const update = () => {
            impactValue.textContent = form.impacto.value;
            riskValue.textContent = form.riesgoSeguridad.value;
            updatePreview(form, scoreElement, levelElement);
        };
        form.addEventListener('input', update);
        update();

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorBox.innerHTML = '';

            const tipo = form.tipo.value;
            const descripcion = form.descripcion.value.trim();
            const impacto = Number(form.impacto.value);
            const riesgoSeguridad = Number(form.riesgoSeguridad.value);
            const hayRespaldo = form.hayRespaldo.checked;

            if (!descripcion) {
                errorBox.innerHTML = '<div class="alert alert-warning py-2">La descripción es obligatoria.</div>';
                form.descripcion.focus();
                return;
            }
            if (!form.reportValidity()) return;

            setButtonBusy(submit, true, editing ? 'Guardando…' : 'Registrando…');
            try {
                if (editing) {
                    await api.ordenes.actualizar(order.id, { tipo, descripcion, impacto, riesgoSeguridad, hayRespaldo });
                    showToast(`OM-${order.id} modificada y repriorizada.`);
                } else {
                    const codigoEquipo = form.codigoEquipo.value;
                    await api.ordenes.crear({ codigoEquipo, tipo, descripcion, impacto, riesgoSeguridad, hayRespaldo });
                    showToast('Orden registrada, persistida y encolada.');
                }
                modal.hide();
                selectedId = null;
                notifyDataChanged();
                await load();
            } catch (error) {
                errorBox.innerHTML = `<div class="alert alert-danger py-2 mb-3">${escapeHtml(error.message)}</div>`;
                setButtonBusy(submit, false);
            }
        });
    }

    async function changeStatus(order, action) {
        const closing = action === 'cerrar';
        const confirmed = await confirmDialog({
            title: closing ? 'Cerrar orden' : 'Cancelar orden',
            message: `¿${closing ? 'Cerrar' : 'Cancelar'} la orden OM-${order.id} (${order.codigoEquipo})?`,
            details: closing
                ? 'Pasará a estado CERRADA, saldrá de la cola y podrá deshacerse desde el historial.'
                : 'Pasará a estado CANCELADA, saldrá de la cola y podrá deshacerse desde el historial.',
            confirmText: closing ? 'Cerrar orden' : 'Cancelar orden',
            variant: closing ? 'primary' : 'danger',
            icon: closing ? 'check2-circle' : 'x-circle',
        });
        if (!confirmed) return;

        try {
            if (closing) {
                await api.ordenes.cerrar(order.id);
                showToast(`OM-${order.id} cerrada y retirada de la cola.`);
            } else {
                await api.ordenes.cancelar(order.id);
                showToast(`OM-${order.id} cancelada y retirada de la cola.`);
            }
            selectedId = null;
            notifyDataChanged();
            await load();
        } catch (error) {
            showToast(error.message, 'danger');
        }
    }

    function showDetail(order) {
        const score = criticityScore(order.impacto, order.riesgoSeguridad, order.hayRespaldo);
        openModal({
            title: `Detalle de OM-${order.id}`,
            icon: 'clipboard-check',
            size: 'modal-lg',
            body: `
                <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                    <span class="order-id">OM-${escapeHtml(order.id)}</span>
                    ${tipoBadge(order.tipo)}
                    ${criticityBadge(order.criticidad)}
                    ${estadoBadge(order.estado)}
                </div>
                <p class="order-description">${escapeHtml(order.descripcion)}</p>
                <div class="detail-grid">
                    <dl class="detail-item"><dt>Consecutivo</dt><dd>#${escapeHtml(order.consecutivo)}</dd></dl>
                    <dl class="detail-item"><dt>Equipo</dt><dd class="mono text-code">${escapeHtml(order.codigoEquipo)}</dd></dl>
                    <dl class="detail-item"><dt>Impacto en producción</dt><dd>${escapeHtml(order.impacto)}/3</dd></dl>
                    <dl class="detail-item"><dt>Riesgo de seguridad</dt><dd>${escapeHtml(order.riesgoSeguridad)}/3</dd></dl>
                    <dl class="detail-item"><dt>Respaldo / redundancia</dt><dd>${order.hayRespaldo ? 'Sí' : 'No'}</dd></dl>
                    <dl class="detail-item"><dt>Puntaje de criticidad</dt><dd>${escapeHtml(score)} puntos</dd></dl>
                    <dl class="detail-item"><dt>Fecha de creación</dt><dd>${escapeHtml(formatDateTime(order.fechaCreacion))}</dd></dl>
                    <dl class="detail-item"><dt>Fecha de cierre</dt><dd>${escapeHtml(formatDateTime(order.fechaCierre))}</dd></dl>
                </div>`,
            footer: '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button>',
        });
    }

    async function load() {
        if (!active) return;
        root.innerHTML = loadingPage();
        try {
            const [ordersData, equiposData] = await Promise.all([api.ordenes.listar(), api.equipos.listar()]);
            if (!active) return;
            orders = Array.isArray(ordersData) ? ordersData : [];
            equipos = Array.isArray(equiposData) ? equiposData : [];
            root.innerHTML = render(orders, equipos);
            attachEvents();
            refreshTable();
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
