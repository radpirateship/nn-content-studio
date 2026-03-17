/**
 * Converts a plain <img> tag into a <picture> element with WebP source and JPEG fallback.
 * Works with Shopify CDN URLs which support ?format=webp parameter.
 * Non-Shopify URLs get a passthrough (no WebP source added).
 */
export function imgToPicture(imgTag: string): string {
  const srcMatch = imgTag.match(/src=["']([^"']+)["']/)
  if (!srcMatch) return imgTag

  const src = srcMatch[1]
  const isShopifyCdn = src.includes('cdn.shopify.com')

  if (!isShopifyCdn) return imgTag // can't generate WebP for non-Shopify URLs

  // Build WebP URL using Shopify CDN's format parameter
  const separator = src.includes('?') ? '&' : '?'
  const webpSrc = `${src}${separator}format=webp`

  // Extract width/height for srcset sizing hints
  const widthMatch = imgTag.match(/width=["']?(\d+)["']?/)
  const width = widthMatch ? widthMatch[1] : ''
  const srcsetAttr = width ? ` srcset="${webpSrc} ${width}w"` : ''
  const srcsetJpeg = width ? ` srcset="${src} ${width}w"` : ''

  // Replace the <img> with a <picture> wrapper
  return `<picture>
  <source type="image/webp"${srcsetAttr} src="${webpSrc}">
  ${imgTag.replace(/\/?>$/, `${srcsetJpeg} />`)}
</picture>`
}

/**
 * Scans an HTML string and converts all <img> tags to <picture> elements with WebP.
 * Skips images that are already inside <picture> tags.
 */
export function upgradeImagesToPicture(html: string): string {
  // Don't double-wrap images already in <picture>
  return html.replace(/<img\b[^>]*>/gi, (match, offset) => {
    // Check if this img is already inside a <picture> tag
    const preceding = html.slice(Math.max(0, offset - 100), offset)
    if (/<picture[^>]*>\s*(?:<source[^>]*>\s*)*$/i.test(preceding)) return match
    return imgToPicture(match)
  })
}

/**
 * Extracts a clean URL string from whatever the image pipeline returns.
 * Guards against double-encoded or nested <img> tag strings being passed as src values.
 */
export function extractImageUrl(value: string): string {
  if (!value) return '';

  // Already a clean URL (http/https or data URI without nested HTML)
  if (
    (value.startsWith('http') || value.startsWith('data:image')) &&
    !value.includes('<img') &&
    !value.includes('%3C')
  ) {
    return value;
  }

  // It's a full <img> tag — extract just the src
  const srcMatch = value.match(/src=["']([^"']+)["']/);
  if (srcMatch) return srcMatch[1];

  // It's URL-encoded — decode and retry
  try {
    const decoded = decodeURIComponent(value);
    const decodedMatch = decoded.match(/src=["']([^"']+)["']/);
    if (decodedMatch) return decodedMatch[1];
  } catch {
    /* ignore decode errors */
  }

  console.error(
    '[imageUtils] Could not extract clean URL from value:',
    value.slice(0, 100)
  );
  return '';
}
