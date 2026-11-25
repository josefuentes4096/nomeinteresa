# nomeinteresa: project constitution

Chrome extension (Manifest V3) that **hides news articles whose title contains any of the user's keywords**, on the sites the user enables (for example, every football article on a news portal). The product is described in [docs/specs/001-keyword-filter/spec.md](docs/specs/001-keyword-filter/spec.md), which is the source of truth for behavior.

## Non-negotiable rules

1. **Build only what was asked.** Do not add features, options or files beyond the request. List possible extras at the end of your answer as suggestions, and wait for a yes before you build them.
2. **No network access.** The extension must not contact any server: no `fetch`, `XMLHttpRequest`, `WebSocket` or remote resources in `extension/`. Keywords and sites never leave the browser.
3. **Minimal permissions.** Host access is requested at runtime, per site, only when the user enables that site (`optional_host_permissions`). Do not add permissions, `host_permissions` or static `content_scripts` without justifying it in the PR and in the permissions table in both READMEs.
4. **All UI text is localized.** Every visible string lives in `extension/_locales/{en,es}/messages.json`, with the same keys in both files. `tests/locales.test.js` enforces this.
5. **Match titles only.** Filtering decides on the article's title: its headline plus its lead-in (kicker), never on the summary, byline, URL or body text.
6. **Content scripts are classic scripts.** `extension/content/filter-core.js` holds the matching and hiding logic: no `import`/`export`, no `chrome.*` calls and only top-level function declarations, so it runs in Node tests and in plain pages. `extension/content/filter.js` wires it to `chrome.storage`. `tests/filter-core.test.js` enforces the first part.
7. **Leave the page restorable.** The only changes made to a page are the `data-nomeinteresa-hidden` attribute and one `<style>` element. `clearKeywordFilter` must undo both, and it runs whenever filtering stops (site disabled, keywords cleared).

## Workflow

- **Trunk-based development with PRs.** `main` is the only long-lived branch. Work on a short-lived branch (`fix/…`, `feat/…`, `docs/…`) and merge through a PR once CI passes. Never commit to `main` directly. See [CONTRIBUTING.md](CONTRIBUTING.md).
- **Spec-driven, sized to the change:**

  | Change                                   | Required spec work                                                                                                           |
  | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
  | Bug fix that restores specified behavior | PR description + a test that reproduces the bug                                                                              |
  | New or changed behavior                  | New spec in `docs/specs/NNN-short-name/spec.md` from `_template.md`, or an update to an existing one, agreed **before** code |
  | Architectural change                     | Spec plus its "Design" and "Tasks" sections filled in                                                                        |

  The spec goes in the same PR as the code. When behavior changes, update spec 001 (or the relevant spec) in that PR so the spec keeps matching the product.

- **Acceptance criteria become tests.** Each criterion links to the unit test (`tests/`) or end-to-end fixture (`tests/e2e/fixtures/`) that verifies it.
- **A site that filters badly becomes a fixture.** Reproduce its markup in `tests/e2e/fixtures/` with `data-expect="hidden|visible"` before changing the card heuristic.
- Update `CHANGELOG.md` under "Sin publicar" for user-visible changes.
- Commit messages: imperative mood, in English (`Hide cards added by infinite scroll`).

## Commands

```sh
npm run check      # lint + format check + type check + unit tests (must pass)
npm run test:e2e   # content scripts in headless Chrome (must pass for content script changes)
npm run format     # Prettier
npm run package    # dist/nomeinteresa-<version>.zip for the Chrome Web Store
npm run store-assets  # regenerate store/images/ after visible popup changes
```

## Code conventions

- Plain JavaScript with ES modules (except the content scripts, see rule 6), `// @ts-check` and JSDoc types, checked by `tsc` (`jsconfig.json`). No build step: `extension/` is exactly what ships.
- Pure logic (settings validation, presets, matching) lives in modules without `chrome.*` calls at import time, so Node tests can import them.
- Enabling a site **is** granting host access to it. The service worker turns permission events into the stored site list and the content script registration; the popup only requests or removes the permission.
- Keyword presets live in `extension/shared/presets.js`. Avoid keywords that are also common words (matching is whole-word, case- and accent-insensitive on every title).
- Name constants instead of using magic numbers. Document why, not what.

## Documentation

- Permissions and data handling are described in `README.md`, `README.es.md`, `PRIVACY.md` and `store/privacy-practices.md`. Change them together; `tests/manifest.test.js` fails if the manifest's permissions drift.
- Releases follow [docs/publishing.md](docs/publishing.md).

- `README.md` (English) and `README.es.md` (Spanish) must stay in sync.
- Specs and code comments are in English.
