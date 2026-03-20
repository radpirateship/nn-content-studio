'use client'

import {
  Server,
  Database,
  Key,
  Globe,
  Cpu,
  ImageIcon,
  ShoppingBag,
  GitBranch,
  Layers,
  ArrowRight,
  AlertTriangle,
  Terminal,
  FileCode,
  HardDrive,
  Lightbulb,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Shared micro-components (match guide-view.tsx style)               */
/* ------------------------------------------------------------------ */

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

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[14px] font-semibold mt-6 mb-2" style={{ color: 'var(--text1)' }}>
      {children}
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13.5px] leading-[1.65] mb-3" style={{ color: 'var(--text2)' }}>
      {children}
    </p>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="rounded px-1.5 py-0.5 text-[12px] font-mono"
      style={{ background: 'var(--surface2)', color: 'var(--text1)' }}
    >
      {children}
    </code>
  )
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="my-3 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {title && (
        <div
          className="px-3 py-1.5 text-[10px] font-mono font-medium tracking-wide uppercase border-b"
          style={{ background: 'var(--surface)', color: 'var(--text4)', borderColor: 'var(--border)' }}
        >
          {title}
        </div>
      )}
      <pre
        className="px-3 py-2.5 text-[12px] leading-[1.6] overflow-x-auto font-mono"
        style={{ background: 'var(--bg)', color: 'var(--text2)' }}
      >
        {children}
      </pre>
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

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-2.5 rounded-md px-3.5 py-2.5 my-4 text-[12.5px] leading-[1.6]"
      style={{ background: '#fef9ec', color: '#7a5c1e' }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 mt-[2px]" style={{ color: '#b8860b' }} />
      <span>{children}</span>
    </div>
  )
}

function TableRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="text-[12px] font-medium w-[200px] shrink-0" style={{ color: 'var(--text3)' }}>
        {label}
      </span>
      <span
        className={`text-[12.5px] ${mono ? 'font-mono' : ''}`}
        style={{ color: 'var(--text1)' }}
      >
        {value}
      </span>
    </div>
  )
}

function ApiRoute({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodColor =
    method === 'GET' ? '#0f6a88' :
    method === 'POST' ? '#2f6846' :
    method === 'PUT' ? '#8a6d1b' :
    method === 'DELETE' ? '#9b2c2c' : 'var(--text2)'
  const methodBg =
    method === 'GET' ? '#e8f4f8' :
    method === 'POST' ? '#e6f4ea' :
    method === 'PUT' ? '#fef9ec' :
    method === 'DELETE' ? '#fde8e8' : 'var(--surface2)'

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span
        className="shrink-0 rounded px-1.5 py-px text-[10px] font-mono font-bold uppercase mt-[2px]"
        style={{ background: methodBg, color: methodColor }}
      >
        {method}
      </span>
      <div className="min-w-0">
        <span className="text-[12px] font-mono block truncate" style={{ color: 'var(--text1)' }}>
          {path}
        </span>
        <span className="text-[11.5px]" style={{ color: 'var(--text3)' }}>
          {desc}
        </span>
      </div>
    </div>
  )
}

function DbTable({ name, desc, columns }: { name: string; desc: string; columns: string }) {
  return (
    <div className="rounded-lg border p-3 mb-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <div className="flex items-center gap-2 mb-1">
        <HardDrive className="h-3.5 w-3.5" style={{ color: 'var(--nn-accent)' }} />
        <span className="text-[13px] font-mono font-semibold" style={{ color: 'var(--text1)' }}>
          {name}
        </span>
      </div>
      <p className="text-[12px] mb-1.5" style={{ color: 'var(--text3)' }}>{desc}</p>
      <p className="text-[11px] font-mono leading-[1.6]" style={{ color: 'var(--text4)' }}>
        {columns}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function TechnicalGuideView() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[720px] px-8 py-10">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <FileCode className="h-5 w-5" style={{ color: 'var(--nn-accent)' }} />
            <h1 className="font-serif text-[26px] font-semibold" style={{ color: 'var(--text1)' }}>
              Technical Guide
            </h1>
          </div>
          <p className="text-[14px] leading-[1.6]" style={{ color: 'var(--text3)' }}>
            Architecture, APIs, database schema, and how all the services connect.
            This is the developer reference for understanding how NN Content Studio works under the hood.
          </p>
        </div>

        {/* ============================================================ */}
        {/*  1. ARCHITECTURE OVERVIEW                                     */}
        {/* ============================================================ */}
        <SectionHeader>Architecture Overview</SectionHeader>
        <P>
          NN Content Studio is a Next.js 16 single-page application using the App Router. The frontend
          is a ViewId-based SPA — all navigation happens through a single <Code>activeView</Code> state
          in <Code>app/page.tsx</Code>, and the sidebar drives which view component is mounted.
          There is no client-side router; views are conditionally rendered.
        </P>
        <P>
          The backend is a set of Next.js API routes under <Code>/app/api/</Code>. In production these
          run as <strong>Vercel Serverless Functions</strong> — each route is an isolated, stateless
          function with a cold start on first request. Locally they run as a Node.js dev server.
          The routes connect to four external services: Neon PostgreSQL for storage, Anthropic Claude
          for text generation, Google Gemini for image generation, and the Shopify Admin + Storefront
          APIs for product data and publishing.
        </P>

        <CodeBlock title="High-level data flow">{`Browser (React SPA — hosted on Vercel CDN)
  │
  ├─▸ /api/generate/*        → Vercel Fn → Claude API  → article content
  ├─▸ /api/revamp/*          → Vercel Fn → Claude API  → revamped content
  ├─▸ /api/articles/*        → Vercel Fn → Neon DB     → CRUD + enrichment
  ├─▸ /api/generate/image/*  → Vercel Fn → Gemini API  → generated images
  ├─▸ /api/shopify/*         → Vercel Fn → Shopify API → products + publishing
  └─▸ /api/resources/*       → Vercel Fn → Neon DB     → topical authority + collections`}</CodeBlock>

        {/* ============================================================ */}
        {/*  2. TECH STACK                                                */}
        {/* ============================================================ */}
        <SectionHeader>Tech Stack</SectionHeader>
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <TableRow label="Framework" value="Next.js 16.0.10 (App Router, Turbopack)" />
          <TableRow label="React" value="19.2.0" />
          <TableRow label="Language" value="TypeScript (strict mode, build errors enforced)" />
          <TableRow label="Hosting" value="Vercel (Serverless Functions + Edge CDN)" />
          <TableRow label="Styling" value="Tailwind CSS 4 + CSS custom properties (var(--nn-accent), etc.)" />
          <TableRow label="UI Library" value="Radix UI primitives via shadcn/ui" />
          <TableRow label="Database" value="Neon Serverless PostgreSQL (@neondatabase/serverless)" />
          <TableRow label="AI (text)" value="Anthropic Claude claude-sonnet-4-6 (direct HTTP fetch)" />
          <TableRow label="AI (images)" value="Google Gemini 3.1 Flash Image Preview" />
          <TableRow label="E-commerce" value="Shopify Admin API (REST) + Storefront API (GraphQL)" />
          <TableRow label="Image Processing" value="Sharp 0.34.5 (resizing, compression, text overlay)" />
          <TableRow label="Notifications" value="Sonner (toast)" />
          <TableRow label="Data Fetching" value="SWR + native fetch" />
        </div>

        <Warning>
          TypeScript build errors are enforced — the build will fail if type errors are introduced.
          Run <Code>npx tsc --noEmit</Code> locally before deploying to catch issues early.
        </Warning>

        {/* ============================================================ */}
        {/*  3. ENVIRONMENT VARIABLES                                     */}
        {/* ============================================================ */}
        <SectionHeader>Environment Variables</SectionHeader>
        <P>
          Secrets are stored in two places depending on environment. Locally they live in{' '}
          <Code>.env.local</Code> (never committed to git). In production they are set in the{' '}
          <strong>Vercel project dashboard</strong> under Settings → Environment Variables. Any change
          to production env vars requires a redeploy to take effect.
        </P>
        <P>
          The app&apos;s <Code>instrumentation.ts</Code> auto-creates an empty <Code>.env.local</Code> on
          first local startup if one doesn&apos;t exist, so you&apos;ll see the file appear but you still
          need to fill in the values.
        </P>
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <TableRow label="DATABASE_URL" value="Neon PostgreSQL connection string (required)" mono />
          <TableRow label="ANTHROPIC_API_KEY" value="sk-ant-* — Claude API key (required for generation)" mono />
          <TableRow label="GEMINI_API_KEY" value="Google AI API key (required for image generation)" mono />
          <TableRow label="SHOPIFY_ACCESS_TOKEN" value="shpat_* — Shopify Admin API permanent token" mono />
          <TableRow label="SHOPIFY_STOREFRONT_ACCESS_TOKEN" value="Shopify Storefront API token (products)" mono />
          <TableRow label="SHOPIFY_STORE_DOMAIN" value="nakednutrition.myshopify.com" mono />
          <TableRow label="SHOPIFY_API_KEY" value="Shopify app API key (OAuth flow only)" mono />
          <TableRow label="SHOPIFY_API_SECRET" value="Shopify app API secret (OAuth flow only)" mono />
          <TableRow label="VERCEL_OIDC_TOKEN" value="Auto-injected by Vercel — used for OIDC auth. Do not set manually." mono />
        </div>
        <Tip>
          If any required key is missing, the relevant API routes will return 500 errors. Locally,
          check your terminal output. In production, check the Vercel Function logs in the Vercel
          dashboard under the Deployments tab → click any deployment → Functions.
        </Tip>
        <Warning>
          Vercel and Neon have a native integration — if you connected them through the Vercel
          Marketplace, Neon may have auto-populated <Code>DATABASE_URL</Code> and related variables.
          Check your Vercel env vars to see if this is the case before adding them manually.
        </Warning>

        {/* ============================================================ */}
        {/*  4. VERCEL DEPLOYMENT                                         */}
        {/* ============================================================ */}
        <SectionHeader>Vercel Deployment</SectionHeader>
        <P>
          Production is hosted on Vercel. When you push to the connected Git branch, Vercel automatically
          builds and deploys the app. The React frontend is served from Vercel&apos;s global CDN. The
          Next.js API routes become individual Serverless Functions — each one runs in its own isolated
          Node.js runtime and is invoked on demand.
        </P>

        <SubHeader>What &ldquo;Serverless&rdquo; means in practice</SubHeader>
        <P>
          Unlike a traditional server that&apos;s always running, each API route function spins up fresh
          for every request (a <em>cold start</em>) and shuts down when it&apos;s done. This has a few
          practical consequences:
        </P>
        <div className="ml-4 space-y-2 mb-4">
          <div className="text-[13px] leading-[1.65]" style={{ color: 'var(--text2)' }}>
            <strong style={{ color: 'var(--text1)' }}>No persistent in-memory state.</strong>{' '}
            The <Code>store.ts</Code> and <Code>product-store.ts</Code> singletons are only
            valid within a single request. On Vercel each request may hit a different function
            instance — don&apos;t rely on them for cross-request caching.
          </div>
          <div className="text-[13px] leading-[1.65]" style={{ color: 'var(--text2)' }}>
            <strong style={{ color: 'var(--text1)' }}>Function timeout limits.</strong>{' '}
            Vercel Serverless Functions default to a 10-second timeout on the free/hobby plan, and up
            to 60 seconds on Pro. Long-running AI generation calls (especially full article generation
            or revamp finalization) can hit this limit. If you see 504 errors in production but not
            locally, a function timeout is the likely cause.
          </div>
          <div className="text-[13px] leading-[1.65]" style={{ color: 'var(--text2)' }}>
            <strong style={{ color: 'var(--text1)' }}>Cold starts.</strong>{' '}
            The first request to an API route after a period of inactivity may be slower (100–500ms
            extra) while the function container initializes.
          </div>
        </div>

        <SubHeader>Deployments &amp; Logs</SubHeader>
        <P>
          The Vercel dashboard at <Code>vercel.com/dashboard</Code> shows all deployments. Under a
          deployment you can view real-time Function logs, which is the production equivalent of your
          local terminal output. This is where you&apos;ll find API errors, console.warn messages, and
          the context tags like <Code>[revamp-analysis]</Code> that are scattered through the codebase.
        </P>

        <SubHeader>Running Migrations on Production</SubHeader>
        <P>
          Database migrations need to be run against the production Neon database the same way as
          locally — by visiting <Code>/api/migrate</Code> on your production URL. Because the production
          database is separate from your local one, you need to run migrations on both independently
          whenever a new table or column is added.
        </P>
        <Warning>
          If you&apos;ve just deployed a code change that expects a new database column or table and
          haven&apos;t run <Code>/api/migrate</Code> on the production URL yet, you&apos;ll get database
          errors in production. Always run migrations after deploying schema changes.
        </Warning>

        <SubHeader>Neon + Vercel Integration</SubHeader>
        <P>
          Neon has a first-party Vercel integration available in the Vercel Marketplace. If it was set
          up, it automatically injects <Code>DATABASE_URL</Code>, <Code>DATABASE_POSTGRES_URL</Code>,
          and <Code>DATABASE_POSTGRES_PRISMA_URL</Code> as Vercel environment variables and keeps them
          in sync if the Neon credentials rotate. Check your Vercel project&apos;s Settings →
          Integrations tab to see if this is active.
        </P>
        <P>
          The <Code>@neondatabase/serverless</Code> package is specifically designed for serverless
          environments — it connects over HTTP rather than a persistent TCP socket, which means each
          function invocation opens and closes a connection cleanly without needing a connection pool.
          This is why Neon works well on Vercel while traditional PostgreSQL clients (like <Code>pg</Code>)
          can exhaust connection limits.
        </P>

        {/* ============================================================ */}
        {/*  5. DATABASE SCHEMA                                           */}
        {/* ============================================================ */}
        <SectionHeader>Database Schema (Neon PostgreSQL)</SectionHeader>
        <P>
          The database connection is managed in <Code>lib/db.ts</Code> via a single <Code>getSQL()</Code>
          function that returns a Neon query executor. There is no ORM — all queries use Neon&apos;s
          tagged template literal syntax: <Code>{`sql\`SELECT * FROM articles\``}</Code>.
        </P>
        <P>
          Database migrations live in <Code>/api/migrate</Code> (GET). Hit <Code>/api/migrate</Code> in
          your browser (or at your production URL) to run all migrations. They&apos;re idempotent —
          safe to run repeatedly. The local and production databases are separate and both need
          migrations run independently.
        </P>

        <SubHeader>Core Tables</SubHeader>
        <DbTable
          name="articles"
          desc="All generated and revamped articles. Primary content store."
          columns="id, title, slug (unique), keyword, category, tone, word_count, html_content, meta_description, featured_image_url, schema_markup (JSONB), products (JSONB), internal_links (JSONB), status, has_internal_links, has_images, link_count, image_count, article_type, created_at, updated_at"
        />
        <DbTable
          name="products"
          desc="Shopify product catalog synced locally for fast querying."
          columns="id, handle (unique), title, description, price, compare_at_price, sku, vendor, product_type, tags, category, image_url, url, status, inventory_qty, collection_slug, created_at"
        />
        <DbTable
          name="topical_authority"
          desc="SEO content map — pillar/cluster/supporting article relationships per collection."
          columns="id, type, title, primary_keyword, intent, format, word_count, priority, action, existing_url, optimize, notes, search_volume, title_tag, meta_description, collection_slug"
        />
        <DbTable
          name="collections"
          desc="Shopify collection metadata with SEO optimization data."
          columns="id, url, category, primary_keyword, search_volume, keyword_difficulty, secondary_keywords, optimized_title_tag, optimized_meta_description, current_position, priority, collection_slug"
        />
        <DbTable
          name="collections_registry"
          desc="Master list of all content collections (built-in + custom)."
          columns="slug (PK), label, is_builtin, url, created_at"
        />

        <SubHeader>Supporting Tables</SubHeader>
        <DbTable
          name="ultimate_guides"
          desc="Long-form pillar pages. Multi-section assembly with per-section generation."
          columns="id (UUID), title, slug, topic_short/full, collection_slug, hero_image_url, html_content, meta_description, key_takeaways (JSONB), faq_pairs (JSONB), selected_products (JSONB), status, shopify_page_id"
        />
        <DbTable
          name="revamp_sources"
          desc="Tracks the original Shopify article that was revamped and links it to the new article."
          columns="id, original_shopify_id, original_title/slug/url, new_article_id (FK → articles), category, keyword, revamp_reason, content_improvement_score, status"
        />
        <DbTable
          name="blog_posts"
          desc="GSC performance data — imported clicks, impressions, CTR, and position per URL."
          columns="id, url, section, slug, category, clicks, impressions, ctr, position"
        />
        <DbTable
          name="resources"
          desc="Image and media asset registry (generated + uploaded)."
          columns="id, resource_type, title, url, alt_text, width/height, file_size, category, article_id, placement, generated, ai_model, generation_prompt, status"
        />
        <DbTable
          name="guide_templates"
          desc="Reusable templates for ultimate guide configuration."
          columns="id (UUID), name, description, collection_slug, topic_short/full, product_roles (JSONB), read_time_mins"
        />
        <DbTable
          name="workshop_reviews"
          desc="Editorial review status for existing Shopify articles."
          columns="id, shopify_article_id (unique), handle, title, status (not_reviewed|approved|needs_work), notes"
        />

        {/* ============================================================ */}
        {/*  5. API ROUTES                                                */}
        {/* ============================================================ */}
        <SectionHeader>API Routes Reference</SectionHeader>
        <P>
          All routes live under <Code>/app/api/</Code>. There are roughly 40 route files grouped
          by domain. Here are the main groups:
        </P>

        <SubHeader>Article CRUD &amp; Enrichment</SubHeader>
        <div className="space-y-0.5 mb-4">
          <ApiRoute method="GET" path="/api/articles" desc="List all articles, or fetch one by ?id={dbId}" />
          <ApiRoute method="POST" path="/api/articles" desc="Create a new article (saves to DB)" />
          <ApiRoute method="PUT" path="/api/articles" desc="Update article content, meta, or status" />
          <ApiRoute method="DELETE" path="/api/articles?id={id}" desc="Delete an article" />
          <ApiRoute method="POST" path="/api/articles/scan-links" desc="AI scan for internal link opportunities (Claude)" />
          <ApiRoute method="POST" path="/api/articles/add-links" desc="AI-powered link injection into HTML (Claude)" />
          <ApiRoute method="POST" path="/api/articles/apply-links" desc="Apply pre-approved link placements to HTML" />
          <ApiRoute method="POST" path="/api/articles/draft-image-prompts" desc="Generate image prompts for an article (Claude)" />
          <ApiRoute method="POST" path="/api/articles/generate-image" desc="Generate a single image (Gemini + Sharp)" />
          <ApiRoute method="POST" path="/api/articles/add-images" desc="Generate and upload multiple images (Gemini → Shopify)" />
          <ApiRoute method="POST" path="/api/articles/insert-images" desc="Insert generated images into article HTML" />
          <ApiRoute method="POST" path="/api/articles/upload-to-shopify" desc="Upload a single image to Shopify CDN" />
          <ApiRoute method="POST" path="/api/articles/edit-section" desc="AI section editor — revise a paragraph with instructions (Claude)" />
        </div>

        <SubHeader>Content Generation (New Articles)</SubHeader>
        <div className="space-y-0.5 mb-4">
          <ApiRoute method="POST" path="/api/generate/outline" desc="Generate SEO article outline (Claude)" />
          <ApiRoute method="POST" path="/api/generate" desc="Full article generation from outline (Claude)" />
          <ApiRoute method="POST" path="/api/generate/image" desc="Featured image with title text overlay (Gemini + Sharp)" />
        </div>

        <SubHeader>Revamp Workflow (Rewrite Existing Articles)</SubHeader>
        <div className="space-y-0.5 mb-4">
          <ApiRoute method="POST" path="/api/revamp/analyze" desc="Analyze existing article (word count, headings, gaps, claims)" />
          <ApiRoute method="POST" path="/api/revamp/generate/content" desc="Generate revamped body content from approved outline" />
          <ApiRoute method="POST" path="/api/revamp/generate/faq" desc="Generate FAQ section (8 Q&A pairs)" />
          <ApiRoute method="POST" path="/api/revamp/generate/images" desc="Generate contextual images for revamped article" />
          <ApiRoute method="POST" path="/api/revamp/generate/finalize" desc="Assemble final article, generate title/subtitle, save to DB" />
          <ApiRoute method="POST" path="/api/revamp/generate" desc="Full revamp orchestration (all steps in one call)" />
        </div>

        <SubHeader>Shopify Integration</SubHeader>
        <div className="space-y-0.5 mb-4">
          <ApiRoute method="GET" path="/api/shopify/products" desc="Fetch products from Shopify Storefront API" />
          <ApiRoute method="GET" path="/api/shopify/blog/publish" desc="List available Shopify blogs" />
          <ApiRoute method="POST" path="/api/shopify/blog/publish" desc="Publish article to Shopify blog" />
          <ApiRoute method="GET" path="/api/shopify/blog/fetch" desc="Fetch article by handle or ID" />
          <ApiRoute method="GET" path="/api/shopify/blog/search" desc="Search blog articles by title or tag" />
          <ApiRoute method="PUT" path="/api/shopify/blog/update" desc="Update existing Shopify article in place" />
          <ApiRoute method="POST" path="/api/shopify/pages/publish" desc="Publish ultimate guide as a Shopify Page" />
          <ApiRoute method="GET" path="/api/shopify/auth/callback" desc="OAuth callback — exchanges auth code for access token" />
        </div>

        <SubHeader>Resources &amp; Collections</SubHeader>
        <div className="space-y-0.5 mb-4">
          <ApiRoute method="GET" path="/api/resources?type=topical-authority" desc="Fetch topical authority items (optionally scoped by collection)" />
          <ApiRoute method="GET" path="/api/resources?type=collections" desc="Fetch collection SEO data" />
          <ApiRoute method="GET" path="/api/resources?type=summary" desc="Summary counts for dashboard" />
          <ApiRoute method="GET" path="/api/products" desc="Fetch products from local DB (with category/search filtering)" />
          <ApiRoute method="GET" path="/api/collections/registry" desc="List all registered collections" />
          <ApiRoute method="POST" path="/api/collections/registry" desc="Add or update a collection" />
          <ApiRoute method="GET" path="/api/migrate" desc="Run database migrations (idempotent)" />
        </div>

        <SubHeader>Workshop &amp; Utilities</SubHeader>
        <div className="space-y-0.5 mb-4">
          <ApiRoute method="POST" path="/api/workshop/regenerate" desc="Regenerate individual article sections (FAQ, meta, links, etc.)" />
          <ApiRoute method="GET" path="/api/workshop/reviews" desc="Fetch review statuses for Shopify articles" />
          <ApiRoute method="POST" path="/api/workshop/reviews" desc="Save review status for an article" />
          <ApiRoute method="GET" path="/api/template/csv" desc="Download CSV template for bulk upload" />
          <ApiRoute method="GET" path="/api/blog-posts" desc="Fetch blog post GSC analytics data" />
        </div>

        {/* ============================================================ */}
        {/*  6. EXTERNAL SERVICE INTEGRATIONS                             */}
        {/* ============================================================ */}
        <SectionHeader>External Service Integrations</SectionHeader>

        <SubHeader>Anthropic Claude (Text Generation)</SubHeader>
        <P>
          Configured in <Code>lib/ai.ts</Code>. Uses direct HTTP <Code>fetch</Code> to the Anthropic
          Messages API (not the SDK). The model is <Code>claude-sonnet-4-6</Code> with a default max of 4096
          tokens.
        </P>
        <CodeBlock title="lib/ai.ts — callAI()">{`POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: {ANTHROPIC_API_KEY}
  anthropic-version: 2023-06-01
  Content-Type: application/json

Body: { model, max_tokens, system, messages: [{role: "user", content}] }
Returns: response.content[0].text`}</CodeBlock>
        <P>
          Claude is used for: article generation, outline creation, revamp analysis, link scanning,
          link injection, image prompt drafting, section editing, FAQ generation, product selection,
          and workshop regeneration. Every AI-powered feature goes through this single function.
        </P>

        <SubHeader>Google Gemini (Image Generation)</SubHeader>
        <P>
          Configured in <Code>lib/imageGeneration.ts</Code>. Calls the Gemini <Code>generateContent</Code>
          endpoint with <Code>responseModalities: [&apos;TEXT&apos;, &apos;IMAGE&apos;]</Code> to receive
          base64-encoded image data.
        </P>
        <CodeBlock title="lib/imageGeneration.ts">{`POST https://generativelanguage.googleapis.com/v1beta/
     models/gemini-3.1-flash-image-preview:generateContent

Response → candidates[0].content.parts
  → find part with inlineData.mimeType starting with "image/"
  → base64 decode → data URI or buffer`}</CodeBlock>
        <P>
          Images are optionally processed with <Code>Sharp</Code> for compression, resizing, and
          title text overlay (featured images). They can be uploaded to Shopify&apos;s CDN via the
          Shopify Files API for permanent hosting.
        </P>

        <SubHeader>Shopify (Two APIs)</SubHeader>
        <P>
          The app uses both Shopify APIs for different purposes:
        </P>
        <div className="ml-4 space-y-2 mb-3">
          <div className="flex gap-2 text-[13px]" style={{ color: 'var(--text2)' }}>
            <span className="font-semibold shrink-0" style={{ color: 'var(--text1)' }}>Storefront API</span>
            <span>— GraphQL, read-only. Used to fetch products by collection for article generation.
            Configured in <Code>lib/shopify/index.ts</Code> with the Storefront token.</span>
          </div>
          <div className="flex gap-2 text-[13px]" style={{ color: 'var(--text2)' }}>
            <span className="font-semibold shrink-0" style={{ color: 'var(--text1)' }}>Admin API</span>
            <span>— REST, read-write. Used for publishing blog articles, uploading images to
            Shopify CDN, fetching/updating existing content, and managing pages. Configured in
            <Code>lib/shopifyAuth.ts</Code> with the Admin access token (<Code>shpat_*</Code>).</span>
          </div>
        </div>
        <P>
          The Shopify OAuth flow (<Code>/api/shopify/auth/callback</Code>) is used to obtain the
          Admin access token. Once you have a permanent token in <Code>.env.local</Code>, you don&apos;t
          need to re-authenticate unless it&apos;s revoked.
        </P>

        <SubHeader>Neon PostgreSQL</SubHeader>
        <P>
          Configured in <Code>lib/db.ts</Code>. Uses the <Code>@neondatabase/serverless</Code> package
          which works over HTTP (not a persistent TCP connection). Queries use tagged template literals:
        </P>
        <CodeBlock title="Example query">{`import { getSQL } from '@/lib/db'

const sql = getSQL()
const articles = await sql\`
  SELECT id, title, slug
  FROM articles
  WHERE category = \${category}
  ORDER BY created_at DESC
\``}</CodeBlock>
        <Warning>
          Neon free-tier computes suspend after 5 minutes of inactivity. If the app starts throwing
          ETIMEDOUT errors, check the Neon dashboard at console.neon.tech to wake the compute.
        </Warning>

        {/* ============================================================ */}
        {/*  7. KEY DATA FLOWS                                            */}
        {/* ============================================================ */}
        <SectionHeader>Key Data Flows</SectionHeader>

        <SubHeader>New Article Generation</SubHeader>
        <CodeBlock>{`1. User fills form (title, keyword, category, tone, word count)
2. POST /api/generate/outline     → Claude creates SEO outline
3. GET  /api/products?category=X  → fetch relevant products
4. GET  /api/resources?type=topical-authority → fetch internal link targets
5. POST /api/generate             → Claude writes full article HTML
6. POST /api/articles             → save to Neon DB (status: draft)
7. → User lands on article-content view`}</CodeBlock>

        <SubHeader>Revamp Workflow</SubHeader>
        <CodeBlock>{`1. User pastes existing HTML + provides category/keyword/citations
2. POST /api/revamp/analyze       → Claude analyzes content (returns suggestedOutline, claims, etc.)
3. User reviews/edits the outline on the analysis page
4. POST /api/revamp/generate/content → Claude writes new body from outline
5. POST /api/revamp/generate/faq     → Claude generates FAQ section (parallel)
6. POST /api/revamp/generate/images  → Gemini generates images (parallel)
7. POST /api/revamp/generate/finalize → assemble + polish + save to DB
8. → User lands on article-content view`}</CodeBlock>

        <SubHeader>Article Enrichment (Links → Images → Publish)</SubHeader>
        <CodeBlock>{`1. POST /api/articles/scan-links   → Claude finds 6-10 link opportunities
2. User approves/rejects suggestions
3. POST /api/articles/apply-links  → inject approved links into HTML
4. POST /api/articles/draft-image-prompts → Claude writes image prompts
5. POST /api/articles/generate-image     → Gemini creates each image
6. POST /api/articles/insert-images      → place images in HTML
7. POST /api/shopify/blog/publish        → publish to Shopify blog
8. PUT  /api/articles {status: published} → update DB status`}</CodeBlock>

        <SubHeader>Publishing to Shopify</SubHeader>
        <CodeBlock>{`1. POST /api/shopify/blog/publish
   Body: { title, bodyHtml, tags, handle, featuredImageUrl, metafields }

2. If featuredImageUrl is provided:
   a. Upload image to Shopify Files (staged upload)
   b. Get CDN URL back
   c. Attach to article

3. POST to Shopify Admin API:
   /admin/api/2024-10/articles.json

4. Return Shopify article URL + update local DB status`}</CodeBlock>

        {/* ============================================================ */}
        {/*  8. PROJECT STRUCTURE                                         */}
        {/* ============================================================ */}
        <SectionHeader>Project Structure</SectionHeader>
        <CodeBlock>{`nn-content-studio/
├── app/
│   ├── page.tsx              ← Main SPA hub (all state + view routing)
│   ├── layout.tsx            ← Root layout + Sonner Toaster
│   ├── globals.css           ← CSS custom properties + Tailwind
│   └── api/                  ← ~40 API route files
│       ├── articles/         ← Article CRUD + enrichment
│       ├── generate/         ← New article generation (outline, content, image)
│       ├── revamp/           ← Revamp pipeline (analyze, generate/*)
│       ├── shopify/          ← Shopify integration (blog, products, auth)
│       ├── ultimate-guides/  ← Long-form guide CRUD + generation
│       ├── collections/      ← Collection registry
│       ├── workshop/         ← Editorial review tools
│       ├── products/         ← Product catalog
│       ├── resources/        ← Topical authority + collections data
│       ├── blog-posts/       ← GSC analytics data
│       ├── migrate/          ← Database migrations
│       └── template/         ← CSV template download
├── components/               ← ~35 React view components
│   ├── app-sidebar.tsx       ← Sidebar navigation (ViewId type)
│   ├── app-topbar.tsx        ← Top header bar
│   ├── article-context-bar.tsx ← Persistent article info + pipeline steps
│   ├── revamp-article-view.tsx ← Revamp input page
│   ├── revamp-analysis-view.tsx ← Revamp analysis/outline editor
│   ├── article-preview.tsx   ← Article content preview
│   ├── link-reviewer.tsx     ← Internal link approval UI
│   ├── image-storyboard.tsx  ← Image generation UI
│   ├── guide-view.tsx        ← User guide page
│   ├── technical-guide-view.tsx ← This page
│   └── ui/                   ← shadcn/ui primitives
├── lib/
│   ├── db.ts                 ← Neon database connection
│   ├── ai.ts                 ← Anthropic Claude API wrapper
│   ├── imageGeneration.ts    ← Gemini image generation wrapper
│   ├── shopify/index.ts      ← Shopify Storefront API client
│   ├── shopifyAuth.ts        ← Shopify Admin API auth
│   ├── types.ts              ← Core TypeScript interfaces
│   ├── nn-categories.ts      ← Article category definitions
│   ├── store.ts              ← In-memory app state store
│   ├── product-store.ts      ← In-memory product catalog
│   └── utils.ts              ← Utility helpers (cn)
├── .env.local                ← Secrets (not committed)
├── next.config.mjs           ← Next.js config
├── instrumentation.ts        ← Startup env monitoring
└── package.json`}</CodeBlock>

        {/* ============================================================ */}
        {/*  9. SPA NAVIGATION                                            */}
        {/* ============================================================ */}
        <SectionHeader>SPA Navigation Model</SectionHeader>
        <P>
          The entire app runs through a single <Code>activeView: ViewId</Code> state in <Code>page.tsx</Code>.
          The sidebar calls <Code>handleNavigate(view)</Code> which sets this state. Each view component
          is conditionally rendered based on the current ViewId.
        </P>
        <CodeBlock title="ViewId union type">{`type ViewId =
  | 'revamp-input' | 'revamp-analysis'     // Revamp workflow
  | 'new-article' | 'outline-review'       // New article creation
  | 'article-content' | 'article-links'    // Article editing pipeline
  | 'article-images' | 'article-seo'       // (continued)
  | 'library' | 'queue'                    // Content management
  | 'bulk-queue' | 'auto-run'              // Batch operations
  | 'products' | 'resources'               // Data management
  | 'publish-confirm'                      // Publishing
  | 'workshop' | 'guide' | 'tech-guide'    // Tools & docs
  | 'error'`}</CodeBlock>
        <P>
          Key state in <Code>page.tsx</Code>: <Code>currentArticle</Code> (the article being edited),{' '}
          <Code>articles[]</Code> (all loaded articles), <Code>revampAnalysis</Code> / <Code>revampSettings</Code> /
          <Code>revampCitations</Code> (revamp workflow state), and <Code>availableInternalLinks</Code> (loaded
          per-article for the link enrichment step).
        </P>
        <P>
          Navigation guards: clicking an article-* sidebar item without a loaded article redirects to library
          with a toast message. The revamp workflow state clears when navigating to revamp-input.
        </P>

        {/* ============================================================ */}
        {/*  10. COMMON OPERATIONS                                        */}
        {/* ============================================================ */}
        <SectionHeader>Common Operations</SectionHeader>

        <SubHeader>Run Database Migrations</SubHeader>
        <P>
          Visit <Code>http://localhost:3000/api/migrate</Code> in your browser. This creates any missing
          tables, adds columns, seeds the collections registry, and is safe to run multiple times.
        </P>

        <SubHeader>Add a New Collection</SubHeader>
        <P>
          POST to <Code>/api/collections/registry</Code> with <Code>{`{ slug, label }`}</Code>.
          Or add it to the <Code>CANONICAL_COLLECTIONS</Code> array in <Code>api/migrate/route.ts</Code>
          and re-run the migration.
        </P>

        <SubHeader>Add a New API Route</SubHeader>
        <P>
          Create a new file at <Code>app/api/your-feature/route.ts</Code> and export the HTTP method
          handlers (<Code>GET</Code>, <Code>POST</Code>, etc.). Use <Code>getSQL()</Code> from <Code>lib/db.ts</Code>
          for database access and <Code>callAI()</Code> from <Code>lib/ai.ts</Code> for Claude.
        </P>

        <SubHeader>Add a New View</SubHeader>
        <P>
          1. Create a component in <Code>components/your-view.tsx</Code>.
          2. Add the ViewId to the union type in <Code>components/app-sidebar.tsx</Code>.
          3. Add the sidebar nav item to the appropriate section in the sidebar.
          4. Add the conditional render in <Code>app/page.tsx</Code>.
        </P>

        <SubHeader>Debugging Tips</SubHeader>
        <P>
          Console warnings are tagged with context labels like <Code>[revamp-analysis]</Code>,{' '}
          <Code>[loadArticles]</Code>, <Code>[saveArticleToDb]</Code> etc. Search the terminal for these
          tags to trace issues. API errors include context in their log output (article ID, category,
          link count, etc.).
        </P>

        <Tip>
          The bulk upload view is always mounted (hidden with CSS) so background generation continues
          even when you navigate away. If bulk generation seems stuck, check the browser console —
          the component is still running in the background.
        </Tip>

        {/* Spacer */}
        <div className="h-16" />
      </div>
    </div>
  )
}
