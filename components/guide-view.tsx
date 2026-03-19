'use client'

import {
  RefreshCw,
  FilePlus,
  Layers,
  Zap,
  Wrench,
  Package,
  Database,
  Upload,
  Link2,
  ImageIcon,
  BarChart3,
  Send,
  Lightbulb,
  ArrowRight,
  BookOpen,
} from 'lucide-react'
import type { ViewId } from '@/components/app-sidebar'

interface GuideViewProps {
  onNavigate: (view: ViewId) => void
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[10px] font-mono font-semibold tracking-[1.8px] uppercase mt-10 mb-4 pb-2"
      style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
    >
      {children}
    </h2>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 mb-3">
      <div
        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-mono font-semibold mt-[1px]"
        style={{
          border: '1.5px solid var(--nn-accent)',
          color: 'var(--nn-accent)',
          background: 'var(--nn-accent-light)',
        }}
      >
        {n}
      </div>
      <p className="text-[13.5px] leading-[1.65]" style={{ color: 'var(--text2)' }}>
        {children}
      </p>
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-2.5 rounded-md px-3.5 py-2.5 my-4 text-[12.5px] leading-[1.6]"
      style={{ background: 'var(--nn-accent-light)', color: 'var(--nn-accent)' }}
    >
      <Lightbulb className="h-4 w-4 shrink-0 mt-[2px]" />
      <span>{children}</span>
    </div>
  )
}

function NavLink({ view, label, onNavigate }: { view: ViewId; label: string; onNavigate: (v: ViewId) => void }) {
  return (
    <button
      onClick={() => onNavigate(view)}
      className="inline-flex items-center gap-1 text-[12.5px] font-medium hover:underline"
      style={{ color: 'var(--nn-accent)' }}
    >
      {label}
      <ArrowRight className="h-3 w-3" />
    </button>
  )
}

function RefCard({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-warm)' }}>
      <div className="flex items-center gap-2 mb-2.5">
        <span style={{ color: 'var(--nn-accent)' }}>{icon}</span>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text1)' }}>{title}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span
            key={item}
            className="rounded-md px-2 py-0.5 text-[11px] font-mono"
            style={{ background: 'var(--surface)', color: 'var(--text3)' }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export function GuideView({ onNavigate }: GuideViewProps) {
  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[680px] px-6 py-10">

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-6 w-6" style={{ color: 'var(--nn-accent)' }} />
          <h1 className="text-[22px] font-semibold" style={{ color: 'var(--text1)', fontFamily: 'Oswald, sans-serif' }}>
            How to Use Content Studio
          </h1>
        </div>
        <p className="text-[14px] leading-[1.7] mb-2" style={{ color: 'var(--text3)' }}>
          Content Studio automates the entire lifecycle of supplement content for Naked Nutrition —
          from generating SEO-optimized articles to enriching them with internal links and images,
          then publishing directly to Shopify. This guide walks through every workflow.
        </p>

        {/* ─── GETTING STARTED ─── */}
        <SectionHeader>Getting Started</SectionHeader>
        <p className="text-[13.5px] leading-[1.7] mb-3" style={{ color: 'var(--text2)' }}>
          The sidebar on the left organizes everything into four areas: <strong>Revamp</strong> (rewrite existing content),
          <strong> Create New</strong> (generate from scratch), <strong>Current Article</strong> (edit and enrich what
          you&apos;re working on), and <strong>Library</strong> (manage all your content, products, and resources).
        </p>
        <p className="text-[13.5px] leading-[1.7] mb-3" style={{ color: 'var(--text2)' }}>
          The typical flow is: create or revamp content, then enrich it with internal links and images
          using the sidebar tabs, review the SEO score, and publish to Shopify when it&apos;s ready.
        </p>

        {/* ─── REVAMP ─── */}
        <SectionHeader>Revamp an Article</SectionHeader>
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="h-4 w-4" style={{ color: 'var(--text3)' }} />
          <NavLink view="revamp-input" label="Go to Revamp" onNavigate={onNavigate} />
        </div>
        <p className="text-[13.5px] leading-[1.7] mb-4" style={{ color: 'var(--text2)' }}>
          Revamp takes an existing published article and generates an improved version. It&apos;s best for
          posts that are underperforming in search or have outdated structure, thin content, or missing product integration.
        </p>
        <Step n={1}>
          Navigate to <strong>Revamp Article</strong> in the sidebar. Paste a Shopify blog URL, or paste raw HTML directly.
          You can also search your existing blog posts if they&apos;ve been synced.
        </Step>
        <Step n={2}>
          Click <strong>Analyze</strong>. The AI will evaluate the content and return a breakdown: word count,
          heading structure, claims that need citations, internal link gaps, and a suggested improved outline.
        </Step>
        <Step n={3}>
          Review the analysis on the <strong>Analysis Review</strong> page. Adjust the suggested outline,
          set your target word count and tone, then click <strong>Generate</strong>.
        </Step>
        <Step n={4}>
          The revamped article appears in the content editor. From here, you can add links, images,
          and publish — just like a new article.
        </Step>
        <Tip>
          Revamp works best on articles over 500 words. For very short pages (product descriptions, landing copy),
          use New Article instead and write from scratch.
        </Tip>

        {/* ─── NEW ARTICLE ─── */}
        <SectionHeader>Create a New Article</SectionHeader>
        <div className="flex items-center gap-2 mb-4">
          <FilePlus className="h-4 w-4" style={{ color: 'var(--text3)' }} />
          <NavLink view="new-article" label="Go to New Article" onNavigate={onNavigate} />
        </div>
        <p className="text-[13.5px] leading-[1.7] mb-4" style={{ color: 'var(--text2)' }}>
          The full article creation wizard. Six steps from idea to published Shopify post.
        </p>
        <Step n={1}>
          <strong>Configure.</strong> Enter a title, target keyword, and select a category. Choose tone (educational,
          conversational, authoritative, or scientific), target word count, and optional features like product cards
          or comparison tables.
        </Step>
        <Step n={2}>
          <strong>Outline Review.</strong> The AI generates a structured outline with H2/H3 sections, estimated word counts,
          and a suggested FAQ. Review and rearrange sections before generation begins.
        </Step>
        <Step n={3}>
          <strong>Content Generation.</strong> Claude writes the full HTML article with NN brand styling, product cards,
          FAQ schema markup, and meta description. This typically takes 30–60 seconds.
        </Step>
        <Step n={4}>
          <strong>Internal Links.</strong> The AI scans your article for natural anchor text opportunities and suggests
          internal links from your topical authority database. Review each suggestion, edit anchor text if needed,
          and approve the ones you want.
        </Step>
        <Step n={5}>
          <strong>Images.</strong> Image prompts are drafted automatically based on the article content. Edit prompts,
          then generate images with Gemini. A featured image and 2–3 inline images are placed at relevant sections.
        </Step>
        <Step n={6}>
          <strong>Publish.</strong> Review the final article, confirm metadata, and publish directly to your
          Shopify blog. The system sets metafields, uploads the featured image, and pings search engines automatically.
        </Step>
        <Tip>
          The sidebar badges (Content, Links, Images, SEO) update as you work through each step so you can
          always see what&apos;s done and what&apos;s left.
        </Tip>

        {/* ─── BULK UPLOAD ─── */}
        <SectionHeader>Bulk Upload</SectionHeader>
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-4 w-4" style={{ color: 'var(--text3)' }} />
          <NavLink view="bulk-queue" label="Go to Bulk Upload" onNavigate={onNavigate} />
        </div>
        <p className="text-[13.5px] leading-[1.7] mb-4" style={{ color: 'var(--text2)' }}>
          Generate multiple articles at once from a CSV spreadsheet.
        </p>
        <Step n={1}>
          Prepare a CSV with columns: <span className="font-mono text-[12px]" style={{ color: 'var(--text3)' }}>title, keyword, category, tone, wordCount</span>.
          Optional columns include <span className="font-mono text-[12px]" style={{ color: 'var(--text3)' }}>articleType, audience, shopifySlug, titleTag, metaDescription, specialInstructions</span>.
        </Step>
        <Step n={2}>
          Upload the CSV in the Bulk Upload view. Each row is parsed and shown as a queue item.
          Review and remove any rows you don&apos;t want before starting.
        </Step>
        <Step n={3}>
          Click <strong>Generate All</strong>. Each article processes sequentially — outline, products, content
          generation, and automatic link insertion. Progress is shown per-item.
        </Step>
        <Tip>
          For large batches (10+ articles), consider running them overnight. Each article takes 1–2 minutes
          to generate, enrich with links, and save.
        </Tip>

        {/* ─── AUTO-RUN ─── */}
        <SectionHeader>Auto-Run</SectionHeader>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4" style={{ color: 'var(--text3)' }} />
          <NavLink view="auto-run" label="Go to Auto-Run" onNavigate={onNavigate} />
        </div>
        <p className="text-[13.5px] leading-[1.7] mb-3" style={{ color: 'var(--text2)' }}>
          A streamlined version of New Article with minimal configuration. Enter a title, keyword, and category,
          and Auto-Run handles everything else automatically — outline, content, links, and saving to the
          database — without stopping for review at each step.
        </p>
        <Tip>
          Use Auto-Run when you trust the defaults and want speed. Use New Article when you need to
          fine-tune the outline, tone, or product selection.
        </Tip>

        {/* ─── WORKSHOP ─── */}
        <SectionHeader>Article Workshop</SectionHeader>
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="h-4 w-4" style={{ color: 'var(--text3)' }} />
          <NavLink view="workshop" label="Go to Workshop" onNavigate={onNavigate} />
        </div>
        <p className="text-[13.5px] leading-[1.7] mb-4" style={{ color: 'var(--text2)' }}>
          The Workshop is for auditing and improving your existing Shopify blog content.
        </p>
        <Step n={1}>
          Click <strong>Fetch Articles</strong> to pull all blog posts from your Shopify store.
          They&apos;ll appear in a reviewable queue.
        </Step>
        <Step n={2}>
          Open an article to review it. You can read through the content, check word count
          and tag coverage, and add notes.
        </Step>
        <Step n={3}>
          Mark each article as <strong>Approved</strong> or <strong>Needs Work</strong>.
          For articles that need improvement, you can regenerate individual sections
          directly from the workshop without starting a full revamp.
        </Step>

        {/* ─── PRODUCTS & RESOURCES ─── */}
        <SectionHeader>Products & Resources</SectionHeader>
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center gap-1.5">
            <Package className="h-4 w-4" style={{ color: 'var(--text3)' }} />
            <NavLink view="products" label="Products" onNavigate={onNavigate} />
          </span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span className="flex items-center gap-1.5">
            <Database className="h-4 w-4" style={{ color: 'var(--text3)' }} />
            <NavLink view="resources" label="Resources" onNavigate={onNavigate} />
          </span>
        </div>
        <p className="text-[13.5px] leading-[1.7] mb-3" style={{ color: 'var(--text2)' }}>
          <strong>Products</strong> manages your Naked Nutrition product catalog. Products are fetched from Shopify
          and cached in the database. When an article is generated, the system automatically selects
          relevant products based on the article&apos;s category and keyword, then inserts styled product cards.
        </p>
        <p className="text-[13.5px] leading-[1.7] mb-3" style={{ color: 'var(--text2)' }}>
          <strong>Resources</strong> stores your topical authority data — a database of related articles, pillar pages,
          and cluster content with URLs. This powers the internal linking system: when you add links to an article,
          the AI draws from this database to find relevant pages to link to.
        </p>
        <Tip>
          Keep your product catalog and topical authority data up to date. The quality of product recommendations
          and internal link suggestions depends directly on this data being current.
        </Tip>

        {/* ─── PUBLISHING ─── */}
        <SectionHeader>Publishing to Shopify</SectionHeader>
        <div className="flex items-center gap-2 mb-4">
          <Send className="h-4 w-4" style={{ color: 'var(--text3)' }} />
          <span className="text-[12.5px]" style={{ color: 'var(--text3)' }}>Available from the article content view</span>
        </div>
        <p className="text-[13.5px] leading-[1.7] mb-4" style={{ color: 'var(--text2)' }}>
          When your article is ready, the publish flow handles everything:
        </p>
        <Step n={1}>
          Any temporary images (data URIs or generated URLs) are uploaded to Shopify Files
          and replaced with permanent CDN URLs.
        </Step>
        <Step n={2}>
          The article is published to the Shopify blog with the correct handle, tags, author,
          featured image, and metafields (title tag and meta description).
        </Step>
        <Step n={3}>
          After publishing, the system automatically pings Google, Bing, and IndexNow to
          request re-crawling of your sitemap.
        </Step>
        <Tip>
          Always preview your article and check the SEO tab before publishing. Once published,
          the article is live on your store immediately.
        </Tip>

        {/* ─── QUICK REFERENCE ─── */}
        <SectionHeader>Quick Reference</SectionHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RefCard
            icon={<BarChart3 className="h-4 w-4" />}
            title="Tones"
            items={['Educational', 'Conversational', 'Authoritative', 'Scientific']}
          />
          <RefCard
            icon={<Upload className="h-4 w-4" />}
            title="Article Types"
            items={['Standard', 'Buyer\'s Guide', 'Comparison', 'How-To', 'Listicle', 'Ultimate Guide']}
          />
          <RefCard
            icon={<Package className="h-4 w-4" />}
            title="Categories (19)"
            items={[
              'Creatine', 'Whey Protein', 'Casein Protein', 'Pea Protein', 'Rice Protein',
              'Mass Gainer', 'Pre-Workout', 'Post-Workout', 'BCAAs', 'Collagen',
              'Greens', 'Fiber', 'Vitamins', 'Probiotics', 'Energy',
              'Weight Mgmt', 'Keto', 'Vegan', 'General Nutrition',
            ]}
          />
          <RefCard
            icon={<ImageIcon className="h-4 w-4" />}
            title="Image Types"
            items={['Featured (cinematic)', 'Technical diagram', 'Inline content', 'Product showcase']}
          />
          <RefCard
            icon={<Link2 className="h-4 w-4" />}
            title="Link Enrichment"
            items={['6–10 links per article', 'AI anchor text', 'Manual approval', 'Topical authority DB']}
          />
          <RefCard
            icon={<BarChart3 className="h-4 w-4" />}
            title="SEO Checks"
            items={['Word count', 'Keyword density', 'Meta description', 'Heading structure', 'Image alt text', 'Internal links']}
          />
        </div>

        {/* Spacer */}
        <div className="h-16" />
      </div>
    </div>
  )
}
