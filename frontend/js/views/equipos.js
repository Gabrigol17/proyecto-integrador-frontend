import { api } from '../api.js';
import {
    emptyState,
    errorPanel,
    escapeHtml,
    formatNumber,
    loadingPage,
    pageHeader,
} from '../utils.js';
import {
    closeModal,
    confirmDialog,
    notifyDataChanged,
    openModal,
    setButtonBusy,
    showToast,
} from '../ui.js';

function areaName(areas, idArea) {
    return areas.find((area) => Number(area.idArea) === Number(idArea))?.nombre || `Área ${idArea}`;
}

function render(equipos, areas, stats) {
    const areaMap = new Map(areas.map((area) => [Number(area.idArea), area.nombre]));
    const rows = equipos.length
        ? equipos.map((equipo) => `
            <tr data-code="${escapeHtml(equipo.codigo)}">
                <td class="mono text-code">${escapeHtml(equipo.codigo)}</td>
                <td class="fw-semibold">${escapeHtml(equipo.nombre)}</td>
                <td>${escapeHtml(areaMap.get(Number(equipo.idArea)) || `Área ${equipo.idArea}`)}</td>
                <td class="mono text-secondary">${escapeHtml(equipo.idArea)}</td>
                <td class="text-end text-nowrap">
                    <button type="button" class="btn-table" data-action="edit" data-code="${escapeHtml(equipo.codigo)}"
                            title="Editar ${escapeHtml(equipo.codigo)}" aria-label="Editar ${escapeHtml(equipo.codigo)}">
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="btn-table danger" data-action="delete" data-code="${escapeHtml(equipo.codigo)}"
                            title="Eliminar ${escapeHtml(equipo.codigo)}" aria-label="Eliminar ${escapeHtml(equipo.codigo)}">
                        <i class="bi bi-trash3" aria-hidden="true"></i>
                    </button>
                </td>
            </tr>`).join('')
        : `<tr><td colspan="5">${emptyState({
            icon: 'diagram-3',
            title: 'No hay equipos registrados',
            description: 'Cree un área y después registre el primer equipo.',
        })}</td></tr>`;

    const indexChips = equipos.length
        ? equipos.map((equipo) => `<span class="index-chip">${escapeHtml(equipo.codigo)}</span>`).join('')
        : '<span class="text-secondary small">Índice vacío.</span>';

    return `
        ${pageHeader({
            eyebrow: 'Catálogo indexado',
            title: 'Equipos e índice AVL',
            subtitle: 'El backend devuelve los equipos en recorrido inorden. El código identifica al equipo y no se modifica desde la API.',
            actions: `
                <a class="btn btn-outline-secondary" href="#/areas">
                    <i class="bi bi-buildings" aria-hidden="true"></i> Gestionar áreas
                </a>
                <button type="button" class="btn btn-primary" id="btn-new-equipment" ${areas.length ? '' : 'disabled'}>
                    <i class="bi bi-plus-lg" aria-hidden="true"></i> Nuevo equipo
                </button>`,
        })}

        ${!areas.length ? `
            <div class="alert alert-warning d-flex align-items-center gap-2" role="alert">
                <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
                <span>No hay áreas registradas. Cree un área antes de registrar equipos.</span>
            </div>` : ''}

        <div class="row g-3 mb-3">
            <div class="col-6 col-lg-3">
                <div class="stat-card tone-cyan">
                    <div class="stat-top">
                        <span class="stat-label">Equipos indexados</span>
                        <span class="stat-icon"><i class="bi bi-diagram-3" aria-hidden="true"></i></span>
                    </div>
                    <div class="stat-value">${escapeHtml(equipos.length)}</div>
                    <div class="stat-detail">Recorrido inorden del AVL</div>
                </div>
            </div>
            <div class="col-6 col-lg-3">
                <div class="stat-card tone-amber">
                    <div class="stat-top">
                        <span class="stat-label">Altura del árbol</span>
                        <span class="stat-icon"><i class="bi bi-tree" aria-hidden="true"></i></span>
                    </div>
                    <div class="stat-value">${escapeHtml(stats.alturaArbolEquipos ?? '—')}</div>
                    <div class="stat-detail">Autobalanceado · |fb| ≤ 1</div>
                </div>
            </div>
            <div class="col-6 col-lg-3">
                <div class="stat-card tone-blue">
                    <div class="stat-top">
                        <span class="stat-label">Áreas disponibles</span>
                        <span class="stat-icon"><i class="bi bi-buildings" aria-hidden="true"></i></span>
                    </div>
                    <div class="stat-value">${escapeHtml(areas.length)}</div>
                    <div class="stat-detail">Para asignar equipos</div>
                </div>
            </div>
            <div class="col-6 col-lg-3">
                <div class="stat-card tone-green">
                    <div class="stat-top">
                        <span class="stat-label">Órdenes registradas</span>
                        <span class="stat-icon"><i class="bi bi-clipboard-check" aria-hidden="true"></i></span>
                    </div>
                    <div class="stat-value">${formatNumber(stats.totalOrdenes)}</div>
                    <div class="stat-detail">Histórico de la planta</div>
                </div>
            </div>
        </div>

        <section class="panel mb-3" aria-labelledby="avl-index-title">
            <div class="panel-header pb-2">
                <div>
                    <h2 class="panel-title" id="avl-index-title">Índice ordenado (inorden)</h2>
                    <p class="panel-subtitle">La API no expone la forma interna del árbol; sí su recorrido ordenado y su altura.</p>
                </div>
                <span class="badge rounded-pill text-bg-dark border border-secondary-subtle">
                    ${equipos.length} nodo(s) · altura ${escapeHtml(stats.alturaArbolEquipos ?? '—')}
                </span>
            </div>
            <div class="panel-body pt-2">
                <div class="index-strip" aria-label="Códigos de equipos en orden">${indexChips}</div>
            </div>
        </section>

        <section class="panel" aria-labelledby="equipment-table-title">
            <div class="panel-header">
                <div>
                    <h2 class="panel-title" id="equipment-table-title">Catálogo de equipos</h2>
                    <p class="panel-subtitle">Seleccione una fila para corregir nombre o área. El código no cambia.</p>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <div class="input-group input-group-sm" style="width: min(20rem, 55vw);">
                        <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
                        <input type="search" class="form-control" id="equipment-search"
                               placeholder="Código, nombre o área" aria-label="Buscar equipos">
                    </div>
                </div>
            </div>
            <div class="panel-body pt-0">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="small text-secondary" id="equipment-count">${equipos.length} equipo(s)</span>
                    <span class="small text-secondary">El código se guarda en mayúsculas al crear.</span>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th scope="col">Código</th>
                                <th scope="col">Nombre</th>
                                <th scope="col">Área</th>
                                <th scope="col">ID área</th>
                                <th scope="col" class="text-end">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="equipment-tbody">${rows}</tbody>
                    </table>
                </div>
            </div>
        </section>`;
}

export async function mount(root) {
    let active = true;
    let equipos = [];
    let areas = [];
    let stats = {};
    let filter = '';

    function filtered() {
        const term = filter.trim().toLowerCase();
        if (!term) return equipos;
        return equipos.filter((equipo) => {
            const haystack = [
                equipo.codigo,
                equipo.nombre,
                areaName(areas, equipo.idArea),
                String(equipo.idArea),
            ].join(' ').toLowerCase();
            return haystack.includes(term);
        });
    }

    function refreshTable() {
        const rows = filtered();
        const tbody = root.querySelector('#equipment-tbody');
        const count = root.querySelector('#equipment-count');
        if (count) count.textContent = `${rows.length} de ${equipos.length} equipo(s)`;
        if (!tbody) return;

        tbody.innerHTML = rows.length
            ? rows.map((equipo) => `
                <tr data-code="${escapeHtml(equipo.codigo)}">
                    <td class="mono text-code">${escapeHtml(equipo.codigo)}</td>
                    <td class="fw-semibold">${escapeHtml(equipo.nombre)}</td>
                    <td>${escapeHtml(areaName(areas, equipo.idArea))}</td>
                    <td class="mono text-secondary">${escapeHtml(equipo.idArea)}</td>
                    <td class="text-end text-nowrap">
                        <button type="button" class="btn-table" data-action="edit" data-code="${escapeHtml(equipo.codigo)}"
                                title="Editar ${escapeHtml(equipo.codigo)}" aria-label="Editar ${escapeHtml(equipo.codigo)}">
                            <i class="bi bi-pencil" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="btn-table danger" data-action="delete" data-code="${escapeHtml(equipo.codigo)}"
                                title="Eliminar ${escapeHtml(equipo.codigo)}" aria-label="Eliminar ${escapeHtml(equipo.codigo)}">
                            <i class="bi bi-trash3" aria-hidden="true"></i>
                        </button>
                    </td>
                </tr>`).join('')
            : `<tr><td colspan="5">${emptyState({
                icon: 'search',
                title: 'Sin coincidencias',
                description: 'No hay equipos que coincidan con la búsqueda.',
            })}</td></tr>`;
    }

    function attachEvents() {
        root.querySelector('#btn-new-equipment')?.addEventListener('click', () => openForm(null));
        root.querySelector('#equipment-search')?.addEventListener('input', (event) => {
            filter = event.target.value;
            refreshTable();
        });
        root.querySelector('#equipment-tbody')?.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action]');
            if (!button) return;
            const equipo = equipos.find((item) => item.codigo === button.dataset.code);
            if (!equipo) return;
            if (button.dataset.action === 'edit') openForm(equipo);
            if (button.dataset.action === 'delete') removeEquipment(equipo);
        });
    }

    function openForm(equipo = null) {
        if (!areas.length) {
            showToast('Cree un área antes de registrar equipos.', 'warning');
            return;
        }

        const editing = Boolean(equipo);
        const options = areas.map((area) => `
            <option value="${escapeHtml(area.idArea)}" ${Number(area.idArea) === Number(equipo?.idArea) ? 'selected' : ''}>
                ${escapeHtml(area.nombre)} (ID ${escapeHtml(area.idArea)})
            </option>`).join('');

        const { element, modal } = openModal({
            title: editing ? `Editar equipo ${equipo.codigo}` : 'Nuevo equipo',
            icon: editing ? 'pencil-square' : 'plus-circle',
            size: 'modal-md',
            body: `
                <form id="equipment-form" novalidate>
                    <div id="equipment-form-error"></div>
                    <div class="mb-3">
                        <label class="form-label" for="equipment-code">Código único <span class="text-danger">*</span></label>
                        <input class="form-control mono" id="equipment-code" name="codigo" maxlength="30"
                               required autocomplete="off" placeholder="EQ-008"
                               value="${escapeHtml(equipo?.codigo || '')}" ${editing ? 'readonly' : ''}>
                        <div class="form-text">
                            ${editing
                                ? 'El código es la clave primaria y la API no permite cambiarlo.'
                                : 'Máximo 30 caracteres. Se normaliza a mayúsculas.'}
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="equipment-name">Nombre del equipo <span class="text-danger">*</span></label>
                        <input class="form-control" id="equipment-name" name="nombre" maxlength="120"
                               required autocomplete="off" placeholder="Compresor auxiliar B"
                               value="${escapeHtml(equipo?.nombre || '')}">
                        <div class="form-text">Obligatorio, máximo 120 caracteres.</div>
                    </div>
                    <div class="mb-1">
                        <label class="form-label" for="equipment-area">Área industrial <span class="text-danger">*</span></label>
                        <select class="form-select" id="equipment-area" name="idArea" required>
                            <option value="">Seleccione un área…</option>
                            ${options}
                        </select>
                    </div>
                </form>`,
            footer: `
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary" form="equipment-form" id="equipment-submit">
                    <i class="bi bi-floppy" aria-hidden="true"></i> ${editing ? 'Guardar cambios' : 'Crear equipo'}
                </button>`,
        });

        const form = element.querySelector('#equipment-form');
        const errorBox = element.querySelector('#equipment-form-error');
        const submit = element.querySelector('#equipment-submit');

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorBox.innerHTML = '';

            const codigo = form.codigo.value.trim().toUpperCase();
            const nombre = form.nombre.value.trim();
            const idArea = Number(form.idArea.value);

            if (!editing && !codigo) {
                errorBox.innerHTML = '<div class="alert alert-warning py-2">El código es obligatorio.</div>';
                form.codigo.focus();
                return;
            }
            if (!nombre || !idArea) {
                errorBox.innerHTML = '<div class="alert alert-warning py-2">Complete el nombre y seleccione un área.</div>';
                return;
            }
            if (!form.reportValidity()) return;

            setButtonBusy(submit, true, editing ? 'Guardando…' : 'Creando…');
            try {
                if (editing) {
                    await api.equipos.actualizar(equipo.codigo, { nombre, idArea });
                    showToast(`Equipo ${equipo.codigo} actualizado.`);
                } else {
                    await api.equipos.crear({ codigo, nombre, idArea });
                    showToast(`Equipo ${codigo} creado e indexado.`);
                }
                modal.hide();
                notifyDataChanged();
                await load();
            } catch (error) {
                errorBox.innerHTML = `<div class="alert alert-danger py-2 mb-3">${escapeHtml(error.message)}</div>`;
                setButtonBusy(submit, false);
            }
        });
    }

    async function removeEquipment(equipo) {
        const confirmed = await confirmDialog({
            title: 'Eliminar equipo',
            message: `¿Eliminar definitivamente el equipo ${equipo.codigo} (${equipo.nombre})?`,
            details: 'Solo se elimina si no tiene órdenes asociadas. No se borra el historial en cascada.',
            confirmText: 'Eliminar equipo',
        });
        if (!confirmed) return;

        try {
            await api.equipos.eliminar(equipo.codigo);
            showToast(`Equipo ${equipo.codigo} eliminado.`);
            notifyDataChanged();
            await load();
        } catch (error) {
            const hint = error.status === 409
                ? ' El equipo tiene órdenes asociadas; primero gestione esas órdenes.'
                : '';
            showToast(`${error.message}${hint}`, 'danger');
        }
    }

    async function load() {
        if (!active) return;
        root.innerHTML = loadingPage();
        try {
            const [equiposData, areasData, statsData] = await Promise.all([
                api.equipos.listar(),
                api.areas.listar(),
                api.estadisticas(),
            ]);
            if (!active) return;
            equipos = Array.isArray(equiposData) ? equiposData : [];
            areas = Array.isArray(areasData) ? areasData : [];
            stats = statsData || {};
            root.innerHTML = render(equipos, areas, stats);
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
