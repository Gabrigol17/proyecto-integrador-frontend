import { api } from './api.js';
import {
    closeModal,
    confirmDialog,
    setButtonBusy,
    setConnection,
    setHeaderStats,
    setLastUpdated,
    showToast,
} from './ui.js';
import { errorPanel } from './utils.js';

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
        title: 'Cola de prioridad',
        load: () => import('./views/cola.js'),
    },
    equipos: {
        title: 'Equipos e índice AVL',
        load: () => import('./views/equipos.js'),
    },
    areas: {
        title: 'Gestión de áreas',
        load: () => import('./views/areas.js'),
    },
    historial: {
        title: 'Historial de acciones',
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

const viewRoot = document.getElementById('view-root');
const refreshButton = document.getElementById('btn-refresh');
const undoButton = document.getElementById('btn-undo');
const mobileSidebar = document.getElementById('mobile-sidebar');

let currentView = null;
let navigationToken = 0;
let currentRoute = 'dashboard';

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
        const database = health?.baseDatos || 'conectada';
        setConnection(health?.estado === 'ok' ? 'ok' : 'error', `API · ${database}`);
        setHeaderStats({
            queue: stats?.ordenesEnCola ?? 0,
            avl: stats?.equiposEnIndice ?? 0,
            stack: stats?.accionesPorDeshacer ?? 0,
        });
        setLastUpdated(new Date());
    } catch (error) {
        setConnection('error', error.status === 0 ? 'Sin conexión con la API' : `API · error ${error.status}`);
    }
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

async function globalUndo() {
    const confirmed = await confirmDialog({
        title: 'Deshacer última acción',
        message: '¿Deshacer la acción en el tope de la pila?',
        details: 'La reversión se aplicará primero en PostgreSQL. Si falla, la acción permanecerá en la pila.',
        confirmText: 'Deshacer',
        variant: 'warning',
        icon: 'arrow-counterclockwise',
    });
    if (!confirmed) return;

    try {
        await api.ordenes.deshacer();
        showToast('Última acción revertida correctamente.');
        await Promise.all([
            currentView?.refresh ? currentView.refresh() : Promise.resolve(),
            refreshHeader(),
        ]);
    } catch (error) {
        showToast(error.message, 'danger');
    }
}

function boot() {
    setConnection('checking', 'Verificando API');
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
