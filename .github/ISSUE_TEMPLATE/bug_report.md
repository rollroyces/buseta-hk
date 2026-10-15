---
name: Bug report
about: Something is broken or behaves incorrectly
title: "[bug] "
labels: bug
assignees: ""
---

## Summary

<!-- One sentence describing the bug. -->

## Steps to reproduce

<!-- A numbered list of the steps. The clearer these are, the faster the bug
     gets fixed. If possible, link to the live app at
     https://rollroyces.github.io/buseta-hk/ and the specific page/view
     where the bug appears (e.g. #/route/970, #/stop/MA973). -->

1.
2.
3.

## Expected behavior

<!-- What you expected to happen. -->

## Actual behavior

<!-- What actually happened. Screenshots, console output, or a HAR file of
     the network request that went wrong are all useful here. -->

## Environment

- **Browser + version**: (e.g. Safari 18, Chrome 130, Firefox 132)
- **Device**: (e.g. iPhone 15, Pixel 8, desktop)
- **OS**: (e.g. iOS 18, Android 15, macOS 15, Windows 11)
- **App version**: (visible at the top of the in-page release notes —
  or in DevTools → Application → Service Workers → buseta-vNN)
- **Connectivity**: (online / offline / flaky cellular — useful for
  ETA-fetch bugs)

## Logs / screenshots

<!-- Paste browser console output (especially `console.warn` /
     `console.error`) here, or attach a screenshot / screen recording.
     For network bugs, paste the failing fetch's URL + status. -->

```
<paste console output here>
```

## Additional context

<!-- Anything else relevant — related issues, prior PRs, similar bugs
     in other apps, etc. -->

## Checklist

<!-- Mark with an `x` for completed items. -->

- [ ] I checked the [open issues](https://github.com/rollroyces/buseta-hk/issues)
      and confirmed this isn't a duplicate
- [ ] I can reproduce this on a fresh page load
- [ ] I cleared the service worker (DevTools → Application → Service Workers
      → Unregister) and the bug still reproduces
- [ ] I checked the [browser DevTools console](https://developer.chrome.com/docs/devtools/console)
      and saw no obvious errors