# Publishing to the Chrome Web Store

Checklist for publishing a version of nomeinteresa. Everything the dashboard
asks for is prepared in the repository:

| What                         | Where                                                         |
| ---------------------------- | ------------------------------------------------------------- |
| Upload package               | `dist/nomeinteresa-<version>.zip` (`npm run package`)         |
| Listing texts and image list | [`store/listing.md`](../store/listing.md)                     |
| Privacy practices answers    | [`store/privacy-practices.md`](../store/privacy-practices.md) |
| Images                       | `store/images/` (`npm run store-assets`)                      |
| Privacy policy               | [`PRIVACY.md`](../PRIVACY.md), published on GitHub            |

## One-time setup

1. Push the repository to <https://github.com/josefuentes4096/nomeinteresa> and make it public, so the privacy policy URL in `store/listing.md` works.
2. Register as a Chrome Web Store developer at <https://chrome.google.com/webstore/devconsole> (one-time registration fee) and verify the contact email.

## Each release

1. **Version.** Bump `version` in both `package.json` and `extension/manifest.json` (Semantic Versioning). `tests/manifest.test.js` fails if they differ, and the store rejects a version that is not higher than the published one.
2. **Changelog.** In `CHANGELOG.md`, rename "Sin publicar" to `[X.Y.Z] - YYYY-MM-DD` and start a new empty "Sin publicar" section.
3. **Checks.** `npm run check` and `npm run test:e2e` must pass.
4. **Images.** If the popup changed, run `npm run store-assets` and review `store/images/`.
5. **Package.** `npm run package` → `dist/nomeinteresa-X.Y.Z.zip`. CI also builds it and keeps it as the `extension-zip` artifact of each run.
6. **Smoke test.** In `chrome://extensions`, remove any unpacked copy, unzip the package to a temporary folder and load it with **Load unpacked**. Enable a news site, add a keyword set and check the badge and the report.
7. **Upload.** Developer Dashboard → the item → **Package** → **Upload new package**.
8. **Listing and privacy.** On the first release, fill in the **Store listing** and **Privacy practices** tabs from `store/listing.md` and `store/privacy-practices.md`. On later releases, update them only if something changed (new permission, new feature in the description, new screenshots).
9. **Submit for review.** Reviews usually take from a few hours to a few days. Optional host permissions requested at runtime keep the review simpler than broad host permissions granted at install.
10. **Tag.** After approval: `git tag vX.Y.Z && git push origin vX.Y.Z`.

## If the review asks about permissions

The justifications in `store/privacy-practices.md` describe exactly what the code does. The key points: no host access is granted at install; access is requested per website from a user click in the popup; nothing is sent over the network.
