import { pageHeader } from '../utils.js';

export async function mount(root) {
    root.innerHTML = `
        ${pageHeader({
            eyebrow: 'Módulo no disponible',
            title: 'Huella de carbono',
            subtitle: 'La interfaz Swing incluía este panel, pero la API de la rama migracion-springboot no expone endpoints de carbono.',
        })}
        <section class="panel">
            <div class="panel-body">
                <div class="empty-state">
                    <div>
                        <div class="empty-state-icon"><i class="bi bi-cloud-slash" aria-hidden="true"></i></div>
                        <h3>Sin contrato REST para carbono</h3>
                        <p>
                            No se crearon tablas ni respuestas simuladas. Para migrar este módulo hace falta exponer
                            primero los endpoints de resumen, áreas, equipos y registros de emisiones en el backend.
                        </p>
                        <a class="btn btn-outline-secondary mt-3" href="#/dashboard">
                            <i class="bi bi-arrow-left" aria-hidden="true"></i> Volver al panel principal
                        </a>
                    </div>
                </div>
            </div>
        </section>`;
    return { refresh: async () => {}, destroy: () => {} };
}
