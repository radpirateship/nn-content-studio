/**
 * Escape special characters for safe interpolation into HTML strings.
 * Prevents XSS from untrusted data (product titles, user input, etc.)
 * being injected into generated HTML.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Escape a string for use in an HTML attribute value (already quoted).
 * Same as escapeHtml but explicitly named for clarity at call sites.
 */
export const escapeAttr = escapeHtml;
