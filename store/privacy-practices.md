# Chrome Web Store: Privacy practices tab

Answers for the Developer Dashboard's **Privacy practices** tab. They must
match the code and [PRIVACY.md](../PRIVACY.md); update all three together.

## Single purpose

```text
Hide news articles whose headline contains keywords chosen by the user, on websites the user enables.
```

## Permission justifications

| Permission                             | Justification (paste into the dashboard)                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`                              | Saves the user's keyword list and the list of websites where filtering is enabled, locally in the browser.                                                                                                                                             |
| `scripting`                            | Registers the content script that hides matching articles, only on the websites the user enabled, and injects it into tabs already open on a newly enabled website so the user does not have to reload.                                                |
| `activeTab`                            | Reads the address of the current tab when the user opens the popup, to show the website's name and let the user enable or disable filtering on it.                                                                                                     |
| Host permissions (optional, `*://*/*`) | Nothing is granted at install. When the user turns on filtering for a website in the popup, the extension requests access to that website only (`*://*.site/*`), to read its headlines and hide matching articles. The user can revoke it at any time. |
| Remote code                            | No. All code is packaged with the extension; it loads no remote scripts, uses no `eval` and makes no network requests.                                                                                                                                 |

## Data usage

Check **none** of the data types (personally identifiable information, health,
financial, authentication, personal communications, location, web history,
user activity, website content). The extension reads headlines on enabled
websites only to decide what to hide, inside the browser; it does not collect
or transmit them, so this is not "collection" under the Web Store definitions.

Then certify the three statements:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

```text
https://github.com/josefuentes4096/nomeinteresa/blob/main/PRIVACY.md
```
