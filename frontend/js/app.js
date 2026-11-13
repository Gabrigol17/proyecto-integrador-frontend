import { api } from './api.js';
import {
    closeModal,
    confirmDialog,
    setButtonBusy,
    setConnection,
    setUndoAvailable,
    setLastUpdated,
    showToast,
} from './ui.js';
import { errorPanel, escapeHtml } from './utils.js';

const routes = {
    dashboard: {
        title: 'Panel principal',
        load: () => import('./views/dashboard.js'),
    },
    ordenes: {
        title: 'Órdenes de mantenimiento',
        load: () => import('./views/ordenes.js'),
    },
    cola: {
        title: 'Órdenes pendientes',
        load: () => import('./views/cola.js'),
    },
    equipos: {
        title: 'Equipos',
        load: () => import('./views/equipos.js'),
    },
    areas: {
        title: 'Gestión de áreas',
        load: () => import('./views/areas.js'),
    },
    historial: {
        title: 'Historial de cambios',
        load: () => import('./views/historial.js'),
    },
    estadisticas: {
        title: 'Indicadores y estadísticas',
        load: () => import('./views/estadisticas.js'),
    },
    carbono: {
        title: 'Huella de carbono',
        load: () => import('./views/carbono.js'),
    },
};

const THEME_KEY = 'sgmi-theme';

const viewRoot = document.getElementById('view-root');
const refreshButton = document.getElementById('btn-refresh');
const undoButton = document.getElementById('btn-undo');
const themeButton = document.getElementById('btn-theme');
const mobileSidebar = document.getElementById('mobile-sidebar');
const desktopSidebar = document.getElementById('desktop-sidebar');
const navBrand = document.getElementById('nav-brand');
const appShell = document.querySelector('.app-shell');

let currentView = null;
let navigationToken = 0;
let currentRoute = 'dashboard';

function currentTheme() {
    return document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light';
}

function storedTheme() {
    try {
        return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch (error) {
        return 'light';
    }
}

function syncThemeButton(theme = currentTheme()) {
    if (!themeButton) return;
    const dark = theme === 'dark';
    const label = dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
}

function applyTheme(theme, { persist = false } = {}) {
    const resolved = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', resolved);
    syncThemeButton(resolved);
    if (persist) {
        try {
            window.localStorage.setItem(THEME_KEY, resolved);
        } catch (error) {
            /* La preferencia solo dura la sesión actual si el almacenamiento falla. */
        }
    }
}

function toggleTheme() {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', { persist: true });
}

function routeFromHash() {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const path = raw.split('?')[0];
    return Object.hasOwn(routes, path) ? path : 'dashboard';
}

function setActiveNav(route) {
    document.querySelectorAll('[data-route]').forEach((link) => {
        const active = link.dataset.route === route;
        link.classList.toggle('active', active);
        if (active) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });
}

async function refreshHeader() {
    try {
        const [stats, health] = await Promise.all([api.estadisticas(), api.estado()]);
        const connected = health?.estado === 'ok';
        setConnection(connected ? 'ok' : 'error', connected ? 'Conectado' : 'Servicio no disponible');
        setUndoAvailable(stats?.accionesPorDeshacer ?? 0);
        setLastUpdated(new Date());
    } catch {
        setConnection('error', 'Sin conexión');
    }
}

function syncNavBrand(expanded) {
    if (!navBrand) return;
    navBrand.setAttribute('aria-expanded', String(expanded));
    navBrand.setAttribute('aria-label', expanded ? 'Ocultar navegación' : 'Abrir navegación');
}

function setDesktopNavigation(expanded) {
    if (!appShell || !desktopSidebar) return;
    appShell.classList.toggle('nav-collapsed', !expanded);
    desktopSidebar.inert = !expanded;
    syncNavBrand(expanded);
}

function toggleNavigation() {
    if (window.matchMedia('(min-width: 992px)').matches) {
        setDesktopNavigation(appShell?.classList.contains('nav-collapsed') ?? false);
        return;
    }

    const offcanvas = window.bootstrap?.Offcanvas?.getOrCreateInstance(mobileSidebar);
    if (!offcanvas) throw new Error('No se pudo abrir la navegación.');
    offcanvas.toggle();
}

async function navigate() {
    const token = ++navigationToken;
    const route = routeFromHash();
    const config = routes[route];

    closeModal();
    if (currentView?.destroy) currentView.destroy();
    currentView = null;
    currentRoute = route;
    setActiveNav(route);
    document.title = `${config.title} · SGMI`;
    if (mobileSidebar) {
        const offcanvas = window.bootstrap?.Offcanvas?.getInstance(mobileSidebar);
        if (offcanvas) offcanvas.hide();
    }

    try {
        const module = await config.load();
        if (token !== navigationToken) return;
        const instance = await module.mount(viewRoot);
        if (token !== navigationToken) {
            instance?.destroy?.();
            return;
        }
        currentView = instance;
    } catch (error) {
        if (token !== navigationToken) return;
        viewRoot.innerHTML = errorPanel(error.message || 'No se pudo cargar la vista.');
    }
}

async function globalRefresh() {
    if (refreshButton?.disabled) return;
    setButtonBusy(refreshButton, true, 'Actualizando…');
    try {
        await Promise.all([
            currentView?.refresh ? currentView.refresh() : Promise.resolve(),
            refreshHeader(),
        ]);
    } finally {
        setButtonBusy(refreshButton, false);
    }
}

function describeUndoAction(action) {
    if (!action || typeof action !== 'object') return null;

    const actionLabels = {
        CREAR: 'Creación',
        MODIFICAR: 'Modificación',
        CANCELAR: 'Cancelación',
        CERRAR: 'Cierre',
        BAJA_EQUIPO: 'Baja de equipo',
    };
    const orderId = action.idOrden ?? action.orden?.id;
    const hasOrder = orderId !== undefined && orderId !== null && orderId !== '';
    const equipment = action.codigoEquipo
        ?? action.equipoCodigo
        ?? action.equipo?.codigo
        ?? action.equipoPrevio?.codigo
        ?? action.estadoPrevio?.codigoEquipo
        ?? action.estadoPrevio?.codigo;

    const summaryParts = [];
    if (action.tipo) summaryParts.push(actionLabels[String(action.tipo).toUpperCase()] || 'Cambio');
    if (hasOrder) summaryParts.push(`Orden OM-${orderId}`);
    if (equipment) summaryParts.push(`Equipo ${equipment}`);
    if (!summaryParts.length) return null;

    return {
        message: '¿Quieres deshacer este cambio?',
        summary: summaryParts.join(' · '),
    };
}

async function globalUndo() {
    setButtonBusy(undoButton, true, 'Consultando…');
    let top = null;
    try {
        const history = await api.ordenes.historial();
        top = Array.isArray(history) ? history[0] ?? null : null;
    } catch {
        showToast('No se pudo consultar el historial de cambios. Inténtalo de nuevo.', 'danger');
        return;
    } finally {
        setButtonBusy(undoButton, false);
    }

    const description = describeUndoAction(top);
    const confirmed = await confirmDialog({
        title: 'Deshacer última acción',
        message: description?.message || '¿Quieres deshacer el último cambio?',
        details: description
            ? `Cambio: ${escapeHtml(description.summary)}. Si confirmas, se revertirá; si cancelas, se conservará.`
            : 'Si confirmas, se revertirá el último cambio del historial. Si cancelas, se conservará.',
        confirmText: 'Deshacer',
        variant: 'warning',
        icon: 'arrow-counterclockwise',
    });
    if (!confirmed) return;

    try {
        await api.ordenes.deshacer();
        showToast('El último cambio se revirtió correctamente.');
        await Promise.all([
            currentView?.refresh ? currentView.refresh() : Promise.resolve(),
            refreshHeader(),
        ]);
    } catch (error) {
        showToast(error.message, 'danger');
    }
}

function boot() {
    applyTheme(storedTheme());
    themeButton?.addEventListener('click', toggleTheme);

    setConnection('checking', 'Conectando');
    if (window.matchMedia('(min-width: 992px)').matches) {
        setDesktopNavigation(!appShell?.classList.contains('nav-collapsed'));
    } else {
        syncNavBrand(false);
    }
    navBrand?.addEventListener('click', toggleNavigation);
    mobileSidebar?.addEventListener('shown.bs.offcanvas', () => syncNavBrand(true));
    mobileSidebar?.addEventListener('hidden.bs.offcanvas', () => syncNavBrand(false));
    refreshButton?.addEventListener('click', globalRefresh);
    undoButton?.addEventListener('click', globalUndo);

    document.addEventListener('sgmi:data-changed', () => {
        refreshHeader();
    });

    window.addEventListener('hashchange', navigate);

    if (!window.location.hash.startsWith('#/')) {
        window.history.replaceState(null, '', '#/dashboard');
    }

    navigate();
    refreshHeader();
}

boot();
