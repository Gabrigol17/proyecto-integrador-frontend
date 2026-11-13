# SGMI · Frontend web

Frontend estático del **Sistema de Gestión de Mantenimiento Industrial**, construido con
HTML5, CSS3, Bootstrap 5 y JavaScript puro. Consume la API REST de Spring Boot mediante
`fetch()` y no necesita compilación ni empaquetador. Incluye temas claro y oscuro con
preferencia persistida en `localStorage`.

## 1. Ejecutar

Desde la raíz del repositorio:

```bash
python3 -m http.server 5500 --directory frontend
```

Abra <http://localhost:5500>.

También puede abrir la carpeta `frontend/` desde cualquier servidor estático (Live Server,
Netlify, GitHub Pages, Vercel, etc.). No abra `index.html` con `file://`: los módulos ES y
`fetch()` necesitan un servidor HTTP.

## 2. URL de la API

La constante está en `js/config.js`:

```js
export const API_URL = 'https://proyecto-integrador-3cer-semestre.onrender.com/api';
```

Para probar otro backend sin editar el archivo:

```text
http://localhost:5500/?api=http://localhost:8080/api
```

## 3. CORS

El frontend se sirve desde un origen distinto al backend. La rama incluye
`src/main/java/com/grupo7/sgmi/config/WebConfig.java` para permitir las peticiones del
navegador. En Render, después de desplegar este cambio, la API aceptará peticiones desde
cualquier origen:

```text
CORS_ALLOWED_ORIGINS=*
```

Para restringirlo, use una lista separada por comas, por ejemplo:

```text
CORS_ALLOWED_ORIGINS=https://mi-frontend.onrender.com,http://localhost:5500
```

La API no usa cookies ni credenciales, por eso el valor `*` es seguro para este proyecto.

## 4. Estructura

```text
frontend/
├── index.html              Shell de la SPA, navegación, topbar, toasts y modales
├── css/styles.css          Temas claro/oscuro, layout responsive y componentes
├── js/
│   ├── config.js           API_URL y tiempo máximo de espera
│   ├── api.js              Cliente fetch y métodos de todos los endpoints
│   ├── utils.js            Fechas, escape HTML, criticidad y plantillas
│   ├── ui.js               Toasts, conexión, modales y confirmaciones
│   ├── app.js              Router por hash, navegación y refresco global
│   └── views/
│       ├── dashboard.js
│       ├── ordenes.js
│       ├── cola.js
│       ├── equipos.js
│       ├── areas.js
│       ├── historial.js
│       ├── estadisticas.js
│       └── carbono.js          Resumen y registros de emisiones
```

Cada vista exporta `mount(root)` y devuelve `{ refresh, destroy }`; el router se encarga
de destruir la vista anterior y cerrar modales al navegar.

## 5. Paridad con la interfaz Swing

| Panel Swing | Vista web | Operaciones |
|---|---|---|
| Panel principal | `#/dashboard` | Próxima orden e indicadores principales; resumen de la pila y Deshacer en la barra superior |
| Órdenes de mantenimiento | `#/ordenes` | Listar, filtrar, crear, modificar, cerrar, cancelar y ver detalle |
| Cola de prioridad | `#/cola` | Ver tope y recorrido, atender la más prioritaria y cancelar |
| Equipos e índice AVL | `#/equipos` | Listar solo activos, buscar, crear o reactivar, editar nombre/área y dar de baja lógica |
| Gestión de áreas | `#/areas` | CRUD con conteo de equipos asociados |
| Historial de acciones | `#/historial` | Ver la pila LIFO persistente y deshacer la última acción, incluida `BAJA_EQUIPO` |
| Indicadores y estadísticas | `#/estadisticas` | Tarjetas y distribuciones reales de la API |
| Huella de carbono | `#/carbono` | Consultar resumen y registros, registrar cálculos, guardar parámetros por equipo y actualizar el factor de emisión |

## 6. Endpoints usados

```text
GET    /api/estado
GET    /api/areas
POST   /api/areas
PUT    /api/areas/{idArea}
DELETE /api/areas/{idArea}

GET    /api/equipos
POST   /api/equipos
PUT    /api/equipos/{codigo}
DELETE /api/equipos/{codigo}

GET    /api/ordenes
GET    /api/ordenes/cola
GET    /api/ordenes/historial
POST   /api/ordenes
PUT    /api/ordenes/{id}
POST   /api/ordenes/{id}/cerrar
POST   /api/ordenes/{id}/cancelar
POST   /api/ordenes/atender-siguiente
POST   /api/ordenes/historial/deshacer

GET    /api/estadisticas
GET    /api/carbono/resumen
GET    /api/carbono/registros
POST   /api/carbono/registros
GET    /api/carbono/configuracion
PUT    /api/carbono/configuracion
PUT    /api/carbono/equipos/{codigo}/parametros
```

## 7. Contrato de equipos y bajas

- **Listado solo de activos:** `GET /api/equipos` devuelve únicamente equipos con
  `activo = true`, en recorrido inorden por `codigo`. La interfaz no muestra ni simula
  equipos inactivos.
- **Identidad interna y clave de negocio:** la PK es `id`, pero las rutas, la búsqueda y el
  formulario usan `codigo`. El frontend no construye rutas `/api/equipos/{id}`.
- **Código inmutable:** `PUT /api/equipos/{codigo}` solo actualiza `nombre` e `idArea`. La
  interfaz lo muestra como campo de solo lectura al editar.
- **Mayúsculas y espacios:** el backend aplica `trim` al código, pero no lo convierte a
  mayúsculas. El formulario conserva el texto tal como se escribe; ya no normaliza a
  mayúsculas en el cliente.
- **Crear o reactivar:** `POST /api/equipos` responde `201` cuando crea un equipo nuevo y
  `200` cuando el código pertenece a un equipo inactivo y lo reactiva. El frontend
  distingue ambos códigos y muestra el mensaje correspondiente. Un código activo duplicado
  responde `409`.
- **Baja lógica:** `DELETE /api/equipos/{codigo}` responde `204` sin cuerpo, conserva el
  registro, lo marca inactivo y elimina únicamente sus órdenes `PENDIENTE`. Las órdenes
  `CERRADA` y `CANCELADA` se conservan. La interfaz no envía `eliminarOrdenes` ni espera
  `409` por órdenes asociadas.
- **Una sola acción de deshacer:** cada baja genera una única acción compuesta
  `BAJA_EQUIPO` en la pila. El historial la muestra como una fila y el deshacer restaura el
  equipo y las órdenes pendientes eliminadas.
- **Pila persistente:** `GET /api/ordenes/historial` devuelve las acciones no deshechas, de
  la más reciente a la más antigua. La pila se conserva al reiniciar el backend.
- **Áreas con equipos:** no se eliminan desde la interfaz ni desde el backend.
- **Criticidad:** se calcula en el cliente solo para la vista previa del formulario y se
  muestra la que devuelve el backend. Fórmula:
  `2 × impacto + 2 × riesgo + 2 si no hay respaldo`.
- **Cola e historial:** el orden y las acciones son responsabilidad del backend; el
  frontend no reordena ni inventa estados.

## 8. Limitaciones conocidas

- **Huella de carbono:** el frontend muestra el resumen y los registros reportados por
  esos endpoints. Cuando la API devuelve cero registros y desgloses vacíos, muestra un
  escenario de demostración calculado en el cliente, identificado con un badge y un aviso;
  no se envía al backend ni se guarda. La creación o edición de mediciones no está
  habilitada desde la interfaz.
- **Árbol AVL:** la API devuelve el recorrido inorden y la altura, no la forma interna del
  árbol. La vista muestra el índice ordenado y las métricas reales, sin dibujar nodos
  inventados.
- **Equipos inactivos:** no existe un endpoint para listarlos. La única forma de reactivar
  uno desde la interfaz es crear un equipo con su código exacto y los datos deseados.
- **Alcance de la auditoría:** este árbol de trabajo solo contiene el frontend; no incluye
  las fuentes Spring Boot ni el esquema SQL. El contrato se tomó de la especificación
  entregada. La instancia pública de Render consultada en modo lectura todavía responde al
  contrato anterior (sin `id`/`activo`), así que no se usó para validar `BAJA_EQUIPO`.

## 9. Propuestas de API (no implementadas)

Estas propuestas no se usaron en el frontend porque el contrato actual no las ofrece:

1. **Listado de equipos inactivos** (`GET /api/equipos/inactivos` o un parámetro
   equivalente) para revisar y reactivar equipos sin conocer el código de memoria. No se
   debe simular en el cliente con `?activo=false` ni filtrando el listado de activos.
2. **Detalle explícito en las acciones `BAJA_EQUIPO`:** si el DTO de
   `GET /api/ordenes/historial` no incluye el código/nombre del equipo y el número o la
   lista de órdenes `PENDIENTE` eliminadas, conviene exponerlos en solo lectura. El
   frontend los muestra cuando están presentes y usa un texto genérico cuando no, sin
   inventar datos.
3. **Ninguna ruta por `id`:** se mantiene `codigo` en todas las rutas de equipos, como
   exige el contrato actual.

## 10. Verificación sugerida

```bash
for file in frontend/js/*.js frontend/js/views/*.js; do node --check "$file"; done
```

Prueba de contrato de solo lectura (desde la raíz):

```bash
node --input-type=module -e "
import { api } from './frontend/js/api.js';
const [estado, areas, equipos, ordenes, cola, historial, stats] = await Promise.all([
  api.estado(), api.areas.listar(), api.equipos.listar(), api.ordenes.listar(),
  api.ordenes.cola(), api.ordenes.historial(), api.estadisticas()
]);
console.log({ areas: areas.length, equipos: equipos.length, ordenes: ordenes.length,
  cola: cola.length, historial: historial.length, total: stats.totalOrdenes });
"
```

Las operaciones de escritura deben probarse contra una base de datos de prueba o con
autorización explícita, porque modifican la base compartida.
