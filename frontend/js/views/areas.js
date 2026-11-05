import { api } from '../api.js';
import {
    emptyState,
    errorPanel,
    escapeHtml,
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

function countByArea(equipos) {
    const counts = new Map();
    for (const equipo of equipos) {
        counts.set(Number(equipo.idArea), (counts.get(Number(equipo.idArea)) || 0) + 1);
    }
    return counts;
}

function render(areas, equipos) {
    const counts = countByArea(equipos);
    const rows = areas.length
        ? areas.map((area) => {
            const count = counts.get(Number(area.idArea)) || 0;
            return `
                <tr>
                    <td class="mono text-code">${escapeHtml(area.idArea)}</td>
                    <td class="fw-semibold">${escapeHtml(area.nombre)}</td>
                    <td class="text-secondary">${escapeHtml(area.descripcion || '—')}</td>
                    <td>
                        <span class="badge rounded-pill ${count ? 'text-bg-primary' : 'text-bg-secondary'}">${count}</span>
                    </td>
                    <td class="text-end text-nowrap">
                        <button type="button" class="btn-table" data-action="edit" data-id="${escapeHtml(area.idArea)}"
                                title="Editar ${escapeHtml(area.nombre)}" aria-label="Editar ${escapeHtml(area.nombre)}">
                            <i class="bi bi-pencil" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="btn-table danger" data-action="delete" data-id="${escapeHtml(area.idArea)}"
                                title="Eliminar ${escapeHtml(area.nombre)}" aria-label="Eliminar ${escapeHtml(area.nombre)}">
                            <i class="bi bi-trash3" aria-hidden="true"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('')
        : `<tr><td colspan="5">${emptyState({
            icon: 'buildings',
            title: 'No hay áreas registradas',
            description: 'Cree la primera área para poder asignar equipos.',
        })}</td></tr>`;

    return `
        ${pageHeader({
            eyebrow: 'Catálogo de la planta',
            title: 'Gestión de áreas',
            subtitle: 'CRUD completo sobre PostgreSQL. Un área con equipos asociados no se puede eliminar.',
            actions: `
                <button type="button" class="btn btn-primary" id="btn-new-area">
                    <i class="bi bi-plus-lg" aria-hidden="true"></i> Nueva área
                </button>`,
        })}

        <div class="summary-bar mb-3">
            <span><strong>${areas.length}</strong> área(s) registrada(s)</span>
            <span class="text-secondary">·</span>
            <span><strong>${equipos.length}</strong> equipo(s) asociados</span>
        </div>

        <section class="panel" aria-labelledby="areas-table-title">
            <div class="panel-header">
                <div>
                    <h2 class="panel-title" id="areas-table-title">Áreas registradas</h2>
                    <p class="panel-subtitle">El nombre es obligatorio y no puede repetirse, sin distinguir mayúsculas.</p>
                </div>
                <span class="section-label">${areas.length} fila(s)</span>
            </div>
            <div class="panel-body pt-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th scope="col">ID</th>
                                <th scope="col">Nombre</th>
                                <th scope="col">Descripción</th>
                                <th scope="col">Equipos</th>
                                <th scope="col" class="text-end">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </section>`;
}

export async function mount(root) {
    let active = true;
    let areas = [];
    let equipos = [];

    function attachEvents() {
        root.querySelector('#btn-new-area')?.addEventListener('click', () => openForm(null));
        root.querySelector('tbody')?.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action]');
            if (!button) return;
            const area = areas.find((item) => String(item.idArea) === button.dataset.id);
            if (!area) return;
            if (button.dataset.action === 'edit') openForm(area);
            if (button.dataset.action === 'delete') removeArea(area);
        });
    }

    function openForm(area = null) {
        const editing = Boolean(area);
        const { element, modal } = openModal({
            title: editing ? `Editar área ${area.nombre}` : 'Nueva área',
            icon: editing ? 'pencil-square' : 'plus-circle',
            size: 'modal-md',
            body: `
                <form id="area-form" novalidate>
                    <div id="area-form-error"></div>
                    <div class="mb-3">
                        <label class="form-label" for="area-nombre">Nombre <span class="text-danger">*</span></label>
                        <input class="form-control" id="area-nombre" name="nombre" maxlength="100" required
                               autocomplete="off" placeholder="Producción" value="${escapeHtml(area?.nombre || '')}">
                        <div class="form-text">Obligatorio, máximo 100 caracteres.</div>
                    </div>
                    <div class="mb-1">
                        <label class="form-label" for="area-descripcion">Descripción</label>
                        <textarea class="form-control" id="area-descripcion" name="descripcion" rows="3"
                                  maxlength="250" placeholder="Zona de envasado y empaque">${escapeHtml(area?.descripcion || '')}</textarea>
                        <div class="form-text">Opcional, máximo 250 caracteres.</div>
                    </div>
                </form>`,
            footer: `
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary" form="area-form" id="area-submit">
                    <i class="bi bi-floppy" aria-hidden="true"></i> ${editing ? 'Guardar cambios' : 'Crear área'}
                </button>`,
        });

        const form = element.querySelector('#area-form');
        const errorBox = element.querySelector('#area-form-error');
        const submit = element.querySelector('#area-submit');

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorBox.innerHTML = '';

            const nombre = form.nombre.value.trim();
            const descripcion = form.descripcion.value.trim();

            if (!nombre) {
                errorBox.innerHTML = '<div class="alert alert-warning py-2">El nombre del área es obligatorio.</div>';
                form.nombre.focus();
                return;
            }
            if (!form.reportValidity()) return;

            setButtonBusy(submit, true, editing ? 'Guardando…' : 'Creando…');
            try {
                const payload = { nombre, descripcion: descripcion || null };
                if (editing) {
                    await api.areas.actualizar(area.idArea, payload);
                    showToast(`Área «${nombre}» actualizada.`);
                } else {
                    await api.areas.crear(payload);
                    showToast(`Área «${nombre}» creada.`);
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

    async function removeArea(area) {
        const count = countByArea(equipos).get(Number(area.idArea)) || 0;
        if (count > 0) {
            showToast(`No se puede eliminar «${area.nombre}»: tiene ${count} equipo(s) asociado(s).`, 'warning');
            return;
        }

        const confirmed = await confirmDialog({
            title: 'Eliminar área',
            message: `¿Eliminar definitivamente el área «${area.nombre}»?`,
            details: 'Esta acción no se puede deshacer. No existe borrado en cascada.',
            confirmText: 'Eliminar área',
        });
        if (!confirmed) return;

        try {
            await api.areas.eliminar(area.idArea);
            showToast(`Área «${area.nombre}» eliminada.`);
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
            const [areasData, equiposData] = await Promise.all([api.areas.listar(), api.equipos.listar()]);
            if (!active) return;
            areas = Array.isArray(areasData) ? areasData : [];
            equipos = Array.isArray(equiposData) ? equiposData : [];
            root.innerHTML = render(areas, equipos);
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
