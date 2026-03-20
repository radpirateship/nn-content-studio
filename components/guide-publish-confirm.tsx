'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  AlertTriangle,
  AlertCircle,
  BookOpen,
  ChevronLeft,
  Globe,
  FileCode,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import type { UltimateGuide } from './ultimate-guide-wizard'

type PublishPhase = 'pre-publish' | 'publishing' | 'success' | 'error'

interface ChecklistItem {
  label: string
  status: 'done' | 'warn' | 'skip'
}

interface SchemaIssue {
  schema: string
  field: string
  message: string
}

interface SchemaValidation {
  status: 'idle' | 'validating' | 'pass' | 'warn' | 'fail'
  errors: SchemaIssue[]
  warnings: SchemaIssue[]
}

interface GuidePublishConfirmProps {
  guide: UltimateGuide
  onBack: () => void
  onNewGuide: () => void
  onViewLibrary: () => void
  onGuideUpdated: (guide: UltimateGuide) => void
}

export function GuidePublishConfirm({
  guide,
  onBack,
  onNewGuide,
  onViewLibrary,
  onGuideUpdated,
}: GuidePublishConfirmProps) {
  const [phase, setPhase] = useState<PublishPhase>('pre-publish')
  const [shopifyUrl, setShopifyUrl] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)

  // ── Schema validation state ──
  const [schema, setSchema] = useState<SchemaValidation>({
    status: 'idle', errors: [], warnings: [],
  })

  // Run schema validation automatically when the component mounts
  useEffect(() => {
    if (!guide.html_content) return
    let cancelled = false

    async function validate() {
      setSchema(prev => ({ ...prev, status: 'validating' }))
      try {
        const res = await fetch('/api/ultimate-guides/validate-schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: guide.html_content }),
        })
        if (!res.ok) throw new Error('Validation request failed')
        const data = await res.json()
        if (cancelled) return
        setSchema({
          status: data.errors?.length > 0 ? 'fail' : data.warnings?.length > 0 ? 'warn' : 'pass',
          errors: data.errors || [],
          warnings: data.warnings || [],
        })
      } catch {
        if (cancelled) return
        setSchema({ status: 'warn', errors: [], warnings: [{ schema: 'General', field: '', message: 'Could not run schema validation' }] })
      }
    }

    validate()
    return () => { cancelled = true }
  }, [guide.html_content])

  const pageUrl = shopifyUrl || `https://nakednutrition.com/pages/${guide.slug}`

  const schemaCheckLabel =
    schema.status === 'validating' ? 'Validating structured data…' :
    schema.status === 'pass'       ? 'Structured data (JSON-LD) valid' :
    schema.status === 'warn'       ? `Structured data — ${schema.warnings.length} warning(s)` :
    schema.status === 'fail'       ? `Structured data — ${schema.errors.length} error(s)` :
    'Structured data not checked'

  const schemaCheckStatus: 'done' | 'warn' | 'skip' =
    schema.status === 'pass' ? 'done' :
    schema.status === 'fail' || schema.status === 'warn' ? 'warn' :
    'skip'

  const checklist: ChecklistItem[] = [
    { label: 'Guide setup complete', status: guide.config_complete ? 'done' : 'warn' },
    { label: `${guide.selected_products?.length || 0} products selected`, status: (guide.selected_products?.length || 0) > 0 ? 'done' : 'warn' },
    { label: 'Content generated for all sections', status: guide.content_complete ? 'done' : 'warn' },
    { label: `${guide.image_count || 0} images added`, status: guide.has_images ? 'done' : 'warn' },
    { label: 'Meta description set', status: guide.meta_description ? 'done' : 'warn' },
    { label: schemaCheckLabel, status: schemaCheckStatus },
    { label: 'Published to Shopify Pages', status: phase === 'success' ? 'done' : 'skip' },
    { label: 'Sitemap ping sent — indexing takes 24–48h', status: phase === 'success' ? 'warn' : 'skip' },
  ]

  const handlePublish = async () => {
    setPhase('publishing')
    setPublishError(null)

    try {
      const res = await fetch('/api/shopify/pages/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: guide.title,
          bodyHtml: guide.html_content || '',
          handle: guide.slug,
          metaDescription: guide.meta_description || '',
          published: true,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Shopify returned ${res.status}`)
      }

      const result = await res.json()
      const returnedUrl = result.page?.url
      setShopifyUrl(returnedUrl || pageUrl)
      setPublishedAt(
        new Date().toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      )
      setPhase('success')

      // Update DB record with publish status
      try {
        const dbRes = await fetch('/api/ultimate-guides', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: guide.id,
            status: 'published',
            shopify_page_id: String(result.page?.id || ''),
            published_at: new Date().toISOString(),
          }),
        })
        if (dbRes.ok) {
          const data = await dbRes.json()
          onGuideUpdated(data as UltimateGuide)
        } else {
          console.error('Failed to update guide status in DB:', dbRes.status)
        }
      } catch (dbErr) {
        console.error('Failed to update guide status in DB:', dbErr)
      }

    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Failed to publish')
      setPhase('error')
    }
  }

  const detailRows = [
    { label: 'Title',         value: guide.title },
    { label: 'URL',           value: `/pages/${guide.slug}`, href: pageUrl },
    { label: 'Products',      value: `${guide.selected_products?.length || 0} featured` },
    { label: 'Images',        value: `${guide.image_count || 0} section images` },
    ...(publishedAt ? [{ label: 'Published', value: publishedAt }] : []),
  ]

  return (
    <div className="flex flex-1 items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
      <div
        className="w-full max-w-[520px] rounded-lg border p-8 space-y-6"
        style={{ background: 'var(--bg-warm)', borderColor: 'var(--border)' }}
      >

        {/* Icon */}
        <div className="flex justify-center">
          {phase === 'publishing' && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          )}
          {phase === 'success' && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          )}
          {phase === 'error' && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          )}
          {phase === 'pre-publish' && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--nn-accent-light)' }}>
              <Globe className="h-8 w-8" style={{ color: 'var(--nn-accent)' }} />
            </div>
          )}
        </div>

        {/* Heading */}
        <div className="text-center">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text1)' }}>
            {phase === 'pre-publish' && 'Ready to Publish'}
            {phase === 'publishing' && 'Publishing to Shopify...'}
            {phase === 'success' && 'Guide Published!'}
            {phase === 'error' && 'Publish Failed'}
          </h2>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
            {phase === 'pre-publish' && `This will create a new Shopify Page at /pages/${guide.slug}`}
            {phase === 'publishing' && 'Uploading content to Shopify Pages...'}
            {phase === 'success' && 'Your ultimate guide is live on nakednutrition.com'}
            {phase === 'error' && publishError}
          </p>
        </div>

        {/* Guide details */}
        <div className="rounded-lg border divide-y" style={{ borderColor: 'var(--border)' }}>
          {detailRows.map(row => (
            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[12px] font-medium" style={{ color: 'var(--text3)' }}>{row.label}</span>
              {'href' in row ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener"
                  className="text-[12px] font-mono flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--nn-accent)' }}
                >
                  {row.value} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-[12px]" style={{ color: 'var(--text1)' }}>{row.value}</span>
              )}
            </div>
          ))}
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          {checklist.map((item, i) => (
            item.status !== 'skip' && (
              <div key={i} className="flex items-center gap-2.5 text-[12px]">
                {item.status === 'done' ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                )}
                <span style={{ color: item.status === 'done' ? 'var(--text2)' : 'var(--text3)' }}>
                  {item.label}
                </span>
              </div>
            )
          ))}
        </div>

        {/* Schema validation details */}
        {(schema.status === 'fail' || schema.status === 'warn') && (schema.errors.length > 0 || schema.warnings.length > 0) && (
          <div
            className="rounded-lg border p-3 space-y-2"
            style={{
              borderColor: schema.errors.length > 0 ? '#fca5a5' : '#fcd34d',
              background: schema.errors.length > 0 ? '#fef2f2' : '#fffbeb',
            }}
          >
            <div className="flex items-center gap-2">
              {schema.errors.length > 0
                ? <ShieldAlert className="h-4 w-4 text-red-500" />
                : <ShieldCheck className="h-4 w-4 text-amber-500" />
              }
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: schema.errors.length > 0 ? '#991b1b' : '#92400e' }}>
                Schema Validation {schema.errors.length > 0 ? 'Errors' : 'Warnings'}
              </p>
            </div>
            <div className="space-y-1 text-[12px]">
              {schema.errors.map((e, i) => (
                <p key={`e-${i}`} className="text-red-700">
                  <strong>{e.schema}</strong> → {e.field}: {e.message}
                </p>
              ))}
              {schema.warnings.map((w, i) => (
                <p key={`w-${i}`} className="text-amber-700">
                  <strong>{w.schema}</strong> → {w.field}: {w.message}
                </p>
              ))}
            </div>
          </div>
        )}

        {schema.status === 'pass' && (
          <div
            className="rounded-lg border p-3 flex items-center gap-2"
            style={{ borderColor: '#86efac', background: '#f0fdf4' }}
          >
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <p className="text-[12px] text-green-800 font-medium">
              All JSON-LD schema blocks are valid — Article, BreadcrumbList, FAQ, and Product schemas look good.
            </p>
          </div>
        )}

        {/* Post-publish reminders */}
        {phase === 'success' && (
          <div
            className="rounded-lg border p-3 space-y-1.5"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--text4)' }}>
              Manual next steps
            </p>
            <div className="space-y-1 text-[12px]" style={{ color: 'var(--text3)' }}>
              <p>• Set the OG image in Smart SEO app for this page</p>
              <p>• Add this guide to the Related Ultimate Guides hub on sibling guides</p>
              <p>• Verify FAQ accordion and nav chips work on the live page</p>
              <p>• Test with Facebook Sharing Debugger to confirm OG image</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {phase === 'pre-publish' && (
            <>
              <Button
                onClick={handlePublish}
                className="w-full gap-2"
                style={{ background: 'var(--nn-accent)', color: '#fff' }}
              >
                <Globe className="h-4 w-4" />
                Publish to Shopify
              </Button>
              <Button variant="outline" onClick={onBack} className="w-full gap-2">
                <ChevronLeft className="h-4 w-4" /> Back to Review
              </Button>
            </>
          )}

          {phase === 'publishing' && (
            <Button disabled className="w-full gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Publishing...
            </Button>
          )}

          {phase === 'success' && (
            <>
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener"
                className="flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold transition-colors"
                style={{ background: 'var(--nn-accent)', color: '#fff', textDecoration: 'none' }}
              >
                <ExternalLink className="h-4 w-4" /> View Live Guide
              </a>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={onNewGuide} className="gap-1.5 text-[12px]">
                  <BookOpen className="h-4 w-4" /> New Guide
                </Button>
                <Button variant="outline" onClick={onViewLibrary} className="gap-1.5 text-[12px]">
                  <FileCode className="h-4 w-4" /> All Guides
                </Button>
              </div>
            </>
          )}

          {phase === 'error' && (
            <>
              <Button
                onClick={handlePublish}
                className="w-full gap-2"
                style={{ background: 'var(--nn-accent)', color: '#fff' }}
              >
                Try Again
              </Button>
              <Button variant="outline" onClick={onBack} className="w-full gap-2">
                <ChevronLeft className="h-4 w-4" /> Back to Review
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}