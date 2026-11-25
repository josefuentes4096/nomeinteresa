# Chrome Web Store listing

Copy these texts into the Developer Dashboard (**Store listing** tab). The
English listing is the default; add Spanish as a second language with the same
fields. Keep the descriptions free of lists of names or brands: the Web Store's
keyword-spam policy rejects listings stuffed with search terms.

| Field              | Value                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Name               | nomeinteresa (from `extName` in `extension/_locales/*/messages.json`)                         |
| Summary            | From `extDescription` (max. 132 characters, enforced by `tests/manifest.test.js`)             |
| Category           | Productivity → Tools (alternative: Lifestyle → News & Weather)                                |
| Language           | English (default), Spanish                                                                    |
| Homepage URL       | https://github.com/josefuentes4096/nomeinteresa                                               |
| Support URL        | https://github.com/josefuentes4096/nomeinteresa/issues                                        |
| Privacy policy URL | https://github.com/josefuentes4096/nomeinteresa/blob/main/PRIVACY.md                          |
| Store icon         | `store/images/icon-128.png` (128×128, 96×96 artwork with transparent padding)                 |
| Screenshots (EN)   | `store/images/en/screenshot-1-filtered.png`, `-2-before-after.png`, `-3-popup.png` (1280×800) |
| Screenshots (ES)   | `store/images/es/…` (same names)                                                              |
| Small promo tile   | `store/images/en/promo-small-440x280.png` / `store/images/es/promo-small-440x280.png`         |

Regenerate the images with `npm run store-assets` after any visible change to the popup.

## Description — English

```text
nomeinteresa ("I'm not interested") hides the news you don't want to see.

Write the topics you are tired of as keywords. On the news sites you choose, every article whose headline contains one of them disappears: headline, image and summary together, with no empty gaps left behind.

HOW IT WORKS
• Open a news site, click the icon and turn on "Hide matching articles on this site".
• Type your keywords, one per line, or add a ready-made set with one click.
• Matching articles vanish right away, including the ones that load as you scroll.

FEATURES
• Matches whole words and phrases, ignoring capital letters and accents.
• The short lead-in above a headline counts as part of the title.
• Keywords in "double quotes" match capital letters exactly, for names that are also common words.
• Ready-made keyword sets: celebrity gossip, football, motorsport, rugby, tech optimism, food awards and celebrities. Edit them freely after adding.
• A report lists every hidden article and the keyword that hid it.
• A red badge on the toolbar icon shows how many articles are hidden on the current tab.
• English and Spanish interface.

PRIVACY
• Nothing leaves your browser: no analytics, no tracking, no account, no network requests.
• Access is requested one site at a time, only for the sites you enable. You can remove it whenever you want.

This is an open-source project built for academic purposes. It is not affiliated with any media outlet.
```

## Description — Español

```text
nomeinteresa oculta las noticias que no quieres ver.

Escribe como palabras clave los temas que te cansan. En los sitios de noticias que elijas, cada artículo cuyo titular contenga una de ellas desaparece: titular, imagen y resumen juntos, sin dejar huecos.

CÓMO FUNCIONA
• Abre un sitio de noticias, haz clic en el icono y activa "Ocultar artículos coincidentes en este sitio".
• Escribe tus palabras clave, una por línea, o agrega un conjunto listo con un clic.
• Los artículos coincidentes desaparecen al instante, también los que se cargan al desplazarte.

FUNCIONES
• Coincide con palabras y frases completas, sin distinguir mayúsculas ni acentos.
• La volanta sobre el titular cuenta como parte del título.
• Las palabras "entre comillas" respetan las mayúsculas, para nombres que también son palabras comunes.
• Conjuntos de palabras listos: farándula, fútbol, automovilismo, rugby, tecnoptimistas, gastronomía y celebridades. Edítalos como quieras después de agregarlos.
• Un informe lista cada artículo oculto y la palabra que lo ocultó.
• Un contador rojo en el icono muestra cuántos artículos se ocultaron en la pestaña actual.
• Interfaz en español e inglés.

PRIVACIDAD
• Nada sale de tu navegador: sin analíticas, sin rastreo, sin cuentas, sin solicitudes de red.
• El acceso se pide de a un sitio, solo para los sitios que actives. Puedes quitarlo cuando quieras.

Proyecto de código abierto con fines académicos. No está afiliado a ningún medio de comunicación.
```
