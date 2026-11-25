# Contribuir

¡Gracias por tu interés!

## Flujo de trabajo: trunk-based development

El proyecto usa _trunk-based development_ con pull requests:

- **`main` es la única rama permanente** y siempre debe estar en estado publicable.
- **Ramas cortas:** crea una rama desde `main` para cada cambio (`fix/infinite-scroll`, `feat/new-preset`…) y fusiónala en uno o dos días como máximo. Nada de ramas `develop` ni de ramas de larga duración.
- **Cambios pequeños:** un PR, un cambio. Si algo es grande, divídelo en varios PR que se puedan fusionar por separado.
- **Todo entra por PR:** no se hace commit directo a `main`. El PR se fusiona cuando la CI pasa y tiene la revisión aprobada.
- **Versiones:** se publican desde `main` con una etiqueta `vX.Y.Z`, siguiendo [Semantic Versioning](https://semver.org/lang/es/).

## Especificaciones (spec-driven development)

El comportamiento del producto se define en [`docs/specs/`](docs/specs/). La spec principal es [001: ocultar artículos por palabras del título](docs/specs/001-keyword-filter/spec.md). El trabajo de especificación se ajusta al tamaño del cambio:

- **Arreglo que restaura un comportamiento ya especificado:** basta con la descripción del PR y un test que reproduzca el fallo.
- **Comportamiento nuevo o modificado:** crea una spec a partir de [`docs/specs/_template.md`](docs/specs/_template.md), o actualiza la existente, y acuérdala **antes** de escribir código.
- **Cambio de arquitectura:** spec con las secciones "Design" y "Tasks" completas.

La spec va en el mismo PR que el código, y cada criterio de aceptación enlaza al test que lo verifica. Las reglas del proyecto para agentes de IA y personas están en [`CLAUDE.md`](CLAUDE.md).

## Antes de abrir un pull request

1. `npm install` y luego `npm run check` y `npm run test:e2e`. La CI ejecuta lo mismo y debe pasar.
2. Añade o actualiza los tests en `tests/` si cambias lógica pura (coincidencias, ajustes, conjuntos), y en `tests/e2e/` si cambias cómo se detectan u ocultan los artículos. Si un sitio filtra mal, reproduce su marcado como página de prueba en `tests/e2e/fixtures/` con `data-expect="hidden|visible"`.
3. Prueba manualmente la extensión cargando `extension/` en `chrome://extensions`, en un portal de noticias real:
   - activar el sitio (y denegar el permiso una vez),
   - agregar y quitar palabras con la pestaña abierta,
   - desplazarte hasta que cargue más contenido.
4. Actualiza `CHANGELOG.md` en la sección "Sin publicar".

## Reglas del proyecto

- **Sin llamadas de red.** La extensión no debe contactar con ningún servidor.
- **Mínimos permisos.** El acceso a sitios se pide en tiempo de ejecución, por sitio. No añadas permisos ni `host_permissions` sin justificarlo en el PR y en la tabla del README.
- **Textos traducidos.** Todo texto visible va en `extension/_locales/*/messages.json`, en todos los idiomas. Un test lo comprueba.
- **Solo títulos.** El filtro decide por el titular del artículo, nunca por el resumen, la URL ni el cuerpo.
- **Scripts de contenido clásicos.** `content/filter-core.js` no usa `import`/`export` ni `chrome.*`. Un test lo comprueba.
- Mensajes de commit en modo imperativo y en inglés (`Hide cards added by infinite scroll`).
