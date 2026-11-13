import { escapeHtml } from './utils.js';

let activeModal = null;

const toastIcons = {
    success: 'check-circle-fill',
    danger: 'exclamation-octagon-fill',
    warning: 'exclamation-triangle-fill',
    info: 'info-circle-fill',
};

const toastClasses = {
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
    info: 'text-info',
};

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const tone = toastClasses[type] ? type : 'info';
    const icon = toastIcons[tone];

    container.insertAdjacentHTML('beforeend', `
        <div id="${id}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <i class="bi bi-${icon} ${toastClasses[tone]} me-2" aria-hidden="true"></i>
                <strong class="me-auto">SGMI</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Cerrar"></button>
            </div>
            <div class="toast-body">${escapeHtml(message)}</div>
        </div>`);

    const element = document.getElementById(id);
    const toast = new window.bootstrap.Toast(element, { delay: tone === 'danger' ? 7500 : 4500 });
    element.addEventListener('hidden.bs.toast', () => element.remove(), { once: true });
    toast.show();
}

export function setConnection(state, label) {
    const chip = document.getElementById('connection-chip');
    const text = document.getElementById('connection-text');
    if (!chip || !text) return;
    chip.dataset.state = state;
    text.textContent = label;
    chip.title = label;
}

export function setUndoAvailable(count) {
    const undoButton = document.getElementById('btn-undo');
    if (undoButton && count !== undefined) undoButton.disabled = Number(count) <= 0;
}

export function setLastUpdated(date = new Date()) {
    const element = document.getElementById('last-updated');
    if (!element) return;
    element.textContent = `Actualizado ${date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    })}`;
}

export function setButtonBusy(button, busy, busyLabel = 'Guardando…') {
    if (!button) return;
    if (busy) {
        button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${escapeHtml(busyLabel)}`;
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            delete button.dataset.originalHtml;
        }
    }
}

export function openModal({ title, body, footer = '', size = 'modal-lg', icon = 'window' }) {
    const root = document.getElementById('modal-root');
    if (!root) throw new Error('No existe el contenedor de modales.');

    if (activeModal) {
        const previous = activeModal;
        activeModal = null;
        previous.hide();
    }

    root.innerHTML = `
        <div class="modal fade" id="app-modal" tabindex="-1" aria-labelledby="app-modal-title" aria-hidden="true">
            <div class="modal-dialog ${escapeHtml(size)} modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title d-flex align-items-center gap-2" id="app-modal-title">
                            <i class="bi bi-${escapeHtml(icon)} text-info" aria-hidden="true"></i>
                            ${escapeHtml(title)}
                        </h2>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>
                    <div class="modal-body">${body}</div>
                    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
                </div>
            </div>
        </div>`;

    const element = root.querySelector('#app-modal');
    const modal = new window.bootstrap.Modal(element, { backdrop: 'static', keyboard: true });
    activeModal = modal;

    element.addEventListener('hidden.bs.modal', () => {
        modal.dispose();
        if (activeModal === modal) {
            activeModal = null;
            root.innerHTML = '';
        }
    }, { once: true });

    modal.show();
    return { modal, element, body: element.querySelector('.modal-body'), footer: element.querySelector('.modal-footer') };
}

export function closeModal() {
    if (!activeModal) return;
    const modal = activeModal;
    activeModal = null;
    modal.hide();
}

/**
 * Confirmación reutilizable. Devuelve true solo cuando se pulsa el botón de
 * confirmación; cerrar el modal, el fondo o Escape devuelve false.
 */
export function confirmDialog({
    title = 'Confirmar acción',
    message = '',
    details = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger',
    icon = 'exclamation-triangle',
} = {}) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value, hide = true) => {
            if (settled) return;
            settled = true;
            resolve(value);
            if (hide) modal.hide();
        };

        const { modal, element } = openModal({
            title,
            size: 'modal-md',
            icon,
            body: `
                <p class="mb-2">${escapeHtml(message)}</p>
                ${details ? `<div class="alert alert-warning mb-0 mt-3">${details}</div>` : ''}`,
            footer: `
                <button type="button" class="btn btn-outline-secondary" data-confirm-cancel>${escapeHtml(cancelText)}</button>
                <button type="button" class="btn btn-${variant}" data-confirm-ok>${escapeHtml(confirmText)}</button>`,
        });

        element.querySelector('[data-confirm-cancel]').addEventListener('click', () => finish(false));
        element.querySelector('[data-confirm-ok]').addEventListener('click', () => finish(true));
        element.addEventListener('hidden.bs.modal', () => finish(false, false), { once: true });
    });
}

export function notifyDataChanged() {
    document.dispatchEvent(new CustomEvent('sgmi:data-changed'));
}
