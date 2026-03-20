import { type NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'

export const maxDuration = 120

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Section definitions ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
// Each section has an id, the HTML id used in the template, and a generator.

export type SectionId =
  | 'key-takeaways'
  | 'what-is'
  | 'how-it-works'
  | 'types'
  | 'health-benefits'
  | 'how-to-use'
  | 'safety'
  | 'featured-products'
  | 'faq'
  | 'meta'

// Shared context passed to every section generator
interface SectionContext {
  guideTitle: string
  topicShort: string       // e.g. "Whey Protein"
  topicShortPlural: string // e.g. "Whey Proteins"
  topicFull: string        // e.g. "Whey Protein Powder"
  year: number
  products: Array<{
    title: string
    vendor: string
    price: string
    subcategory: string
    role: 'best-value' | 'best-upgrade'
    desc: string
    specs: string[]
  }>
  clusterLinks: Array<{ title: string; slug: string }>
  previousSections: Record<string, string> // sectionId ÃÂ¢ÃÂÃÂ plain text summary
}

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Shared system prompt ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

const SYSTEM_BASE = `You are an expert nutrition content writer for Naked Nutrition (nakednutrition.com),
a premium supplement brand selling protein powder, collagen peptides, creatine, pre-workout, BCAAs, greens, and sports nutrition products.

Your writing style:
- Evidence-based but accessible — cite mechanisms and research without being academic
- Direct and confident — no hedging, no filler phrases like "it's worth noting" or "in today's world"
- Written for health-conscious adults who care about performance, recovery, and nutrition
- Never sycophantic, never preachy
- Target total guide length: 6,000–8,000 words across all sections
- Each section should be thorough and substantive (600–1,000 words), not just a few sentences
- Write in flowing paragraphs with depth — explain mechanisms, cite research context, give practical details

Content rules:
- NEVER use rem CSS units — always use em
- NEVER generate <style> or <script> tags — CSS is already in the template
- Return ONLY the requested HTML fragment — no preamble, no markdown fences, no explanation
- Use the exact class names specified — do not invent new ones- Internal links use format: <a href="/blogs/wellness/SLUG">Anchor text</a>
- All headings inside sections are h3 or h4 ÃÂ¢ÃÂÃÂ NEVER h2 (h2 is the section header, hardcoded in template)
- FORMATTING RULE: You are strictly forbidden from using <strong> or <b> tags inside paragraph (<p>) text. Bolding is ONLY allowed at the very beginning of list items (<li>) to label the point. Do not bold statistics, phrases, or sentences in the body copy.
- CRITICAL: Keep paragraphs to 2-4 sentences MAX. Break up long blocks of text.
- CRITICAL: You are strictly forbidden from overusing em-dashes (—). Use standard punctuation (periods and commas) to create short, punchy, declarative sentences.`

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Section prompt builders ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

function buildKeyTakeawaysPrompt(ctx: SectionContext): string {
  return `Generate ONLY the 5 list items for the Key Takeaways section of the "${ctx.guideTitle}" guide.

Return EXACTLY 5 <li> elements and NOTHING else -- no <ul>, no <section>, no wrappers, no divs, no classes, no <div class="callout-info">.

Each <li> starts with a short bold label (2-4 words) followed by a colon, then 1-2 specific, actionable sentences:
<li><strong>{{2-4 word label}}:</strong> {{1-2 specific, actionable sentences with data or mechanisms}}</li>
<li><strong>{{2-4 word label}}:</strong> {{1-2 specific sentences}}</li>
<li><strong>{{2-4 word label}}:</strong> {{1-2 specific sentences}}</li>
<li><strong>{{2-4 word label}}:</strong> {{1-2 specific sentences}}</li>
<li><strong>{{2-4 word label}}:</strong> {{1-2 specific sentences}}</li>

Make each takeaway specific and data-driven. No generic filler.
Return ONLY the 5 <li> elements. The wrapper is hardcoded in our template.`
}
function buildWhatIsPrompt(ctx: SectionContext): string {
  return `Generate the "What Is ${ctx.topicFull}?" section body for the "${ctx.guideTitle}" guide.

Your output MUST begin with this EXACT stat box structure (filled in with a relevant key stat for ${ctx.topicShort}), followed by the paragraphs. Do NOT delete or skip the stat box:

<div class="ppw-stat-box" style="float: right; width: 280px; margin: 0 0 1.5em 2em;">
  <span class="ppw-stat-value">{{A key number/stat relevant to ${ctx.topicShort}}}</span>
  <span class="ppw-stat-label">{{Short description of the stat, 5-8 words}}</span>
</div>
<p>{{INTRO -- 3-4 sentences defining what ${ctx.topicShort} is, why it matters for recovery and wellness, and how it fits into a modern health-conscious lifestyle.}}</p>
<p>{{HISTORY -- 3-4 sentences on the history and cultural origins. Mention specific civilizations, time periods, or traditions.}}</p>
<p>{{SCIENCE -- 4-6 sentences on the core physiological mechanism. What happens in the body -- specific pathways, hormones, or responses. Reference research without being academic.}}</p>
<p>{{MODERN_ADOPTION -- 3-4 sentences on how athletes, biohackers, and wellness enthusiasts use ${ctx.topicShort} today.}}</p>
<p>{{CLOSING -- 2-3 sentences previewing types, benefits, protocols, and buying guidance.}}</p>

Aim for 600-800 words. Write with depth and authority.
Return only the HTML, no wrappers.`
}
function buildHowItWorksPrompt(ctx: SectionContext): string {
  return `Generate the "How ${ctx.topicShort} Works" section for the "${ctx.guideTitle}" guide.
Return this structure:
<p>{{INTRO Ã¢ÂÂ 2Ã¢ÂÂ3 sentences on why understanding the mechanism matters for getting results.}}</p>
<h3>The Core Mechanism</h3>
<p>{{MECHANISM Ã¢ÂÂ 5Ã¢ÂÂ7 sentences explaining the primary physiological mechanism. What happens step by step? Mention vasodilation/vasoconstriction, hormone cascades, nervous system shifts, cellular stress responses. Be specific with temperatures, timeframes, measurable changes.}}</p>
<h3>What Happens During a Session</h3>
<ol>
  <li><strong>{{PHASE_1}}</strong> Ã¢ÂÂ {{3Ã¢ÂÂ4 sentences on the first few minutes, specific sensations and physiological responses}}</li>
  <li><strong>{{PHASE_2}}</strong> Ã¢ÂÂ {{3Ã¢ÂÂ4 sentences on mid-session, when key adaptations kick in}}</li>
  <li><strong>{{PHASE_3}}</strong> Ã¢ÂÂ {{3Ã¢ÂÂ4 sentences on final phase and post-session window, when peak benefits occur}}</li>
</ol>
<h3>The Science of Adaptation</h3>
<p>{{ADAPTATION Ã¢ÂÂ 4Ã¢ÂÂ5 sentences on how regular use creates lasting changes Ã¢ÂÂ hormesis, mitochondrial biogenesis, stress resilience. Dose-response findings.}}</p>
Aim for 700Ã¢ÂÂ900 words. Be specific with numbers and biological mechanisms.
Return only the HTML, no wrappers.`
}

function buildTypesPrompt(ctx: SectionContext): string {
  const subcats = [...new Set(ctx.products.map(p => p.subcategory).filter(Boolean))]
  const subcatHint = subcats.length > 0
    ? `The guide features these product subcategories: ${subcats.join(', ')}. Make sure at least these type names appear in the table.`
    : ''
  return `Generate the "Types of ${ctx.topicFull}" section for the "${ctx.guideTitle}" guide.
${subcatHint}
Return this structure:
<p>{{INTRO Ã¢ÂÂ 3Ã¢ÂÂ4 sentences on how ${ctx.topicShortPlural} vary and why the type matters for goals, space, and budget.}}</p>
<div class="ppw-table-wrap">
  <table class="ppw-table">
    <thead><tr><th>Type</th><th>Best For</th><th>Key Spec</th><th>Price Range</th></tr></thead>
    <tbody>{{4Ã¢ÂÂ6 <tr> rows, one per type, with specific content in each <td>}}</tbody>
  </table>
</div>
<h3>Choosing the Right Type</h3>
<p>{{CHOOSING Ã¢ÂÂ 4Ã¢ÂÂ6 sentences on decision factors: space, budget, health goals, frequency, number of users. Be opinionated with direct recommendations.}}</p>
<p>{{CLOSING Ã¢ÂÂ 2Ã¢ÂÂ3 sentences on common mistakes when choosing and what to prioritize.}}</p>
Aim for 600Ã¢ÂÂ800 words. Be specific with specs, dimensions, and price ranges.
Return only the HTML, no wrappers.`
}

function buildHealthBenefitsPrompt(ctx: SectionContext, clusterLinks: Array<{title:string;slug:string}>): string {
  const benefitLinks = clusterLinks
    .filter(l => /benefit|health|recover|sleep|stress|immune|mental|weight|pain|inflam/i.test(l.title))
    .slice(0, 3)
  const linkHtml = benefitLinks.map(l =>
    `<a href="/blogs/wellness/${l.slug}">${l.title}</a>`
  ).join(', ')
  return `Generate the Health Benefits section for the "${ctx.guideTitle}" guide.
Return this structure with 6 benefit cards PLUS expanded research detail:
<p>{{INTRO Ã¢ÂÂ 3Ã¢ÂÂ4 sentences on the breadth of researched benefits. Reference growing peer-reviewed research.}}</p>
<div class="ppw-benefits-grid">
  {{6 benefit cards, each using this structure:}}
  <div class="ppw-benefit-card">
    <span class="ppw-benefit-icon">{{EMOJI}}</span>
    <h4>{{BENEFIT_TITLE Ã¢ÂÂ 2Ã¢ÂÂ4 words}}</h4>
    <p>{{BENEFIT_DESC Ã¢ÂÂ 2Ã¢ÂÂ3 sentences with specific mechanism, research context, and measurable outcome.}}</p>
  </div>
</div>
<h3>What the Research Shows</h3>
<p>{{RESEARCH Ã¢ÂÂ 4Ã¢ÂÂ6 sentences synthesizing compelling research. Mention specific study contexts. Cover dose-response where known.}}</p>
${benefitLinks.length > 0 ? `<p>For deeper dives into specific benefits, explore: ${linkHtml}.</p>` : '<p>{{CLOSING Ã¢ÂÂ 2Ã¢ÂÂ3 sentences connecting benefits to practical use and protocols covered next.}}</p>' }
Benefit areas (choose 6 most relevant for ${ctx.topicShort}): Recovery, Mental clarity/stress, Sleep, Immune function, Cardiovascular, Metabolism/weight, Pain/inflammation, Mood/dopamine, Skin, Longevity/hormesis.
Aim for 700Ã¢ÂÂ900 words. Be evidence-based and specific.
Return only the HTML, no wrappers.`
}

function buildHowToUsePrompt(ctx: SectionContext, clusterLinks: Array<{title:string;slug:string}>): string {
  const protocolLinks = clusterLinks
    .filter(l => /how|protocol|guide|beginner|start|routine|tips|schedule/i.test(l.title))
    .slice(0, 2)
  const linkPara = protocolLinks.length > 0
    ? `<p>For more detailed protocols, see: ${protocolLinks.map(l => `<a href="/blogs/wellness/${l.slug}">${l.title}</a>`).join(' and ')}.</p>`
    : ''
  return `Generate the "How to Use ${ctx.topicShort}" section for the "${ctx.guideTitle}" guide.
Return this structure:
<p>{{INTRO Ã¢ÂÂ 3Ã¢ÂÂ4 sentences on why protocol matters. Both under-use and over-use are common mistakes.}}</p>
<h3>Beginner Protocol (First 2 Weeks)</h3>
<p>{{BEGINNER_CONTEXT Ã¢ÂÂ 2Ã¢ÂÂ3 sentences on what to expect as a beginner.}}</p>
<ol>
  <li><strong>{{STEP_1}}</strong> Ã¢ÂÂ {{2Ã¢ÂÂ3 sentences with exact temperature/duration/setting}}</li>
  <li><strong>{{STEP_2}}</strong> Ã¢ÂÂ {{2Ã¢ÂÂ3 sentences}}</li>
  <li><strong>{{STEP_3}}</strong> Ã¢ÂÂ {{2Ã¢ÂÂ3 sentences}}</li>
  <li><strong>{{STEP_4}}</strong> Ã¢ÂÂ {{2Ã¢ÂÂ3 sentences}}</li>
  <li><strong>{{STEP_5}}</strong> Ã¢ÂÂ {{2Ã¢ÂÂ3 sentences}}</li>
</ol>
<h3>Intermediate Protocol (Weeks 3Ã¢ÂÂ8)</h3>
<p>{{INTERMEDIATE Ã¢ÂÂ 4Ã¢ÂÂ5 sentences on progression Ã¢ÂÂ specific increases in duration, temperature, frequency.}}</p>
<h3>Advanced Techniques</h3>
<p>{{ADVANCED Ã¢ÂÂ 4Ã¢ÂÂ5 sentences on stacking, contrast therapy, timing around workouts, frequency.}}</p>
<h3>Common Mistakes to Avoid</h3>
<ul>
  <li>{{MISTAKE_1 Ã¢ÂÂ specific mistake and why it hurts results, 1Ã¢ÂÂ2 sentences}}</li>
  <li>{{MISTAKE_2}}</li>
  <li>{{MISTAKE_3}}</li>
</ul>
${linkPara}
Aim for 800Ã¢ÂÂ1,000 words. Make every step specific.
Return only the HTML, no wrappers.`
}

function buildSafetyPrompt(ctx: SectionContext): string {
  return `Generate the Safety & Contraindications section for the "${ctx.guideTitle}" guide.
Return this structure:
<div class="ppw-callout-warn">
  <p><strong>Medical disclaimer:</strong> {{ONE sentence advising consultation with a doctor for pre-existing conditions, pregnancy, or cardiovascular medications.}}</p>
</div>
<p>{{INTRO Ã¢ÂÂ 3Ã¢ÂÂ4 sentences establishing that ${ctx.topicShort} is safe for most healthy adults when used correctly, but understanding contraindications is essential.}}</p>
<h3>Who Should Consult a Doctor First</h3>
<ul>
  <li><strong>{{CONDITION_1}}</strong> Ã¢ÂÂ {{1Ã¢ÂÂ2 sentences on why this condition interacts with ${ctx.topicShort} and the risk}}</li>
  <li><strong>{{CONDITION_2}}</strong> Ã¢ÂÂ {{1Ã¢ÂÂ2 sentences}}</li>
  <li><strong>{{CONDITION_3}}</strong> Ã¢ÂÂ {{1Ã¢ÂÂ2 sentences}}</li>
  <li><strong>{{CONDITION_4}}</strong> Ã¢ÂÂ {{1Ã¢ÂÂ2 sentences}}</li>
  <li><strong>{{CONDITION_5}}</strong> Ã¢ÂÂ {{1Ã¢ÂÂ2 sentences}}</li>
</ul>
<h3>Safety Best Practices</h3>
<ul>
  <li><strong>{{PRACTICE_1}}</strong> Ã¢ÂÂ {{2Ã¢ÂÂ3 sentences with specific actionable guidance}}</li>
  <li><strong>{{PRACTICE_2}}</strong> Ã¢ÂÂ {{2Ã¢ÂÂ3 sentences}}</li>
  <li><strong>{{PRACTICE_3}}</strong> Ã¢ÂÂ {{2Ã¢ÂÂ3 sentences}}</li>
  <li><strong>{{PRACTICE_4}}</strong> Ã¢ÂÂ {{2Ã¢ÂÂ3 sentences}}</li>
</ul>
<h3>Warning Signs to Stop Immediately</h3>
<p>{{WARNING_SIGNS Ã¢ÂÂ 3Ã¢ÂÂ4 sentences listing specific symptoms that mean end your session and what to do.}}</p>
Aim for 600Ã¢ÂÂ800 words. Name specific conditions, not vague categories.
Return only the HTML, no wrappers.`
}

function buildFeaturedProductsPrompt(ctx: SectionContext): string {
  const productList = ctx.products.map(p => 
    `- ${p.title} by ${p.vendor} ($${p.price}) [${p.role === 'best-value' ? 'Best Value' : 'Best Upgrade'}]: ${p.desc}`
  ).join('\n')

  return `Generate the Featured Products introduction for the "${ctx.guideTitle}" guide.

The guide covers ${ctx.topicFull}. The reader has just finished learning about safety considerations.

Here are the selected products:
${productList}

Return this structure:
<p>{{INTRO â 2â3 sentences bridging from the guide content to product recommendations. Reference what the reader learned about ${ctx.topicShort} (benefits, how to use, safety) and explain that you've selected these products based on quality, value, and the criteria discussed in the guide.}}</p>

<p>{{SELECTION CRITERIA â 2â3 sentences explaining what you looked for when choosing these ${ctx.topicShortPlural}: build quality, key specs that matter based on the how-it-works section, safety features from the safety section, and value for money. Be specific to ${ctx.topicShort}, not generic.}}</p>

Do NOT include product cards, prices, or individual product descriptions â those are inserted separately.
Do NOT add an <h2> heading â that is handled by the template.
Keep the tone helpful and authoritative. Write in second person ("you").`
}

function buildFaqPrompt(ctx: SectionContext): string {
  const priceRange = ctx.products.length > 0
    ? `\$${Math.min(...ctx.products.map(p => parseFloat(p.price) || 0)).toLocaleString()}Ã¢ÂÂ\$${Math.max(...ctx.products.map(p => parseFloat(p.price) || 0)).toLocaleString()}`
    : 'varies widely'
  return `Generate 8 FAQ items for the "${ctx.guideTitle}" guide.
Each FAQ must use this EXACT HTML structure:
<div class="ppw-faq-item">
  <button class="ppw-faq-q" aria-expanded="false">
    {{QUESTION}}
    <span class="ppw-faq-icon">+</span>
  </button>
  <div class="ppw-faq-a">
    <p>{{ANSWER Ã¢ÂÂ 3Ã¢ÂÂ5 sentences, thorough and specific. Include numbers, temperatures, durations, research-backed context.}}</p>
  </div>
</div>
Cover these question types:
1. What temperature / settings to use (specific numbers for beginners and advanced)
2. How long per session (specific duration ranges)
3. How often per week (with progression guidance)
4. Cost / price range (mention ${priceRange} and what affects price)
5. Most-searched health benefit question (thorough evidence-based answer)
6. Safety / who shouldn't use it (specific conditions)
7. Maintenance, installation, or setup question (practical details)
8. Comparison question (vs. another modality Ã¢ÂÂ balanced, specific)
Aim for 600Ã¢ÂÂ800 words across all 8 FAQs.
Return 8 ppw-faq-item blocks, nothing else.`
}

function buildMetaPrompt(ctx: SectionContext): string {
  return `Generate metadata for the "${ctx.guideTitle}" guide about ${ctx.topicFull}.
Return ONLY valid JSON (no fences, no explanation):
{
  "keyTakeawaysSchema": [
    "{{takeaway_1 as plain text for schema}}",
    "{{takeaway_2}}",
    "{{takeaway_3}}",
    "{{takeaway_4}}",
    "{{takeaway_5}}"
  ],
  "faqSchema": [
    {"q": "{{faq_question_1}}", "a": "{{faq_answer_1_concise}}"},
    {"q": "{{faq_question_2}}", "a": "{{faq_answer_2_concise}}"},
    {"q": "{{faq_question_3}}", "a": "{{faq_answer_3_concise}}"}
  ],
  "readTimeMins": {{estimated_read_time_as_integer}}
}`
}

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Route handler ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sectionId,
      guideTitle,
      topicShort,
      topicShortPlural,
      topicFull,
      products = [],
      clusterLinks = [],
      previousSections = {},
    } = body as { sectionId: SectionId } & SectionContext

    if (!sectionId || !guideTitle || !topicShort) {
      return NextResponse.json({ error: 'sectionId, guideTitle, and topicShort are required' }, { status: 400 })
    }

    const ctx: SectionContext = {
      guideTitle,
      topicShort,
      topicShortPlural: topicShortPlural || `${topicShort}s`,
      topicFull: topicFull || topicShort,
      year: new Date().getFullYear(),
      products,
      clusterLinks,
      previousSections,
    }

    // Build the user prompt for this specific section
    let userPrompt: string
    switch (sectionId) {
      case 'key-takeaways':  userPrompt = buildKeyTakeawaysPrompt(ctx); break
      case 'what-is':        userPrompt = buildWhatIsPrompt(ctx); break
      case 'how-it-works':   userPrompt = buildHowItWorksPrompt(ctx); break
      case 'types':          userPrompt = buildTypesPrompt(ctx); break
      case 'health-benefits': userPrompt = buildHealthBenefitsPrompt(ctx, clusterLinks); break
      case 'how-to-use':     userPrompt = buildHowToUsePrompt(ctx, clusterLinks); break
      case 'safety':         userPrompt = buildSafetyPrompt(ctx); break
      case 'featured-products': userPrompt = buildFeaturedProductsPrompt(ctx); break
      case 'faq':            userPrompt = buildFaqPrompt(ctx); break
      case 'meta':           userPrompt = buildMetaPrompt(ctx); break
      default:
        return NextResponse.json({ error: `Unknown sectionId: ${sectionId}` }, { status: 400 })
    }

    // Add context from previously generated sections so AI stays consistent
    const contextSummary = Object.entries(previousSections)
      .filter(([, v]) => v)
      .map(([k, v]) => `[${k}]: ${v.slice(0, 200)}`)
      .join('\n')

    const fullUserPrompt = contextSummary
      ? `GUIDE CONTEXT (previously generated ÃÂ¢ÃÂÃÂ stay consistent):\n${contextSummary}\n\n---\n\n${userPrompt}`
      : userPrompt

    const raw = await callAI(SYSTEM_BASE, fullUserPrompt, { maxTokens: 4096 })

    // Strip any accidental markdown fences
    const html = raw
      .replace(/^\`\`\`html?\n?/i, '')
      .replace(/^\`\`\`\n?/, '')
      .replace(/\n?\`\`\`$/g, '')
      .trim()

    // For meta section, try to parse JSON
    if (sectionId === 'meta') {
      try {
        const metaData = JSON.parse(html)
        return NextResponse.json({ sectionId, metaData, success: true })
      } catch {
        // Return raw if parse fails ÃÂ¢ÃÂÃÂ UI will handle gracefully
        return NextResponse.json({ sectionId, html, success: true })
      }
    }

    return NextResponse.json({ sectionId, html, success: true })
  } catch (error) {
    console.error('[generate-section]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
