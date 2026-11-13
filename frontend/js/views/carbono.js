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

const COLUMN_LABELS = {
    idRegistro: 'ID registro',
    codigoEquipo: 'Código equipo',
    nombreEquipo: 'Equipo',
    area: 'Área',
    fecha: 'Fecha',
    consumoKwh: 'Consumo (kWh)',
    emisionesKgCo2: 'Emisiones (kg CO₂)',
    emisionesKgCO2: 'Emisiones (kg CO₂)',
};

const DEMO_FACTOR = 0.15;
const DEMO_RECORDS = [
    { fecha: '2026-10-24', codigoEquipo: 'ILU-003', nombreEquipo: 'Iluminación nave principal', area: 'Servicios', consumoKwh: 320, emisionesKgCo2: 48 },
    { fecha: '2026-10-22', codigoEquipo: 'REF-006', nombreEquipo: 'Cámara de refrigeración', area: 'Logística', consumoKwh: 1110, emisionesKgCo2: 166.5 },
    { fecha: '2026-10-19', codigoEquipo: 'MON-005', nombreEquipo: 'Montacargas eléctrico', area: 'Logística', consumoKwh: 760, emisionesKgCo2: 114 },
    { fecha: '2026-10-17', codigoEquipo: 'MOT-001', nombreEquipo: 'Motor de bombeo principal', area: 'Producción', consumoKwh: 760, emisionesKgCo2: 114 },
    { fecha: '2026-10-12', codigoEquipo: 'CAL-004', nombreEquipo: 'Caldera de vapor', area: 'Servicios', consumoKwh: 1560, emisionesKgCo2: 234 },
    { fecha: '2026-10-10', codigoEquipo: 'ILU-003', nombreEquipo: 'Iluminación nave principal', area: 'Servicios', consumoKwh: 300, emisionesKgCo2: 45 },
    { fecha: '2026-10-05', codigoEquipo: 'COM-002', nombreEquipo: 'Compresor de aire', area: 'Producción', consumoKwh: 940, emisionesKgCo2: 141 },
    { fecha: '2026-10-03', codigoEquipo: 'MOT-001', nombreEquipo: 'Motor de bombeo principal', area: 'Producción', consumoKwh: 520, emisionesKgCo2: 78 },
];

function buildDemoSummary(records) {
    const areas = new Map();
    const equipment = new Map();

    for (const record of records) {
        areas.set(record.area, (areas.get(record.area) ?? 0) + record.emisionesKgCo2);

        const current = equipment.get(record.codigoEquipo) ?? {
            codigoEquipo: record.codigoEquipo,
            nombreEquipo: record.nombreEquipo,
            area: record.area,
            emisionesKgCo2: 0,
        };
        current.emisionesKgCo2 += record.emisionesKgCo2;
        equipment.set(record.codigoEquipo, current);
    }

    return {
        totalEmisionesKgCo2: records.reduce((sum, record) => sum + record.emisionesKgCo2, 0),
        equiposConEmisiones: equipment.size,
        totalRegistros: records.length,
        factorEmision: DEMO_FACTOR,
        emisionesPorArea: [...areas.entries()]
            .map(([area, emisionesKgCo2]) => ({ area, emisionesKgCo2 }))
            .sort((a, b) => b.emisionesKgCo2 - a.emisionesKgCo2),
        emisionesPorEquipo: [...equipment.values()]
            .sort((a, b) => b.emisionesKgCo2 - a.emisionesKgCo2),
    };
}

const DEMO_SUMMARY = buildDemoSummary(DEMO_RECORDS);

function isValidSummary(summary) {
    return Boolean(summary) && typeof summary === 'object' && !Array.isArray(summary);
}

function hasCarbonData(summary, records) {
    if (Number(summary.totalRegistros) > 0) return true;
    if (!Array.isArray(records) || records.length > 0) return true;
    const emptyBreakdowns = ['emisionesPorArea', 'emisionesPorEquipo'].every(
        (key) => Array.isArray(summary[key]) && summary[key].length === 0,
    );
    return !emptyBreakdowns;
}

function metric(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`No se pudo mostrar el valor de ${label}.`);
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
    if (Object.hasOwn(COLUMN_LABELS, key)) return COLUMN_LABELS[key];
    return key
        .replaceAll('_', ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (character) => character.toLocaleUpperCase('es-CO'));
}

function dataTable(title, subtitle, items, emptyDescription) {
    if (!Array.isArray(items)) {
        throw new Error(`No se pudo mostrar la tabla "${title}".`);
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

function render(summary, records, { demo = false } = {}) {
    if (!isValidSummary(summary)) {
        throw new Error('No se pudo mostrar el resumen de huella de carbono.');
    }

    return `
        ${pageHeader({
            eyebrow: demo ? 'Datos de ejemplo' : 'Resumen de emisiones',
            title: 'Huella de carbono',
            subtitle: demo
                ? 'Vista ilustrativa. Estas cifras no corresponden a mediciones reales.'
                : 'Consulta las emisiones asociadas al consumo energético registrado.',
            actions: demo
                ? '<span class="badge rounded-pill text-bg-warning"><i class="bi bi-stars me-1" aria-hidden="true"></i> Datos de ejemplo</span>'
                : '',
        })}

        <div class="row g-3 mb-3">
            ${statCard({
                label: 'Emisiones totales',
                value: `${metric(summary.totalEmisionesKgCo2, 'emisiones totales')} kg CO₂`,
                detail: demo ? 'Cifras ilustrativas' : 'Emisiones acumuladas',
                icon: 'cloud',
                tone: 'green',
            })}
            ${statCard({
                label: 'Equipos con emisiones',
                value: metric(summary.equiposConEmisiones, 'equipos con emisiones'),
                detail: demo ? 'Equipos de ejemplo' : 'Con mediciones registradas',
                icon: 'cpu',
                tone: 'cyan',
            })}
            ${statCard({
                label: 'Registros',
                value: metric(summary.totalRegistros, 'total de registros'),
                detail: demo ? 'Mediciones de ejemplo' : 'Mediciones registradas',
                icon: 'journals',
                tone: 'blue',
            })}
            ${statCard({
                label: 'Factor de emisión',
                value: `${metric(summary.factorEmision, 'factor de emisión')} kg CO₂/kWh`,
                detail: demo ? 'Factor de referencia' : 'Usado para el cálculo',
                icon: 'activity',
                tone: 'amber',
            })}
        </div>

        ${demo ? `
            <div class="alert alert-warning d-flex align-items-start gap-2" role="status">
                <i class="bi bi-stars mt-1" aria-hidden="true"></i>
                <div>
                    <strong>Datos de demostración.</strong>
                    <div class="small mt-1">Aún no hay mediciones registradas. Estas cifras son solo ilustrativas y no representan datos reales.</div>
                </div>
            </div>` : ''}

        <div class="row g-3 mb-3">
            <div class="col-xl-6">
                ${dataTable(
                    'Emisiones por área',
                    demo ? 'Cifras de ejemplo por área.' : 'Emisiones acumuladas por área.',
                    summary.emisionesPorArea,
                    'Todavía no hay emisiones asociadas a áreas.',
                )}
            </div>
            <div class="col-xl-6">
                ${dataTable(
                    'Emisiones por equipo',
                    demo ? 'Cifras de ejemplo por equipo.' : 'Emisiones acumuladas por equipo.',
                    summary.emisionesPorEquipo,
                    'Todavía no hay emisiones asociadas a equipos.',
                )}
            </div>
        </div>

        ${dataTable(
            'Registros de emisiones',
            demo ? 'Mediciones de ejemplo.' : 'Mediciones registradas.',
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
            const demo = isValidSummary(summary) && !hasCarbonData(summary, records);
            root.innerHTML = demo
                ? render(DEMO_SUMMARY, DEMO_RECORDS, { demo: true })
                : render(summary, records);
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
