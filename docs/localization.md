# Localization

BusETA HK ships with three locales today:

| Locale | Code | Default |
| --- | --- | --- |
| 繁體中文 | `zh-Hant` | ✅ (Hong Kong / Taiwan default) |
| English | `en` | — |
| 简体中文 | `zh-Hans` | — |

All visible strings live in the `STRINGS` table inside `app.js` (it's not split into per-locale files to avoid extra fetches). The structure is keyed by locale, then by string key.

## How a string is looked up

```js
// 1. Define in STRINGS
const STRINGS = {
  'zh-Hant': { greeting: '你好', close: '關閉' },
  'en':      { greeting: 'Hello', close: 'Close' },
  'zh-Hans': { greeting: '你好', close: '关闭' },
};

// 2. Look up at render time
function t(key) {
  const locale = state.locale || 'zh-Hant';
  return STRINGS[locale]?.[key] ?? STRINGS['zh-Hant'][key] ?? key;
}

// 3. Use in the UI
element.textContent = t('greeting');
```

If a string is missing in the current locale, the app falls back to `zh-Hant`, then to the raw key. This makes it safe to ship a partial translation.

## How to add a new locale

1. **Add the locale code** to the locale switcher in `app.js` (`applyI18n()` and the language picker).
2. **Add a new top-level entry** to the `STRINGS` table with the locale code.
3. **Translate each key**. Missing keys fall back to `zh-Hant` automatically, so partial coverage ships safely.
4. **Update `manifest.json`** `lang` field if the default locale changes.
5. **Update the README** feature list to mention the new locale.
6. **Bump `buseta-version`** + `?v=` cache-buster + `sw.js` `CACHE` per [CONTRIBUTING.md](../CONTRIBUTING.md).
7. **Open a PR** with the `localization` label — see the translation-request issue template.

## Translation style guide

- **Use the locale's natural tone.** Hong Kong / Taiwan Traditional Chinese differs from Singapore Traditional Chinese in vocabulary and tone. Match the audience.
- **Don't translate operator names** (KMB, Citybus, MTR, etc.). Keep them in English or use the operator's official local name.
- **Don't translate route numbers** (e.g. `970`, `A20`). They're identifiers.
- **Keep string length bounded.** Layouts are designed for Traditional Chinese character widths — much longer English strings may overflow on mobile.
- **Don't use machine translation as the final answer.** Review with a native speaker.

## Adding i18n to new code

When adding a new UI element, always use `t('key')` — never hardcode strings. The codebase enforces this informally; future ESLint rules (Phase 2+) will check for hardcoded strings in render functions.

## Adding a new i18n key

1. Add the key to **all three** existing locales in `STRINGS` (even if it's the same as one of them — this prevents fallback warnings later).
2. Use it via `t('key')` at render time.
3. Bump `buseta-version` per the pre-deploy checklist.

## Where to ask for translation help

Open an issue with the `localization` label, or contact the maintainer via GitHub.