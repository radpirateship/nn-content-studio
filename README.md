# NN Content Studio

AI-powered content automation platform for [Naked Nutrition](https://nakednutrition.com). Generates, enriches, and publishes supplement articles and ultimate guides directly to Shopify — with internal linking, image generation, product integration, and SEO optimization built in.

Built with Next.js 16, React 19, Claude (Anthropic), Gemini (Google), and Neon PostgreSQL.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Project Structure](#project-structure)
- [Core Workflows](#core-workflows)
- [API Reference](#api-reference)
- [Content Configuration](#content-configuration)
- [Deployment](#deployment)

---

## Features

**Content Generation** — Full article creation pipeline powered by Claude. Generates outlines, long-form HTML content, FAQ sections, meta descriptions, and JSON-LD schema markup, all styled to the Naked Nutrition brand guide with custom CSS classes, Oswald/Open Sans typography, and responsive layouts.

**Internal Linking** — AI-powered link scanning and injection. Analyzes article content, identifies natural anchor text opportunities from a topical authority database, and inserts links with relevance scoring and manual approval before application.

**Image Generation** — Creates featured images and inline content illustrations using Google Gemini. Includes prompt drafting, editing, batch generation, and automatic upload to Shopify Files CDN for permanent hosting.

**Shopify Integration** — Full read/write integration with Shopify's Admin and Storefront APIs. Fetches products and collections, publishes articles to blogs and pages, manages metafields, and pings search engines on publish.

**Article Workshop** — Queue-based batch review system. Fetches existing Shopify blog posts, lets you review and approve/flag articles, regenerate sections, and track review status.

**Revamp Workflow** — Takes existing published content, analyzes structure/gaps/SEO issues, and generates an improved version while preserving what works.

**Bulk Upload** — CSV-driven batch article creation. Upload a spreadsheet of titles, keywords, and categories, then generate all articles in sequence with automatic link and image enrichment.

**Product Catalog** — Manages the Naked Nutrition product database with collection mapping, pricing, and automatic product card insertion into articles.

**SEO Analysis** — Real-time content scoring for keyword density, word count, heading structure, meta descriptions, internal link coverage, and image optimization.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.0.10 |
| UI | React 19.2, Tailwind CSS 4, Radix UI (shadcn/ui) |
| Language | TypeScript 5 |
| AI (Content) | Anthropic Claude (claude-sonnet-4-6) |
| AI (Images) | Google Gemini 3.1 Flash |
| Database | Neon (serverless PostgreSQL) |
| Forms | react-hook-form + Zod |
| Data Fetching | SWR |
| Notifications | Sonner |
| Analytics | Vercel Analytics |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A [Neon](https://neon.tech) PostgreSQL database
- API keys for [Anthropic](https://console.anthropic.com) and [Google AI Studio](https://aistudio.google.com)
- A Shopify store with Admin API access

### Installation

```bash
git clone <repo-url>
cd nn-content-studio
npm install
```

### Configure Environment

Copy the example below into `.env.local` and fill in your values (see [Environment Variables](#environment-variables) for details):

```bash
cp .env.example .env.local
```

### Run Database Migrations

Execute the SQL scripts in your Neon console (or via the `/api/migrate` endpoint after starting the app):

```
scripts/create-articles-table.sql
scripts/create-products-table.sql
scripts/create-resources-table.sql
scripts/create-collections-registry.sql
migrations/workshop_reviews.sql
```

### Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key for content generation |
| `GEMINI_API_KEY` | Google Gemini API key for image generation |
| `DATABASE_URL` | Neon PostgreSQL connection string (pooled) |
| `SHOPIFY_STORE_DOMAIN` | Your store domain (e.g. `nakednutrition.myshopify.com`) |
| `SHOPIFY_ACCESS_TOKEN` | Shopify Admin API access token |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Shopify Storefront API token |

### Optional

| Variable | Description |
|---|---|
| `SHOPIFY_API_KEY` | Shopify app API key (for OAuth flow) |
| `SHOPIFY_API_SECRET` | Shopify app API secret (for OAuth flow) |
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | Public-facing store domain |
| `NEXT_PUBLIC_BASE_URL` | Base URL for OAuth callbacks |
| `DATABASE_URL_UNPOOLED` | Unpooled Neon connection (for migrations) |

---

## Database Setup

The app uses Neon serverless PostgreSQL. Core tables:

**articles** — Generated articles with HTML content, metadata, products, internal links, schema markup, and Shopify publishing status. Indexed on status, category, and created_at.

**workshop_reviews** — Tracks review status (not_reviewed / approved / needs_work) for Shopify blog posts in the workshop queue.

**products** — Cached product catalog from Shopify with pricing, images, handles, and collection mappings.

**resources** — Internal link resources and topical authority data used for link enrichment.

**collections_registry** — Maps Shopify collection slugs to content categories.

Run the migration scripts in `/scripts/` and `/migrations/` against your Neon database to create all tables.

---

## Project Structure

```
nn-content-studio/
├── app/
│   ├── api/
│   │   ├── articles/             # Article CRUD, links, images, publishing
│   │   ├── generate/             # Outline, content, and image generation
│   │   ├── revamp/               # Content revamp/rewrite pipeline
│   │   ├── ultimate-guides/      # Multi-section guide generation
│   │   ├── shopify/              # Shopify blog, products, pages, auth
│   │   ├── workshop/             # Article review queue
│   │   ├── products/             # Product catalog
│   │   ├── resources/            # Content resources & topical authority
│   │   ├── blog-posts/           # Blog post management
│   │   ├── collections/          # Collection registry
│   │   ├── template/             # CSV template export
│   │   └── migrate/              # Database migrations
│   ├── page.tsx                  # Main SPA — all views and state
│   ├── layout.tsx                # Root layout, fonts, analytics
│   └── error.tsx                 # Error boundary
│
├── components/                   # 34 React components
│   ├── new-article-view.tsx      # Article creation wizard
│   ├── article-workshop-view.tsx # Batch review queue
│   ├── revamp-article-view.tsx   # Content revamp workflow
│   ├── article-preview.tsx       # Live article preview
│   ├── article-editor.tsx        # Rich content editor
│   ├── link-reviewer.tsx         # Internal link approval
│   ├── image-storyboard.tsx      # Image generation & placement
│   ├── seo-analysis-view.tsx     # SEO scoring dashboard
│   ├── bulk-upload-view.tsx      # CSV batch import
│   ├── auto-run-view.tsx         # Automated generation
│   ├── publish-confirm-view.tsx  # Pre-publish checklist
│   └── ui/                       # Radix/shadcn primitives
│
├── lib/
│   ├── ai.ts                     # Anthropic API wrapper
│   ├── db.ts                     # Neon database connection
│   ├── types.ts                  # TypeScript interfaces
│   ├── imageGeneration.ts        # Gemini image generation
│   ├── nn-template.ts            # NN brand CSS (4500+ lines)
│   ├── nn-categories.ts          # 19 supplement categories
│   ├── shopify/                  # Shopify API client
│   ├── shopifyAuth.ts            # Auth token management
│   ├── shopifyImageUpload.ts     # CDN image upload
│   └── guide-assembler.ts        # Ultimate guide builder
│
├── scripts/                      # 27 setup, migration, and test scripts
├── migrations/                   # SQL migration files
└── public/                       # Static assets
```

---

## Core Workflows

### 1. New Article Creation

A multi-step wizard that produces a fully styled, SEO-optimized article:

1. **Configure** — Enter title, keyword, category, tone, word count, and options (products, comparison tables, etc.)
2. **Outline Review** — AI generates an article outline; review and edit sections before generation
3. **Content Generation** — Claude writes the full HTML article with NN brand styling, product cards, FAQ section, and schema markup
4. **Link Enrichment** — AI scans the content for internal linking opportunities; review and approve before insertion
5. **Image Generation** — Gemini creates a featured image and inline illustrations; prompts are editable before generation
6. **Publish** — One-click publish to Shopify blog with metafields, featured image, and automatic sitemap pings

### 2. Article Workshop

Fetch all blog posts from Shopify, then review them in a queue interface. Mark articles as approved or needs-work, add notes, regenerate individual sections, and track review progress across the entire blog.

### 3. Revamp Workflow

Paste or fetch existing content, and the AI analyzes it for structure, word count, heading hierarchy, link gaps, and claims that need citations. Then generates an improved version that preserves what works while fixing issues.

### 4. Bulk Upload

Upload a CSV with columns for title, keyword, category, tone, word count, and other options. The system processes each row sequentially — generating outlines, fetching products, writing content, applying links, and saving to the database.

---

## API Reference

### Article Generation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/generate/outline` | Generate article outline from title/keyword/category |
| `POST` | `/api/generate` | Generate full article HTML content |
| `POST` | `/api/generate/image` | Generate a featured image |

### Article Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/articles` | List all articles (or fetch by `?id=`) |
| `POST` | `/api/articles` | Create new article |
| `PUT` | `/api/articles` | Update existing article |
| `DELETE` | `/api/articles` | Delete article by ID |
| `POST` | `/api/articles/edit-section` | Edit a single section of an article |

### Link Enrichment

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/articles/add-links` | AI-powered link suggestion and injection |
| `POST` | `/api/articles/scan-links` | Scan content for link opportunities |
| `POST` | `/api/articles/apply-links` | Apply approved links to HTML |

### Image Pipeline

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/articles/draft-image-prompts` | Draft image generation prompts from content |
| `POST` | `/api/articles/generate-image` | Generate a single image from prompt |
| `POST` | `/api/articles/insert-images` | Insert generated images into article HTML |
| `POST` | `/api/articles/add-images` | Full image pipeline (draft + generate + insert) |
| `POST` | `/api/articles/upload-to-shopify` | Upload image to Shopify Files CDN |

### Revamp

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/revamp/analyze` | Analyze existing content for improvement |
| `POST` | `/api/revamp/generate` | Generate revamped article |
| `POST` | `/api/revamp/generate/content` | Generate revamped content section |
| `POST` | `/api/revamp/generate/faq` | Generate FAQ for revamped article |
| `POST` | `/api/revamp/generate/finalize` | Finalize revamp with products and styling |

### Ultimate Guides

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ultimate-guides/generate-section` | Generate a guide section |
| `POST` | `/api/ultimate-guides/select-products` | Select products for guide |
| `POST` | `/api/ultimate-guides/draft-image-prompts` | Draft image prompts for guide |
| `POST` | `/api/ultimate-guides/validate-schema` | Validate guide structure |
| `GET` | `/api/ultimate-guides/templates` | List guide templates |

### Shopify

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/shopify/products` | Fetch products from Shopify |
| `POST` | `/api/shopify/blog/publish` | Publish article to Shopify blog |
| `POST` | `/api/shopify/blog/update` | Update existing blog post |
| `GET` | `/api/shopify/blog/fetch` | Fetch blog posts |
| `GET` | `/api/shopify/blog/search` | Search blog posts |
| `POST` | `/api/shopify/pages/publish` | Publish to Shopify pages |

### Workshop

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/workshop/reviews` | Get/update article review status |
| `POST` | `/api/workshop/regenerate` | Regenerate article section in workshop |

### Other

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST/DELETE` | `/api/products` | Product catalog management |
| `GET/POST` | `/api/resources` | Content resources and topical authority |
| `GET` | `/api/blog-posts` | Blog post data |
| `GET` | `/api/collections/registry` | Collection slug registry |
| `POST` | `/api/template/csv` | Export CSV template |
| `GET` | `/api/migrate` | Run database migrations |

---

## Content Configuration

### Supplement Categories (19)

Creatine, Whey Protein, Casein Protein, Pea Protein, Rice Protein, Mass Gainer, Pre-Workout, Post-Workout Recovery, BCAAs & Amino Acids, Collagen, Greens & Superfoods, Fiber & Digestive Health, Vitamins & Minerals, Probiotics, Energy & Focus, Weight Management, Keto & Low-Carb, Vegan Nutrition, General Nutrition.

### Tone Options

| Tone | Description |
|---|---|
| `educational` | Clear explanations aimed at beginners |
| `conversational` | Friendly, approachable voice |
| `authoritative` | Expert industry perspective |
| `scientific` | Research-backed, technical depth |

### Article Structure

Every generated article follows the NN template structure:

1. **Header** — Navigation pills, kicker, title, subtitle, author/date/reading time
2. **Key Takeaways** — Highlighted summary box
3. **Body Sections** — H2/H3 hierarchy with prose content
4. **Product Grid** — 2×2 cards with badges (Best Value, Editor's Pick, Premium, Pro-Level)
5. **Comparison Table** — Optional side-by-side product comparison
6. **FAQ Section** — 8 expandable questions with JSON-LD FAQ schema
7. **Related Articles** — 3-column grid of internal links
8. **Collection CTA** — Category page link button

---

## Deployment

The app is deployed on **Vercel** with the following configuration:

```javascript
// next.config.mjs
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  serverExternalPackages: ['sharp'],
}
```

### Deploy to Vercel

1. Push to your Git repository
2. Connect the repo in the [Vercel dashboard](https://vercel.com)
3. Add all environment variables in **Settings → Environment Variables**
4. Deploy — Vercel handles build and hosting automatically

### Function Timeouts

Some API routes use extended timeouts for long-running operations:

- Image generation + Shopify upload: `maxDuration = 120s`
- Full image pipeline (add-images): `maxDuration = 180s`

Ensure your Vercel plan supports the required function duration limits.

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `node scripts/check-env.js` | Validate environment variables |
| `node scripts/check-shopify-vars.js` | Validate Shopify configuration |

Database migration scripts are in `/scripts/` (SQL files to run against Neon).

---

## License

Private — internal use only.
