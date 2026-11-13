import { api } from '../api.js';
import {
    emptyState,
    errorPanel,
    escapeHtml,
    loadingPage,
    pageHeader,
    statCard,
} from '../utils.js';
import {
    notifyDataChanged,
    openModal,
    setButtonBusy,
    showToast,
} from '../ui.js';

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
const MAX_DECIMAL_VALUES = {
    horasMalEstado: { max: 99999999.99, pattern: /^\d{1,8}(?:\.\d{1,2})?$/ },
    consumoNormalKwh: { max: 99999999.99, pattern: /^\d{1,8}(?:\.\d{1,2})?$/ },
    porcentajeExtra: { max: 999.99, pattern: /^\d{1,3}(?:\.\d{1,2})?$/ },
    factorEmision: { max: 999999.9999, pattern: /^\d{1,6}(?:\.\d{1,4})?$/ },
};

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

function render(summary, records, equipos, configuracion, { demo = false } = {}) {
    if (!isValidSummary(summary)) {
        throw new Error('No se pudo mostrar el resumen de huella de carbono.');
    }

    return `
        ${pageHeader({
            eyebrow: demo ? 'Datos de ejemplo' : 'Resumen de emisiones',
            title: 'Huella de carbono',
        })}

        ${equipos.length ? '' : `
            <div class="alert alert-warning d-flex align-items-center gap-2" role="status">
                <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
                <span>No hay equipos activos para registrar mediciones de carbono.</span>
            </div>`}

        ${configuracion?.factorEmision === undefined ? `
            <div class="alert alert-warning d-flex align-items-center gap-2" role="status">
                <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
                <span>No se pudo leer el factor de emisión configurado. Puedes consultar o actualizarlo desde «Factor de emisión».</span>
            </div>` : ''}

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
    let equipos = [];
    let summary = null;
    let configuracion = null;

    function equipmentOptions(selectedCode = '') {
        return equipos.map((equipo) => `
            <option value="${escapeHtml(equipo.codigo)}" ${equipo.codigo === selectedCode ? 'selected' : ''}>
                ${escapeHtml(equipo.codigo)} — ${escapeHtml(equipo.nombre)}
            </option>`).join('');
    }

    function numericField({ id, name, label, value = '', min = '0', max, step, hint }) {
        return `
            <div class="mb-3">
                <label class="form-label" for="${id}">${label} <span class="text-danger">*</span></label>
                <input class="form-control" id="${id}" name="${name}" type="number" inputmode="decimal"
                       min="${min}" max="${max}" step="${step}" required value="${escapeHtml(value)}">
                <div class="form-text">${hint}</div>
            </div>`;
    }

    function validateDecimal(form, fieldName, label, errorBox) {
        const field = form.elements[fieldName];
        const raw = field.value.trim();
        const constraints = MAX_DECIMAL_VALUES[fieldName];
        const value = Number(raw);
        if (!raw || !constraints.pattern.test(raw) || !Number.isFinite(value) || value < 0 || value > constraints.max) {
            errorBox.innerHTML = `<div class="alert alert-warning py-2">Ingrese ${escapeHtml(label)} con un valor válido dentro del rango permitido.</div>`;
            field.focus();
            return null;
        }
        return value;
    }

    function savedParameters(equipo) {
        return {
            consumoNormalKwh: equipo?.consumoNormalKwh,
            porcentajeExtra: equipo?.porcentajeExtra,
        };
    }

    function openRegisterForm() {
        if (!equipos.length) {
            showToast('Registre primero un equipo activo para agregar mediciones.', 'warning');
            return;
        }

        const { element, modal } = openModal({
            title: 'Registrar cálculo de emisiones',
            icon: 'cloud-plus',
            size: 'modal-md',
            body: `
                <form id="carbon-register-form" novalidate>
                    <div id="carbon-register-error"></div>
                    <div class="mb-3">
                        <label class="form-label" for="carbon-register-equipment">Equipo <span class="text-danger">*</span></label>
                        <select class="form-select" id="carbon-register-equipment" name="codigoEquipo" required>
                            <option value="">Seleccione un equipo…</option>
                            ${equipmentOptions()}
                        </select>
                    </div>
                    ${numericField({
                        id: 'carbon-register-hours',
                        name: 'horasMalEstado',
                        label: 'Horas en mal estado',
                        max: '99999999.99',
                        step: '0.01',
                        hint: 'Mínimo 0; hasta 8 dígitos enteros y 2 decimales.',
                    })}
                    <p class="form-text mb-0">El cálculo utilizará los parámetros guardados del equipo y el factor vigente de la planta. Si los cambiaste, guárdalos primero en «Parámetros del equipo».</p>
                </form>`,
            footer: `
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary" form="carbon-register-form" id="carbon-register-submit">
                    <i class="bi bi-calculator" aria-hidden="true"></i> Registrar cálculo
                </button>`,
        });

        const form = element.querySelector('#carbon-register-form');
        const errorBox = element.querySelector('#carbon-register-error');
        const submit = element.querySelector('#carbon-register-submit');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorBox.innerHTML = '';
            const codigoEquipo = form.codigoEquipo.value;
            if (!codigoEquipo || !equipos.some((equipo) => equipo.codigo === codigoEquipo)) {
                errorBox.innerHTML = '<div class="alert alert-warning py-2">Seleccione un equipo activo.</div>';
                form.codigoEquipo.focus();
                return;
            }
            const horasMalEstado = validateDecimal(
                form,
                'horasMalEstado',
                'las horas en mal estado',
                errorBox,
            );
            if (horasMalEstado === null || !form.reportValidity()) return;

            setButtonBusy(submit, true, 'Registrando…');
            try {
                await api.carbono.crearRegistro({ codigoEquipo, horasMalEstado });
            } catch (error) {
                errorBox.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(error.message)}</div>`;
                setButtonBusy(submit, false);
                return;
            }
            modal.hide();
            showToast('El cálculo de emisiones se registró correctamente.');
            notifyDataChanged();
            await load();
        });
    }

    function openParametersForm() {
        if (!equipos.length) {
            showToast('Registre primero un equipo activo para configurar sus parámetros.', 'warning');
            return;
        }

        const { element, modal } = openModal({
            title: 'Parámetros energéticos del equipo',
            icon: 'sliders',
            size: 'modal-md',
            body: `
                <form id="carbon-parameters-form" novalidate>
                    <div id="carbon-parameters-error"></div>
                    <div class="mb-3">
                        <label class="form-label" for="carbon-parameters-equipment">Equipo <span class="text-danger">*</span></label>
                        <select class="form-select" id="carbon-parameters-equipment" name="codigoEquipo" required>
                            <option value="">Seleccione un equipo…</option>
                            ${equipmentOptions()}
                        </select>
                    </div>
                    ${numericField({
                        id: 'carbon-normal-consumption',
                        name: 'consumoNormalKwh',
                        label: 'Consumo normal (kWh)',
                        max: '99999999.99',
                        step: '0.01',
                        hint: 'Mínimo 0; hasta 8 dígitos enteros y 2 decimales.',
                    })}
                    ${numericField({
                        id: 'carbon-extra-percent',
                        name: 'porcentajeExtra',
                        label: 'Porcentaje extra (%)',
                        max: '100',
                        step: '0.01',
                        hint: 'Entre 0 y 100; hasta 3 dígitos enteros y 2 decimales.',
                    })}
                    <p class="form-text mb-0">Guarda estos valores antes de registrar un cálculo para que se apliquen a la medición.</p>
                </form>`,
            footer: `
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary" form="carbon-parameters-form" id="carbon-parameters-submit">
                    <i class="bi bi-floppy" aria-hidden="true"></i> Guardar parámetros
                </button>`,
        });

        const form = element.querySelector('#carbon-parameters-form');
        const errorBox = element.querySelector('#carbon-parameters-error');
        const submit = element.querySelector('#carbon-parameters-submit');
        const equipmentSelect = form.codigoEquipo;

        function fillSavedValues() {
            const equipo = equipos.find((item) => item.codigo === equipmentSelect.value);
            const parameters = savedParameters(equipo);
            form.consumoNormalKwh.value = parameters.consumoNormalKwh ?? '';
            form.porcentajeExtra.value = parameters.porcentajeExtra ?? '';
        }

        equipmentSelect.addEventListener('change', fillSavedValues);
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorBox.innerHTML = '';
            const codigoEquipo = equipmentSelect.value;
            if (!codigoEquipo || !equipos.some((equipo) => equipo.codigo === codigoEquipo)) {
                errorBox.innerHTML = '<div class="alert alert-warning py-2">Seleccione un equipo activo.</div>';
                equipmentSelect.focus();
                return;
            }
            const consumoNormalKwh = validateDecimal(
                form,
                'consumoNormalKwh',
                'el consumo normal',
                errorBox,
            );
            const porcentajeExtra = validateDecimal(
                form,
                'porcentajeExtra',
                'el porcentaje extra',
                errorBox,
            );
            if (consumoNormalKwh === null || porcentajeExtra === null) return;
            if (porcentajeExtra > 100) {
                errorBox.innerHTML = '<div class="alert alert-warning py-2">El porcentaje extra debe estar entre 0 y 100.</div>';
                form.porcentajeExtra.focus();
                return;
            }
            if (!form.reportValidity()) return;

            setButtonBusy(submit, true, 'Guardando…');
            try {
                await api.carbono.actualizarParametrosEquipo(codigoEquipo, {
                    consumoNormalKwh,
                    porcentajeExtra,
                });
            } catch (error) {
                errorBox.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(error.message)}</div>`;
                setButtonBusy(submit, false);
                return;
            }
            modal.hide();
            showToast(`Parámetros del equipo ${codigoEquipo} guardados.`);
            notifyDataChanged();
            await load();
        });
    }

    function openFactorForm() {
        const currentFactor = configuracion?.factorEmision ?? summary?.factorEmision ?? '';
        const { element, modal } = openModal({
            title: 'Factor de emisión de la planta',
            icon: 'activity',
            size: 'modal-md',
            body: `
                <form id="carbon-factor-form" novalidate>
                    <div id="carbon-factor-error"></div>
                    ${numericField({
                        id: 'carbon-factor-value',
                        name: 'factorEmision',
                        label: 'Factor de emisión (kg CO₂/kWh)',
                        value: currentFactor,
                        max: '999999.9999',
                        step: '0.0001',
                        hint: 'Mínimo 0; hasta 6 dígitos enteros y 4 decimales.',
                    })}
                    <p class="form-text mb-0">El valor guardado se aplicará a los cálculos posteriores.</p>
                </form>`,
            footer: `
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary" form="carbon-factor-form" id="carbon-factor-submit">
                    <i class="bi bi-floppy" aria-hidden="true"></i> Guardar factor
                </button>`,
        });

        const form = element.querySelector('#carbon-factor-form');
        const errorBox = element.querySelector('#carbon-factor-error');
        const submit = element.querySelector('#carbon-factor-submit');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorBox.innerHTML = '';
            const factorEmision = validateDecimal(
                form,
                'factorEmision',
                'el factor de emisión',
                errorBox,
            );
            if (factorEmision === null || !form.reportValidity()) return;

            setButtonBusy(submit, true, 'Guardando…');
            try {
                await api.carbono.actualizarConfiguracion({ factorEmision });
            } catch (error) {
                errorBox.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(error.message)}</div>`;
                setButtonBusy(submit, false);
                return;
            }
            modal.hide();
            showToast('El factor de emisión de la planta se actualizó.');
            notifyDataChanged();
            await load();
        });
    }

    function attachEvents() {
        root.querySelector('#btn-carbon-register')?.addEventListener('click', openRegisterForm);
        root.querySelector('#btn-carbon-parameters')?.addEventListener('click', openParametersForm);
        root.querySelector('#btn-carbon-factor')?.addEventListener('click', openFactorForm);
    }

    async function load() {
        if (!active) return;
        root.innerHTML = loadingPage();
        try {
            const [nextSummary, records, nextEquipos, nextConfiguracion] = await Promise.all([
                api.carbono.resumen(),
                api.carbono.registros(),
                api.equipos.listar(),
                api.carbono.configuracion(),
            ]);
            if (!active) return;
            if (!Array.isArray(records) || !Array.isArray(nextEquipos)) {
                throw new Error('El servicio devolvió datos de carbono o equipos con un formato inesperado.');
            }
            summary = nextSummary;
            equipos = nextEquipos;
            configuracion = nextConfiguracion;
            const demo = isValidSummary(summary) && !hasCarbonData(summary, records);
            root.innerHTML = demo
                ? render(DEMO_SUMMARY, DEMO_RECORDS, equipos, configuracion, { demo: true })
                : render(summary, records, equipos, configuracion);
            attachEvents();
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
