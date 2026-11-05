import { api } from '../api.js';
import {
    distributionRows,
    errorPanel,
    escapeHtml,
    loadingPage,
    pageHeader,
    statCard,
} from '../utils.js';

const areaColors = [
    '#3b82f6',
    '#22d3ee',
    '#34d399',
    '#fbbf24',
    '#a78bfa',
    '#f87171',
    '#60a5fa',
];

function chartCard(title, subtitle, data, colorMap) {
    return `
        <div class="col-md-6">
            <section class="panel h-100">
                <div class="panel-header">
                    <div>
                        <h2 class="panel-title">${escapeHtml(title)}</h2>
                        <p class="panel-subtitle">${escapeHtml(subtitle)}</p>
                    </div>
                </div>
                <div class="panel-body">
                    ${distributionRows(data, colorMap)}
                </div>
            </section>
        </div>`;
}

function render(stats) {
    const areaMap = {};
    Object.keys(stats.ordenesPorArea || {}).forEach((area, index) => {
        areaMap[area] = areaColors[index % areaColors.length];
    });

    return `
        ${pageHeader({
            eyebrow: 'Lectura de datos',
            title: 'Indicadores y estadísticas',
            subtitle: 'Distribuciones calculadas exclusivamente con las órdenes, equipos y áreas persistidos en PostgreSQL.',
        })}

        <div class="summary-bar mb-3">
            <span><strong>${escapeHtml(stats.totalOrdenes)}</strong> órdenes históricas</span>
            <span>·</span>
            <span><strong>${escapeHtml(stats.pendientes)}</strong> pendientes en cola</span>
            <span>·</span>
            <span><strong>${escapeHtml(stats.equiposEnIndice)}</strong> equipos en el AVL</span>
            <span>·</span>
            <span><strong>${escapeHtml(stats.accionesPorDeshacer)}</strong> acciones por deshacer</span>
        </div>

        ${Number(stats.totalOrdenes) === 0 ? `
            <div class="alert alert-warning d-flex align-items-center gap-2" role="alert">
                <i class="bi bi-info-circle-fill" aria-hidden="true"></i>
                <span>No hay órdenes registradas. Las gráficas se llenarán cuando existan datos reales.</span>
            </div>` : ''}

        <div class="row g-3 mb-3">
            ${statCard({ label: 'Total histórico', value: stats.totalOrdenes, detail: 'Todas las órdenes', icon: 'clipboard-data', tone: 'blue' })}
            ${statCard({ label: 'Pendientes', value: stats.pendientes, detail: 'En la cola', icon: 'hourglass-split', tone: 'cyan' })}
            ${statCard({ label: 'Equipos en AVL', value: stats.equiposEnIndice, detail: `Altura ${stats.alturaArbolEquipos}`, icon: 'diagram-3', tone: 'purple' })}
            ${statCard({ label: 'Acciones en pila', value: stats.accionesPorDeshacer, detail: 'Disponibles para deshacer', icon: 'clock-history', tone: 'amber' })}
        </div>

        <div class="row g-3">
            ${chartCard('Órdenes por estado', 'Incluye pendientes, cerradas y canceladas.', stats.ordenesPorEstado, {
                PENDIENTE: '#60a5fa',
                CERRADA: '#34d399',
                CANCELADA: '#f87171',
            })}
            ${chartCard('Órdenes por criticidad', 'Calculada por el modelo del backend.', stats.ordenesPorCriticidad, {
                ALTA: '#f87171',
                MEDIA: '#fbbf24',
                BAJA: '#34d399',
            })}
            ${chartCard('Órdenes por tipo', 'Mantenimiento preventivo y correctivo.', stats.ordenesPorTipo, {
                CORRECTIVO: '#a78bfa',
                PREVENTIVO: '#22d3ee',
            })}
            ${chartCard('Distribución por área', 'El área se resuelve buscando el equipo en el índice AVL.', stats.ordenesPorArea, areaMap)}
        </div>

        <p class="small text-secondary mt-3 mb-0">
            <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
            Los conteos incluyen órdenes PENDIENTE, CERRADA y CANCELADA. No se muestran métricas de ahorro o
            sostenibilidad porque no forman parte de los datos registrados.
        </p>`;
}

export async function mount(root) {
    let active = true;

    async function load() {
        if (!active) return;
        root.innerHTML = loadingPage();
        try {
            const stats = await api.estadisticas();
            if (!active) return;
            root.innerHTML = render(stats || {});
        } catch (error) {
            if (!active) return;
            root.innerHTML = errorPanel(error.message);
        }
    }

    await load();
    return {
        refresh: load,
        destroy: () => { active = false; },
    };
}
