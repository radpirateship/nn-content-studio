import { type NextRequest, NextResponse } from 'next/server'
import { replaceWithShopifyImages } from '@/lib/shopifyImageUpload'
import { getShopifyAccessToken, SHOPIFY_ADMIN_DOMAIN } from '@/lib/shopifyAuth'

export const maxDuration = 120

const API_VERSIONS = ['2024-10', '2024-07', '2024-04', '2024-01']

// Same helper pattern as blog/publish — tries each API version in order
async function shopifyAdminFetch(path: string, options: RequestInit = {}) {
  const token = await getShopifyAccessToken()
  const errors: string[] = []

  for (const version of API_VERSIONS) {
    const url = `https://${SHOPIFY_ADMIN_DOMAIN}/admin/api/${version}/${path}`
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
          ...options.headers,
        },
      })

      if (response.ok) return response.json()

      const status = response.status
      const body = await response.text()
      errors.push(`v${version}: ${status} — ${body.slice(0, 200)}`)

      if (status === 401 || status === 403) {
        throw new Error(`Shopify auth failed (${status}): ${body.slice(0, 200)}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!errors.includes(msg)) errors.push(msg)
      if (version === API_VERSIONS[API_VERSIONS.length - 1]) {
        throw new Error(`All API versions failed. Errors: ${errors.join(' | ')}`)
      }
    }
  }

  throw new Error(`All Shopify API versions failed. Errors: ${errors.join(' | ')}`)
}

/**
 * POST /api/shopify/pages/publish
 *
 * Publishes an ultimate guide as a Shopify Page (not a blog article).
 * Pages API: /admin/api/{version}/pages.json
 *
 * Key difference from blog/publish:
 * - Uses pages.json endpoint instead of blogs/{id}/articles.json
 * - No blog_id or author field
 * - No featured_image field on pages — hero image is baked into body_html
 * - Meta title/description go in metafields (same pattern)
 * - Returns /pages/{handle} URL
 */
export async function POST(request: NextRequest) {
  try {
    const {
      title,
      bodyHtml,
      handle,
      metaDescription,
      published = true,
    } = await request.json()

    if (!title || !bodyHtml) {
      return NextResponse.json(
        { error: 'title and bodyHtml are required' },
        { status: 400 }
      )
    }

    // Safety-net: upload any remaining temp images to Shopify CDN
    // (should be a no-op if the image storyboard already uploaded everything)
    const hasTempImages = /data:image\/|fal\.media|fal\.run|fal-cdn|v3\.fal\.media/.test(bodyHtml)
    let processedHtml: string

    if (hasTempImages) {
      console.warn('[pages-publish] Found temp images — running safety-net upload...')
      processedHtml = await replaceWithShopifyImages(bodyHtml)
    } else {
      console.log('[pages-publish] All images already on CDN — skipping re-upload.')
      processedHtml = bodyHtml
    }

    // Build the page payload
    const pagePayload: Record<string, unknown> = {
      title,
      body_html: processedHtml,
      handle: handle || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      published,
    }

    // Add metafields for SEO title tag + description
    if (metaDescription) {
      pagePayload.metafields = [
        {
          namespace: 'global',
          key: 'title_tag',
          value: title,
          type: 'single_line_text_field',
        },
        {
          namespace: 'global',
          key: 'description_tag',
          value: metaDescription.replace(/[\r\n]+/g, ' ').trim().slice(0, 160),
          type: 'single_line_text_field',
        },
      ]
    }

    const data = await shopifyAdminFetch('pages.json', {
      method: 'POST',
      body: JSON.stringify({ page: pagePayload }),
    })

    const createdPage = data.page
    const pageUrl = `https://nakednutrition.com/pages/${createdPage.handle}`

    // Sitemap pings — same as blog/publish
    const sitemapUrl = 'https://nakednutrition.com/sitemap.xml'
    const pingResults: Record<string, string> = {}
    const pingUrls = [
      { name: 'Google',   url: `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` },
      { name: 'Bing',     url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` },
      { name: 'IndexNow', url: `https://api.indexnow.org/indexnow?url=${encodeURIComponent(pageUrl)}&key=nakednutrition` },
    ]
    for (const ping of pingUrls) {
      try {
        const res = await fetch(ping.url)
        pingResults[ping.name] = res.ok ? 'sent' : `${res.status}`
      } catch {
        pingResults[ping.name] = 'failed'
      }
    }

    return NextResponse.json({
      success: true,
      page: {
        id: createdPage.id,
        title: createdPage.title,
        handle: createdPage.handle,
        url: pageUrl,
        published_at: createdPage.published_at,
        created_at: createdPage.created_at,
      },
      sitemapPing: pingResults,
    })
  } catch (error) {
    console.error('[pages-publish]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish page to Shopify' },
      { status: 500 }
    )
  }
}
