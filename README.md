# AutomationHub · n8n Lab

Cheatsheet interactiva en español para aprender n8n practicando.

- Biblioteca de 53 nodos con búsqueda por nombre, descripción y operaciones, categorías, favoritos y estado de aprendizaje.
- Laboratorio guiado: editá un array de items, normalizá campos e inspeccioná las dos ramas de IF con un umbral configurable.
- Diez desafíos con explicaciones, enlaces a la documentación y reintentos.
- Ruta de seis etapas con proyectos y 18 objetivos de autoevaluación.
- Nueve ejemplos de flujos básicos y necesidades de negocio, con iconos SVG, configuración, entradas y salidas ilustrativas, ejercicios y guías descargables en Markdown.
- Reporte mensual con escenarios interactivos: buscar/crear año y mes, reutilizar/copiar el reporte desde una plantilla, fijar IDs, consultar BigQuery o SQL, anexar y conciliar antes del email.
- Patrón de paginación con subworkflows y estimador de lotes por bytes y tiempo del padre.

## Abrir la página

La aplicación sigue siendo un único HTML, sin compilación ni dependencias de ejecución. Abrí `n8n-cheatsheet.html` o serví esta carpeta:

```sh
python3 -m http.server 4173
```

Después visitá <http://localhost:4173/n8n-cheatsheet.html>.

La ruta publicada en GitHub Pages se conserva: <https://nicopereyraant.github.io/AutomationHub/n8n-cheatsheet.html>. Los cambios se publican al integrarse en la rama que sirve GitHub Pages.

El laboratorio es una simulación de una transformación fija; no ejecuta workflows ni expresiones arbitrarias, y no se conecta a una instancia de n8n. Los ejemplos de negocio son guías con datos ficticios: no ejecutan acciones en servicios externos ni son workflows JSON importables. El caso de leads permite llevar los datos al laboratorio.

Los iconos de los nodos usados en los ejemplos se incorporan como SVG en el HTML. No requieren llamadas a imágenes externas. La atribución, adaptaciones y licencia de origen figuran también en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Las fuentes de Google son opcionales: si no cargan, se usan las fuentes del sistema.

Favoritos, nodos aprendidos, desafíos resueltos y objetivos se guardan en `localStorage` bajo `automationhub.n8n.learning.v1`. Son locales a cada navegador y origen. Si el almacenamiento está bloqueado, se informa y la sesión sigue funcionando en memoria. “Borrar progreso” solicita confirmación y elimina el progreso de esta herramienta.

## Verificar cambios

Requiere Node.js 20 o posterior. Las dependencias siguientes son solo para las pruebas:

```sh
npm ci
npx playwright install chromium
npm test
```

Si ya tenés Chromium instalado, podés usar `CHROMIUM_PATH=/ruta/a/chromium npm test`.

La prueba levanta un servidor temporal y verifica catálogo, búsqueda, filtros, teclado y modal, persistencia, validación y ramas del laboratorio, los diez desafíos, ruta de estudio, borrado con confirmación, almacenamiento bloqueado o corrupto, los nueve casos de negocio y sus descargas, los escenarios de creación/reutilización y conciliación mensual, contratos pequeños de subworkflows, estimación de payload/tiempo, unicidad de IDs SVG y las cinco vistas a 320, 375, 768 y 1440 píxeles.

## Contenido

El catálogo original se conserva con correcciones puntuales en Manual Trigger, Code, Respond to Webhook y Read/Write Files. No es una auditoría exhaustiva de cada integración. Las operaciones disponibles dependen de la versión del nodo y del servicio; los ejercicios y la ruta incluyen enlaces a la documentación oficial para continuar practicando en n8n.

## Criterios de los ejemplos con volumen

- Paginar en la fuente. Partir en lotes después de descargar todo no reduce la carga inicial. En el nodo BigQuery, maxResults controla cada página, no necesariamente el total devuelto.
- Pasar al hijo IDs, período y cursor; devolver un recibo pequeño y el siguiente cursor. No acumular todos los datos en el padre.
- Un padre que espera sus hijos puede exceder su presupuesto total. Acotar reintentos/concurrencia y persistir checkpoints para reanudar desde otra ejecución cuando haga falta.
- Search → Create, Append y email no son transacciones idempotentes. Serializar ejecuciones por período y conciliar escrituras o envíos ambiguos antes de repetir.
- El estimador es orientativo: no conoce la memoria, cuotas ni límites de tu instancia o de cada servicio. Considerar tamaño JSON, copias en memoria, latencia y reintentos.
