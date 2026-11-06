import { api } from '../api.js';
import {
    emptyState,
    errorPanel,
    escapeHtml,
    loadingPage,
    pageHeader,
    statCard,
} from '../utils.js';

const numberFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 });

function metric(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`La API devolvió un valor inválido para ${label}.`);
    }
    return numberFormatter.format(value);
}

function displayValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number' && Number.isFinite(value)) return numberFormatter.format(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function columnLabel(key) {
    return key
        .replaceAll('_', ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (character) => character.toLocaleUpperCase('es-CO'));
}

function dataTable(title, subtitle, items, emptyDescription) {
    if (!Array.isArray(items)) {
        throw new Error(`La API devolvió un formato inválido para "${title}".`);
    }

    const rows = items.map((item) => (
        item && typeof item === 'object' && !Array.isArray(item)
            ? item
            : { valor: item }
    ));
    const columns = [...new Set(rows.flatMap((item) => Object.keys(item)))];

    return `
        <section class="panel h-100">
            <div class="panel-header">
                <div>
                    <h2 class="panel-title">${escapeHtml(title)}</h2>
                    <p class="panel-subtitle">${escapeHtml(subtitle)}</p>
                </div>
                <span class="badge rounded-pill text-bg-secondary">${rows.length} registros</span>
            </div>
            <div class="panel-body">
                ${columns.length === 0
                    ? emptyState({ icon: 'leaf', title: 'Sin datos registrados', description: emptyDescription })
                    : `<div class="table-responsive">
                        <table class="table table-sm align-middle mb-0">
                            <thead><tr>${columns.map((key) => `<th scope="col">${escapeHtml(columnLabel(key))}</th>`).join('')}</tr></thead>
                            <tbody>
                                ${rows.map((item) => `<tr>${columns.map((key) => `<td>${escapeHtml(displayValue(item[key]))}</td>`).join('')}</tr>`).join('')}
                            </tbody>
                        </table>
                    </div>`}
            </div>
        </section>`;
}

function render(summary, records) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
        throw new Error('La API devolvió un resumen de huella de carbono inválido.');
    }

    return `
        ${pageHeader({
            eyebrow: 'Datos del backend',
            title: 'Huella de carbono',
        })}

        <div class="row g-3 mb-3">
            ${statCard({
                label: 'Emisiones totales',
                value: `${metric(summary.totalEmisionesKgCo2, 'emisiones totales')} kg CO₂`,
                detail: '',
                icon: 'cloud',
                tone: 'green',
            })}
            ${statCard({
                label: 'Equipos con emisiones',
                value: metric(summary.equiposConEmisiones, 'equipos con emisiones'),
                detail: '',
                icon: 'cpu',
                tone: 'cyan',
            })}
            ${statCard({
                label: 'Registros',
                value: metric(summary.totalRegistros, 'total de registros'),
                detail: '',
                icon: 'journals',
                tone: 'blue',
            })}
            ${statCard({
                label: 'Factor de emisión',
                value: `${metric(summary.factorEmision, 'factor de emisión')} kg CO₂/kWh`,
                detail: '',
                icon: 'activity',
                tone: 'amber',
            })}
        </div>

        ${Number(summary.totalRegistros) === 0 ? `
            <div class="alert alert-info d-flex align-items-center gap-2" role="status">
                <i class="bi bi-info-circle-fill" aria-hidden="true"></i>
                <span>El backend aún no tiene registros de emisiones. Los indicadores muestran los valores reales actuales.</span>
            </div>` : ''}

        <div class="row g-3 mb-3">
            <div class="col-xl-6">
                ${dataTable(
                    'Emisiones por área',
                    '',
                    summary.emisionesPorArea,
                    'Todavía no hay emisiones asociadas a áreas.',
                )}
            </div>
            <div class="col-xl-6">
                ${dataTable(
                    'Emisiones por equipo',
                    '',
                    summary.emisionesPorEquipo,
                    'Todavía no hay emisiones asociadas a equipos.',
                )}
            </div>
        </div>

        ${dataTable(
            'Registros de emisiones',
            '',
            records,
            'No hay registros de emisiones para mostrar.',
        )}`;
}

export async function mount(root) {
    let active = true;

    async function load() {
        if (!active) return;
        root.innerHTML = loadingPage();
        try {
            const [summary, records] = await Promise.all([
                api.carbono.resumen(),
                api.carbono.registros(),
            ]);
            if (!active) return;
            root.innerHTML = render(summary, records);
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
