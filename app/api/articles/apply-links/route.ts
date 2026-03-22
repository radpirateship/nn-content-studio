import { type NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";

// Link icon SVG
const LINK_ICON = `<svg stroke-linejoin="round" stroke-linecap="round" stroke-width="2" stroke="currentColor" fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>`;

// Max body size: 2MB
const MAX_BODY_SIZE = 2_000_000;

/**
 * Sanitize a URL for safe embedding in an HTML href attribute.
 * Rejects javascript: URIs, data: URIs, and anything that isn't http(s).
 * Escapes quotes to prevent attribute breakout.
 */
function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    // Escape characters that could break out of the href attribute
    return parsed.href.replace(/"/g, "%22").replace(/'/g, "%27");
  } catch {
    return null;
  }
}

/**
 * POST /api/articles/apply-links
 * 
 * Takes APPROVED link suggestions and injects them into the article HTML.
 * Only approved links with anchor text are applied.
 */
export async function POST(request: NextRequest) {
  try {
    const { articleId, htmlContent, approvedLinks } = await request.json();

    if (!htmlContent) {
      return NextResponse.json({ error: "htmlContent is required" }, { status: 400 });
    }

    if (typeof htmlContent === "string" && htmlContent.length > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: `HTML content exceeds ${MAX_BODY_SIZE / 1_000_000}MB limit` },
        { status: 413 }
      );
    }

    if (!approvedLinks || approvedLinks.length === 0) {
      return NextResponse.json({ error: "No approved links to apply" }, { status: 400 });
    }

    let enrichedHTML = htmlContent;
    let linksApplied = 0;

    // Filter out malformed links and sort by anchor text length (longest first) to avoid partial matches
    const sortedLinks = [...approvedLinks]
      .filter((l: { anchorText?: string; editedAnchor?: string; targetUrl?: string; editedUrl?: string }) =>
        (l.editedAnchor || l.anchorText) && (l.editedUrl || l.targetUrl)
      )
      .sort(
        (a: { anchorText: string; editedAnchor?: string }, b: { anchorText: string; editedAnchor?: string }) =>
          (b.editedAnchor || b.anchorText).length - (a.editedAnchor || a.anchorText).length
      );

    for (const link of sortedLinks) {
      const anchor = link.editedAnchor || link.anchorText;
      const rawUrl = link.editedUrl || link.targetUrl;

      if (!anchor || !rawUrl) continue;

      // Sanitize URL to prevent XSS (reject javascript:, data:, etc.)
      const url = sanitizeUrl(rawUrl);
      if (!url) {
        console.warn(`[apply-links] Rejected unsafe URL: "${rawUrl.slice(0, 100)}"`);
        continue;
      }

      const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Strategy: split HTML into tags and text nodes, only replace in text nodes
      // that are NOT inside an existing <a> tag
      let insideAnchor = 0;
      let replaced = false;
      
      enrichedHTML = enrichedHTML.replace(
        /(<a\b[^>]*>)|(<\/a>)|(<[^>]*>)|([^<]+)/gi,
        (match: string, openA: string | undefined, closeA: string | undefined, otherTag: string | undefined, textNode: string | undefined) => {
          if (openA) { insideAnchor++; return match; }
          if (closeA) { insideAnchor = Math.max(0, insideAnchor - 1); return match; }
          if (otherTag) { return match; }
          
          // This is a text node -- only replace if not inside <a> and not yet replaced
          if (textNode && insideAnchor === 0 && !replaced) {
            const textRegex = new RegExp(`\\b(${escapedAnchor})\\b`, 'i');
            if (textRegex.test(textNode)) {
              replaced = true;
              return textNode.replace(
                textRegex,
                `<a href="${url}" class="nn-links">$1 ${LINK_ICON}</a>`
              );
            }
          }
          return match;
        }
      );
      
      if (replaced) {
        linksApplied++;
        console.log(`[apply-links] Inserted link: "${anchor}" -> ${url}`);
      } else {
        console.log(`[apply-links] Could not find anchor text "${anchor}" in HTML`);
      }
    }

    // Update database if articleId provided
    let dbSaved = true;
    if (articleId && linksApplied > 0) {
      try {
        const sql = getSQL();
        await sql`
          UPDATE articles
          SET html_content = ${enrichedHTML},
              has_internal_links = true,
              link_count = ${linksApplied},
              updated_at = NOW()
          WHERE id = ${articleId}
        `;
      } catch (dbError) {
        console.error("Failed to update article in DB:", dbError);
        dbSaved = false;
      }
    }

    return NextResponse.json({
      htmlContent: enrichedHTML,
      linkCount: linksApplied,
      totalRequested: approvedLinks.length,
      success: true,
      ...(dbSaved === false && { warning: "Links were applied to the HTML but the database update failed. Your changes may not persist after refresh." }),
    });
  } catch (error) {
    console.error("[apply-links] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to apply links";
    return NextResponse.json(
      { error: message, detail: "Could not inject approved links into the article HTML. Try re-scanning for link opportunities." },
      { status: 500 }
    );
  }
}
