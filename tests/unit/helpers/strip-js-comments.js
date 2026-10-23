// Shared helper: strip JS comments without touching string/regex literals.
//
// A naive `src.replace(/\/\*[\s\S]*?\*\//g, '')` is WRONG when a
// line comment contains `/*` — e.g. sw.js's
//
//     // The `src/utils/*.js` modules are included because they are
//
// The block-comment regex then matches from that `/*` all the way to the
// next `*/`, swallowing real code in between. (This bit us while
// writing `tests/unit/sw-shell.test.js` — the SWELL array vanished.)
//
// So: a small character scanner that tracks whether we're inside a
// line comment, a block comment, a single/double-quoted string, or a
// template literal. Regex literals are not handled (neither file uses
// one in a way that matters here) — but a `/` that starts a regex is
// left alone, which is the safe default for our use.

/**
 * @param {string} src
 * @returns {string}
 */
export function stripJsComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];

    // Line comment
    if (ch === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      // Keep newlines so line numbers stay roughly stable.
      out += ' ';
      continue;
    }

    // String literal — copy verbatim (including the quotes) so we
    // don't accidentally treat a `//` inside a string as a comment.
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        if (src[i] === '\\') {
          out += src.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}
