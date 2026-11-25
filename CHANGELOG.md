# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto sigue
[Semantic Versioning](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- Compatibilidad con Firefox (140 o superior, escritorio) con el mismo código, el mismo manifiesto y el mismo paquete que Chrome. La CI valida la extensión con `web-ext lint` de Mozilla.
- Preparación para la Chrome Web Store: nombre **nomeinteresa**, versión 1.0.0, política de privacidad (`PRIVACY.md`), textos de la ficha y respuestas de privacidad (`store/`), imágenes generadas con `npm run store-assets`, paquete con `npm run package` y guía de publicación (`docs/publishing.md`).
- Oculta los artículos cuyo título contiene alguna de tus palabras clave, sin distinguir mayúsculas ni acentos, como tarjetas completas.
- Activación por sitio desde la ventana de la extensión, con permiso de acceso pedido solo para ese sitio.
- Conjuntos de palabras predefinidos: Farándula, Fútbol, Automovilismo, Rugby, Tecnoptimistas, Gastronomía y Celebridades. Las listas se muestran en orden alfabético.
- La volanta (texto corto antes del titular) cuenta como parte del título.
- Palabras clave entre comillas dobles que respetan mayúsculas (`"Máxima"` no oculta "temperatura máxima").
- Contador rojo en el icono de la barra de herramientas con la cantidad de artículos ocultos en la pestaña.
- Informe en la ventana de la extensión con los artículos ocultos en la página (volanta, titular y palabra clave que coincidió) y su cantidad.
- Filtrado de los artículos que se cargan al desplazarse y aplicación inmediata de los cambios en las pestañas abiertas.
- Tests unitarios y tests end-to-end contra Chrome real con páginas que reproducen el marcado habitual de portales de noticias.
- Proceso de desarrollo guiado por especificaciones (`CLAUDE.md`, plantilla y spec 001).
