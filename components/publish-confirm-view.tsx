'use client'

import { useState } from 'react'
import { Check, ExternalLink, FilePlus, BookOpen, Clock, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { GeneratedArticle } from '@/lib/types'
import { buildShopifyTags } from '@/lib/tagMapping'

interface PublishConfirmViewProps {
  article: GeneratedArticle
  onBackToEditor: () => void
  onNewArticle: () => void
  onViewLibrary: () => void
  onViewQueue: () => void
  onStatusChange?: (id: string, status: 'draft' | 'reviewing' | 'approved' | 'published' | 'failed') => void
  onArticleUpdate?: (updates: Partial<GeneratedArticle>) => void
}

type PublishPhase = 'pre-publish' | 'publishing' | 'success' | 'error'

interface ChecklistItem {
  label: string
  status: 'done' | 'warn' | 'skip'
}

export function PublishConfirmView({ article, onBackToEditor, onNewArticle, onViewLibrary, onViewQueue, onStatusChange, onArticleUpdate }: PublishConfirmViewProps) {
  const [phase, setPhase] = useState<PublishPhase>('pre-publish')
  const [shopifyUrl, setShopifyUrl] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)

  const checklist: ChecklistItem[] = [
    { label: 'Content pushed to Shopify blog', status: phase === 'success' ? 'done' : 'skip' },
    { label: 'Meta title & description set', status: article.metaDescription ? 'done' : 'warn' },
    { label: `${article.linkCount || 0} internal links inserted`, status: (article.linkCount || 0) > 0 ? 'done' : 'warn' },
    { label: `${article.imageCount || 0} images uploaded`, status: (article.imageCount || 0) > 0 ? 'done' : 'warn' },
    { label: 'Schema markup (FAQ + Product) added', status: article.schemaMarkup ? 'done' : 'warn' },
    { label: 'Sitemap ping sent -- indexing may take 24-48h', status: phase === 'success' ? 'warn' : 'skip' },
  ]

  const handlePublish = async () => {
    setPhase('publishing')
    setPublishError(null)

    try {
      const tags = buildShopifyTags(article.category, article.articleType)

      const response = await fetch('/api/shopify/blog/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          bodyHtml: article.htmlContent,
          summary: article.metaDescription || '',
          tags,
          author: 'Naked Nutrition',
          handle: article.slug,
          published: true,
          featuredImageUrl: article.featuredImage?.url || undefined,
          featuredImageAlt: article.featuredImage?.altText || `${article.title} - Naked Nutrition`,
          metafields: [
            { namespace: 'global', key: 'title_tag', value: article.title, type: 'single_line_text_field' },
            { namespace: 'global', key: 'description_tag', value: article.metaDescription || '', type: 'single_line_text_field' },
          ],
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Shopify returned ${response.status}`)
      }

      const result = await response.json()
      const returnedUrl = result.article?.url
      const resolvedBlogHandle = result.blogHandle || 'news'
      const fallbackUrl = `https://nakednutrition.com/blogs/${resolvedBlogHandle}/${result.article?.handle || article.slug || 'article'}`
      setShopifyUrl(returnedUrl || fallbackUrl)
      setPublishedAt(new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))
      setPhase('success')
      // Store the resolved blog handle so schema markup uses the correct URL
      onArticleUpdate?.({ shopifyBlogHandle: resolvedBlogHandle })
      onStatusChange?.(article.id, 'published')

      // Surface sitemap ping failures so the user knows indexing may be delayed
      if (result.sitemapPing) {
        const failed = Object.entries(result.sitemapPing as Record<string, string>)
          .filter(([, status]) => status !== 'sent')
          .map(([engine]) => engine)
        if (failed.length > 0) {
          toast.warning('Some search engine pings failed', {
            description: `${failed.join(', ')} did not respond. Indexing may be delayed.`,
          })
        }
      }
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Failed to publish')
      setPhase('error')
    }
  }

  const blogHandle = article.shopifyBlogHandle || 'news'
  const liveUrl = shopifyUrl || `https://nakednutrition.com/blogs/${blogHandle}/${article.slug}`

  const detailRows = [
    { label: 'Title', value: article.title },
    { label: 'URL', value: `/blogs/${blogHandle}/${article.slug}`, href: liveUrl },
    { label: 'Category', value: article.category?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
    { label: 'Word Count', value: article.wordCount?.toLocaleString() || '--' },
    ...(publishedAt ? [{ label: 'Published', value: publishedAt }] : []),
  ]

  return (
    <div className="flex flex-1 items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[520px] rounded-lg border p-8" style={{ background: 'var(--bg-warm)', borderColor: 'var(--border)' }}>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          {phase === 'publishing' && (
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--nn-accent) 12%, transparent)' }}>
              <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--nn-accent)' }} />
            </div>
          )}
          {(phase === 'pre-publish' || phase === 'success') && (
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: phase === 'success' ? 'color-mix(in srgb, var(--nn-accent) 12%, transparent)' : 'var(--surface)' }}>
              <Check className="h-7 w-7" style={{ color: phase === 'success' ? 'var(--nn-accent)' : 'var(--text3)' }} />
            </div>
          )}
          {phase === 'error' && (
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#fef2f2' }}>
              <AlertTriangle className="h-7 w-7" style={{ color: '#c53030' }} />
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="text-center font-serif text-[20px] font-semibold mb-1" style={{ color: 'var(--text1)' }}>
          {phase === 'pre-publish' && 'Ready to Publish'}
          {phase === 'publishing' && 'Publishing to Shopify...'}
          {phase === 'success' && 'Article Published!'}
          {phase === 'error' && 'Publish Failed'}
        </h2>
        <p className="text-center text-[13px] mb-6" style={{ color: 'var(--text3)' }}>
          {phase === 'pre-publish' && 'Review the details below before publishing to your Shopify blog.'}
          {phase === 'publishing' && 'Uploading content, images, and metadata to Shopify...'}
          {phase === 'success' && 'Your article is now live on Shopify and indexed for search engines.'}
          {phase === 'error' && 'Something went wrong while publishing. Your article draft is still saved.'}
        </p>

        {/* Error box */}
        {phase === 'error' && publishError && (
          <div className="rounded-md border px-4 py-3 mb-5 text-[12px]" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
            <div className="font-medium mb-0.5">Error Details</div>
            <div>{publishError}</div>
          </div>
        )}

        {/* Detail rows */}
        <div className="rounded-md border divide-y mb-5" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          {detailRows.map(row => (
            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.5px]" style={{ color: 'var(--text4)' }}>{row.label}</span>
              {row.href && phase === 'success' ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12px] font-medium text-right max-w-[300px] truncate underline underline-offset-2 hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--nn-accent)' }}
                >
                  {row.value}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              ) : (
                <span className="text-[12px] font-medium text-right max-w-[300px] truncate" style={{ color: row.href ? 'var(--nn-accent)' : 'var(--text1)' }}>
                  {row.value}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Checklist (shown on success) */}
        {phase === 'success' && (
          <div className="rounded-md border px-4 py-3 mb-5 flex flex-col gap-2" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                {item.status === 'done' && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--nn-accent)' }} />}
                {item.status === 'warn' && <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#b8860b' }} />}
                {item.status === 'skip' && <div className="h-3.5 w-3.5 flex-shrink-0 rounded-full border" style={{ borderColor: 'var(--text4)' }} />}
                <span className="text-[12px]" style={{ color: 'var(--text2)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mb-6">
          {phase === 'pre-publish' && (
            <>
              <Button
                onClick={handlePublish}
                className="flex-1 gap-1.5 text-[13px]"
                             >
                Publish to Shopify
              </Button>
              <Button variant="outline" onClick={onBackToEditor} className="text-[13px]">
                Back to Editor
              </Button>
            </>
          )}
          {phase === 'publishing' && (
            <Button disabled className="flex-1 gap-1.5 text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Publishing...
            </Button>
          )}
          {phase === 'success' && (
            <>
              {shopifyUrl && (
                <a href={shopifyUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button className="w-full gap-1.5 text-[13px]" style={{ background: 'var(--nn-accent)', color: '#fff' }}>
                    View on Shopify <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              )}
              <Button variant="outline" onClick={onBackToEditor} className="text-[13px]">
                Back to Editor
              </Button>
            </>
          )}
          {phase === 'error' && (
            <>
              <Button
                onClick={handlePublish}
                className="flex-1 gap-1.5 text-[13px]"
                             >
                Retry Publish
              </Button>
              <Button variant="outline" onClick={onBackToEditor} className="text-[13px]">
                Back to Editor
              </Button>
            </>
          )}
        </div>

        {/* Next steps (shown on success) */}
        {phase === 'success' && (
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[1px] mb-2" style={{ color: 'var(--text4)' }}>
              {"What's Next?"}
            </div>
            <div className="flex flex-col gap-1">
              {[
                { icon: <FilePlus className="h-4 w-4" />, label: 'Create another article', onClick: onNewArticle },
                { icon: <BookOpen className="h-4 w-4" />, label: 'View article library', onClick: onViewLibrary },
                { icon: <Clock className="h-4 w-4" />, label: 'Check content queue', onClick: onViewQueue },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={item.onClick}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors hover:bg-black/[0.03]"
                  style={{ color: 'var(--text2)' }}
                >
                  <span style={{ color: 'var(--text4)' }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
