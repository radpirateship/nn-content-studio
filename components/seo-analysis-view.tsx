'use client'

import { useMemo } from 'react'
import { BarChart3, Check, X, AlertTriangle, FileText, Link2, ImageIcon, Hash, Type, AlignLeft, Heading, Search } from 'lucide-react'
import type { GeneratedArticle } from '@/lib/types'

interface SeoAnalysisViewProps {
  article: GeneratedArticle
}

interface SeoCheck {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
  category: string
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function countOccurrences(text: string, keyword: string): number {
  if (!keyword) return 0
  const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return (text.match(regex) || []).length
}

export function SeoAnalysisView({ article }: SeoAnalysisViewProps) {
  const analysis = useMemo(() => {
    const html = article.htmlContent || ''
    const plainText = stripHtml(html)
    const keyword = article.keyword || ''
    const title = article.title || ''
    const metaDesc = article.metaDescription || ''
    const wordCount = plainText.split(/\s+/).filter(Boolean).length

    // Keyword density
    const keywordCount = countOccurrences(plainText, keyword)
    const keywordDensity = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0

    // Heading analysis
    const h1Matches = html.match(/<h1[^>]*>/gi) || []
    const h2Matches = html.match(/<h2[^>]*>(.*?)<\/h2>/gi) || []
    const h3Matches = html.match(/<h3[^>]*>/gi) || []
    const h2Texts = h2Matches.map(h => stripHtml(h))
    const h2WithKeyword = h2Texts.filter(h => h.toLowerCase().includes(keyword.toLowerCase()))

    // Links
    const allLinks = html.match(/<a\s[^>]*href="[^"]*"[^>]*>/gi) || []
    const internalLinks = allLinks.filter(l => l.includes('nakednutrition'))
    const externalLinks = allLinks.filter(l => !l.includes('nakednutrition') && !l.includes('#'))

    // Images
    const images = html.match(/<img[^>]*>/gi) || []
    const imagesWithAlt = images.filter(img => /alt="[^"]+"/i.test(img))
    const imagesWithPlaceholder = images.filter(img => /IMAGE_PLACEHOLDER/i.test(img))

    // FAQ / Schema
    const hasFaq = /<section[^>]*id="faq"/i.test(html)
    const hasSchema = /application\/ld\+json/i.test(html) || (article.schemaMarkup && article.schemaMarkup.length > 10)

    // Paragraph analysis
    const paragraphs = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []
    const longParagraphs = paragraphs.filter(p => stripHtml(p).split(/\s+/).length > 100)

    // Meta description
    const metaLength = metaDesc.length

    // Title analysis
    const titleLength = title.length
    const titleHasKeyword = title.toLowerCase().includes(keyword.toLowerCase())

    // Build checks
    const checks: SeoCheck[] = []

    // Title checks
    checks.push({
      id: 'title-length', label: 'Title Length', category: 'Title & Meta',
      status: titleLength >= 30 && titleLength <= 70 ? 'pass' : titleLength >= 20 && titleLength <= 80 ? 'warn' : 'fail',
      detail: `${titleLength} chars (ideal: 30-70)`,
    })
    checks.push({
      id: 'title-keyword', label: 'Keyword in Title', category: 'Title & Meta',
      status: titleHasKeyword ? 'pass' : 'fail',
      detail: titleHasKeyword ? `"${keyword}" found in title` : 'Primary keyword not in title',
    })
    checks.push({
      id: 'meta-length', label: 'Meta Description', category: 'Title & Meta',
      status: metaLength >= 120 && metaLength <= 160 ? 'pass' : metaLength >= 80 && metaLength <= 200 ? 'warn' : 'fail',
      detail: metaLength > 0 ? `${metaLength} chars (ideal: 120-160)` : 'No meta description',
    })
    checks.push({
      id: 'meta-keyword', label: 'Keyword in Meta', category: 'Title & Meta',
      status: metaDesc.toLowerCase().includes(keyword.toLowerCase()) ? 'pass' : 'warn',
      detail: metaDesc.toLowerCase().includes(keyword.toLowerCase()) ? 'Found in meta description' : 'Consider adding keyword to meta',
    })

    // Content checks
    checks.push({
      id: 'word-count', label: 'Word Count', category: 'Content',
      status: wordCount >= 2000 ? 'pass' : wordCount >= 1200 ? 'warn' : 'fail',
      detail: `${(wordCount ?? 0).toLocaleString()} words${(wordCount ?? 0) < 2000 ? ' (aim for 2000+)' : ''}`,
    })
    checks.push({
      id: 'keyword-density', label: 'Keyword Density', category: 'Content',
      status: keywordDensity >= 0.8 && keywordDensity <= 2.5 ? 'pass' : keywordDensity >= 0.3 && keywordDensity <= 4 ? 'warn' : 'fail',
      detail: `${keywordDensity.toFixed(2)}% (${keywordCount}x) — ideal: 0.8-2.5%`,
    })
    checks.push({
      id: 'paragraph-length', label: 'Paragraph Length', category: 'Content',
      status: longParagraphs.length === 0 ? 'pass' : longParagraphs.length <= 2 ? 'warn' : 'fail',
      detail: longParagraphs.length === 0 ? 'All paragraphs under 100 words' : `${longParagraphs.length} paragraph${longParagraphs.length > 1 ? 's' : ''} over 100 words`,
    })

    // Heading checks
    checks.push({
      id: 'h1-count', label: 'H1 Tag', category: 'Headings',
      status: h1Matches.length === 1 ? 'pass' : h1Matches.length === 0 ? 'warn' : 'fail',
      detail: h1Matches.length === 1 ? 'One H1 tag (correct)' : `${h1Matches.length} H1 tags (should be exactly 1)`,
    })
    checks.push({
      id: 'h2-count', label: 'H2 Sections', category: 'Headings',
      status: h2Matches.length >= 4 ? 'pass' : h2Matches.length >= 2 ? 'warn' : 'fail',
      detail: `${h2Matches.length} H2 headings${h2Matches.length < 4 ? ' (aim for 4+)' : ''}`,
    })
    checks.push({
      id: 'h2-keyword', label: 'Keyword in Headings', category: 'Headings',
      status: h2WithKeyword.length >= 2 ? 'pass' : h2WithKeyword.length >= 1 ? 'warn' : 'fail',
      detail: `${h2WithKeyword.length} of ${h2Matches.length} H2s contain keyword`,
    })

    // Links
    checks.push({
      id: 'internal-links', label: 'Internal Links', category: 'Links & Media',
      status: internalLinks.length >= 3 ? 'pass' : internalLinks.length >= 1 ? 'warn' : 'fail',
      detail: `${internalLinks.length} internal links${internalLinks.length < 3 ? ' (aim for 3+)' : ''}`,
    })
    checks.push({
      id: 'total-links', label: 'Total Links', category: 'Links & Media',
      status: allLinks.length >= 5 ? 'pass' : allLinks.length >= 2 ? 'warn' : 'fail',
      detail: `${allLinks.length} total links in article`,
    })

    // Images
    checks.push({
      id: 'image-count', label: 'Images', category: 'Links & Media',
      status: images.length >= 3 && imagesWithPlaceholder.length === 0 ? 'pass' : images.length >= 1 ? 'warn' : 'fail',
      detail: imagesWithPlaceholder.length > 0 ? `${imagesWithPlaceholder.length} unresolved placeholder(s)` : `${images.length} images`,
    })
    checks.push({
      id: 'image-alt', label: 'Image Alt Text', category: 'Links & Media',
      status: images.length === 0 || imagesWithAlt.length === images.length ? 'pass' : imagesWithAlt.length >= images.length * 0.5 ? 'warn' : 'fail',
      detail: images.length > 0 ? `${imagesWithAlt.length}/${images.length} images have alt text` : 'No images to check',
    })

    // Schema
    checks.push({
      id: 'faq-section', label: 'FAQ Section', category: 'Schema',
      status: hasFaq ? 'pass' : 'warn',
      detail: hasFaq ? 'FAQ section present' : 'No FAQ section found',
    })
    checks.push({
      id: 'schema-markup', label: 'Schema Markup', category: 'Schema',
      status: hasSchema ? 'pass' : 'warn',
      detail: hasSchema ? 'JSON-LD schema found' : 'No structured data detected',
    })

    // Score
    const passCount = checks.filter(c => c.status === 'pass').length
    const score = Math.round((passCount / checks.length) * 100)

    return { checks, score, passCount, wordCount, keywordDensity, keywordCount, h2Texts }
  }, [article])

  const categories = ['Title & Meta', 'Content', 'Headings', 'Links & Media', 'Schema']

  const StatusIcon = ({ status }: { status: SeoCheck['status'] }) => {
    if (status === 'pass') return <Check className="h-3.5 w-3.5" style={{ color: 'var(--nn-accent)' }} />
    if (status === 'warn') return <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#d69e2e' }} />
    return <X className="h-3.5 w-3.5" style={{ color: '#c53030' }} />
  }

  const scoreColor = analysis.score >= 80 ? 'var(--nn-accent)' : analysis.score >= 60 ? '#d69e2e' : '#c53030'

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[700px] px-6 pt-6 pb-20">
        {/* Header with score */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4" style={{ color: 'var(--nn-accent)' }} />
              <h1 className="font-serif text-[20px] font-semibold tracking-tight" style={{ color: 'var(--text1)' }}>
                SEO Analysis
              </h1>
            </div>
            <p className="text-[12px]" style={{ color: 'var(--text3)' }}>
              {article.title}
            </p>
          </div>
          {/* Score circle */}
          <div className="flex flex-col items-center">
            <div
              className="flex items-center justify-center rounded-full border-[3px] h-14 w-14"
              style={{ borderColor: scoreColor }}
            >
              <span className="text-[20px] font-bold font-mono" style={{ color: scoreColor }}>
                {analysis.score}
              </span>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-[1px] mt-1" style={{ color: 'var(--text4)' }}>
              Score
            </span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Words', value: (analysis.wordCount ?? 0).toLocaleString(), icon: FileText },
            { label: 'Keyword', value: `${analysis.keywordDensity.toFixed(1)}%`, icon: Search },
            { label: 'Links', value: String(article.linkCount || 0), icon: Link2 },
            { label: 'Images', value: String(article.imageCount || 0), icon: ImageIcon },
          ].map(stat => (
            <div
              key={stat.label}
              className="flex flex-col items-center rounded-lg border py-3"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <stat.icon className="h-3.5 w-3.5 mb-1" style={{ color: 'var(--text4)' }} />
              <span className="text-[16px] font-bold font-mono" style={{ color: 'var(--text1)' }}>{stat.value}</span>
              <span className="text-[9px] font-mono uppercase tracking-[1px]" style={{ color: 'var(--text4)' }}>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Check categories */}
        {categories.map(category => {
          const categoryChecks = analysis.checks.filter(c => c.category === category)
          const catPass = categoryChecks.filter(c => c.status === 'pass').length
          return (
            <div key={category} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[11px] font-mono font-medium tracking-[1px] uppercase" style={{ color: 'var(--text3)' }}>
                  {category}
                </h2>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text4)' }}>
                  {catPass}/{categoryChecks.length}
                </span>
              </div>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {categoryChecks.map((check, i) => (
                  <div
                    key={check.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{
                      background: 'var(--bg)',
                      borderBottom: i < categoryChecks.length - 1 ? '1px solid var(--border)' : undefined,
                    }}
                  >
                    <StatusIcon status={check.status} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text1)' }}>
                        {check.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-right" style={{
                      color: check.status === 'pass' ? 'var(--text3)' : check.status === 'warn' ? '#d69e2e' : '#c53030',
                    }}>
                      {check.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Heading structure */}
        {analysis.h2Texts.length > 0 && (
          <div className="mt-6">
            <h2 className="text-[11px] font-mono font-medium tracking-[1px] uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Heading Structure
            </h2>
            <div className="rounded-lg border p-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Heading className="h-3.5 w-3.5" style={{ color: 'var(--nn-accent)' }} />
                <span className="text-[12px] font-medium" style={{ color: 'var(--text1)' }}>H1: {article.title}</span>
              </div>
              {analysis.h2Texts.map((h2, i) => (
                <div key={i} className="flex items-center gap-2 pl-4 py-0.5">
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text4)' }}>H2</span>
                  <span className="text-[12px]" style={{
                    color: h2.toLowerCase().includes(article.keyword?.toLowerCase() || '') ? 'var(--nn-accent)' : 'var(--text2)',
                  }}>
                    {h2}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
