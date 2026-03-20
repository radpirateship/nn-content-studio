import { type NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { callAI } from "@/lib/ai";

// Link icon SVG - same as used in the generate route
const LINK_ICON = `<svg stroke-linejoin="round" stroke-linecap="round" stroke-width="2" stroke="currentColor" fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>`;

/**
 * POST /api/articles/add-links
 * 
 * Takes a finished article's HTML and a list of internal link URLs,
 * uses Claude to intelligently inject links into existing paragraphs.
 * 
 * This is a much simpler task for the AI than generating content + links together:
 * "Here is text. Here are URLs. Add links to natural anchor text."
 */
export async function POST(request: NextRequest) {
  try {
    const { articleId, htmlContent, internalLinks } = await request.json();

    if (!htmlContent) {
      return NextResponse.json({ error: "htmlContent is required" }, { status: 400 });
    }

    if (!internalLinks || internalLinks.length === 0) {
      return NextResponse.json({ error: "internalLinks array is required" }, { status: 400 });
    }

    // Extract only the body content sections (between Key Takeaways and FAQ/footer)
    // We don't want Claude touching the NN shell, nav, product grid, or footer
    const bodyStartMarker = '<section class="nn-section nn-muted">';
    const faqMarker = '<section id="faq"';
    const footerMarker = '<section class="nn-section nn-center">';
    const relatedMarker = 'Continue Your Nutrition Journey';

    const bodyStart = htmlContent.indexOf(bodyStartMarker);
    const faqStart = htmlContent.indexOf(faqMarker);
    const footerStart = htmlContent.indexOf(footerMarker);
    const relatedStart = htmlContent.indexOf(relatedMarker);

    if (bodyStart === -1) {
      return NextResponse.json({
        error: "Could not find body content start in HTML"
      }, { status: 400 });
    }

    // Use FAQ as the end boundary if present; otherwise fall back to
    // related articles section, then footer CTA, then end of content.
    // This ensures links can still be injected even if FAQ is missing.
    let bodyEndPos = faqStart;
    if (bodyEndPos === -1 && relatedStart !== -1) {
      // Find the <section> tag that contains the related articles marker
      bodyEndPos = htmlContent.lastIndexOf('<section', relatedStart);
    }
    if (bodyEndPos === -1 && footerStart !== -1) {
      bodyEndPos = footerStart;
    }
    if (bodyEndPos === -1) {
      // Last resort: use the closing </article> tag
      bodyEndPos = htmlContent.indexOf('</article>');
    }
    if (bodyEndPos === -1) {
      return NextResponse.json({
        error: "Could not find body content end boundary in HTML"
      }, { status: 400 });
    }

    // Extract: everything from Key Takeaways through end of main content
    const bodyContent = htmlContent.substring(bodyStart, bodyEndPos).trim();
    const beforeBody = htmlContent.substring(0, bodyStart);
    const afterBody = htmlContent.substring(bodyEndPos);

    // Format the links for the AI prompt
    const linksForAI = internalLinks.slice(0, 12).map(
      (l: { title: string; url: string }, i: number) => `${i + 1}. "${l.title}" → ${l.url}`
    ).join('\n');

    // Call Claude to inject links into existing paragraphs
    const systemPrompt = `You are an internal linking specialist for Naked Nutrition. Your ONLY job is to add internal links to existing HTML content. You must NOT change the content, structure, headings, or meaning of any text.

RULES:
1. Find natural anchor text in existing sentences and wrap them in: <a href="URL" class="nn-links">anchor text ${LINK_ICON}</a>
2. Use 2-4 word anchor text that naturally fits the sentence. NEVER use "click here" or "read more".
3. Add 6-10 links total, spread across different sections. Not all in one paragraph.
4. NEVER add links inside headings (h2, h3), list items that are key takeaways, or image alt text.
5. NEVER change the wording of any sentence. Only wrap existing words in <a> tags.
6. NEVER add new sentences, paragraphs, or content. Your output must contain the exact same text.
7. NEVER remove or modify existing HTML structure, classes, or attributes.
8. Use the EXACT URLs provided - do not modify or make up URLs.
9. Prefer linking in <p> tags within content sections, not in the Key Takeaways box.
10. Space links out - avoid putting 2 links in the same sentence.

OUTPUT: Return the modified HTML with links injected. Nothing else - no explanations, no markdown code fences, no markdown syntax (**, __, etc.) - HTML tags only.`;

    const userPrompt = `Here is the article body HTML. Add internal links using the URLs below.

URLS TO ADD:
${linksForAI}

HTML CONTENT TO MODIFY:
${bodyContent}`;

    let linkedBody = await callAI(systemPrompt, userPrompt, { maxTokens: 8000 });

    // Clean up any markdown code fences Claude might have added
    linkedBody = linkedBody.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    // Clean up any stray markdown syntax
    linkedBody = linkedBody
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<em>$1</em>');

    // Count how many links were actually added
    const linkMatches = linkedBody.match(/<a\s+href="[^"]*"\s+class="nn-links"/g);
    const linkCount = linkMatches ? linkMatches.length : 0;

    // Reassemble the full article
    const enrichedHTML = beforeBody + linkedBody + '\n' + afterBody;

    // Update database if articleId provided
    let dbSaved = true;
    if (articleId) {
      try {
        const sql = getSQL();
        await sql`
          UPDATE articles
          SET html_content = ${enrichedHTML},
              has_internal_links = true,
              link_count = ${linkCount},
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
      linkCount,
      success: true,
      ...(dbSaved === false && { warning: "Links were added to the HTML but the database update failed. Your changes may not persist after refresh." }),
    });
  } catch (error) {
    console.error("[add-links] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to add links";
    return NextResponse.json(
      { error: message, detail: "The AI link injection step failed. Check that your article HTML is valid and try again." },
      { status: 500 }
    );
  }
}
