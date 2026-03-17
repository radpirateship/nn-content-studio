'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  ChevronLeft,
  Eye,
  Image as ImageIcon,
  ShoppingBag,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UltimateGuide } from './ultimate-guide-wizard'

interface GuideReviewProps {
  guide: UltimateGuide
  onBack: () => void
  onPublish: () => void
}

export function GuideReview({ guide, onBack, onPublish }: GuideReviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'images' | 'products'>('preview')

  // Build full HTML from guide sections
  const getGuideHtml = () => {
    const sections = guide.section_content as Record<string, string> | undefined
    if (sections && Object.keys(sections).length > 0) {
      return Object.entries(sections)
        .map(([key, html]) => `<h2 id="${key}">${key.replace(/-/g, ' ')}</h2>\n${html}`)
        .join('\n\n')
    }
    return guide.html_content || ''
  }

  const htmlContent = guide.html_content || getGuideHtml()
  const products = guide.selected_products || []
  const imageUrls = guide.image_cdn_urls || []
  const heroImage = guide.hero_image_cdn_url

  // Readiness checklist
  const checks = [
    { label: 'Content generated', ok: !!htmlContent && htmlContent.length > 500 },
    { label: 'Products selected', ok: products.length > 0 },
    { label: 'Images generated', ok: imageUrls.length > 0 || !!heroImage },
    { label: 'Meta description set', ok: !!guide.meta_description },
  ]
  const allReady = checks.every(c => c.ok)

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="flex-shrink-0 px-8 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Review Guide</h2>
          <p className="text-sm text-gray-600">
            Step 5: Review your complete guide before publishing
          </p>
        </div>
        <div className="flex items-center gap-3">
          {checks.map((c, i) => (
            <div key={i} className="flex items-center gap-1 text-xs">
              {c.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
              )}
              <span className={c.ok ? 'text-green-700' : 'text-yellow-700'}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b">
        {[
          { id: 'preview' as const, label: 'Article Preview', icon: Eye },
          { id: 'images' as const, label: `Images (${imageUrls.length})`, icon: ImageIcon },
          { id: 'products' as const, label: `Products (${products.length})`, icon: ShoppingBag },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto mx-8 rounded-lg border bg-white">
        {activeTab === 'preview' && (
          <div className="p-8 max-w-4xl mx-auto">
            {heroImage && (
              <img
                src={heroImage}
                alt={guide.title}
                className="w-full h-64 object-cover rounded-lg mb-6"
              />
            )}
            <h1 className="text-3xl font-bold mb-3">{guide.title}</h1>
            {guide.meta_description && (
              <p className="text-gray-600 italic mb-6 text-sm border-l-4 border-blue-200 pl-3">
                {guide.meta_description}
              </p>
            )}
            <div
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        )}

        {activeTab === 'images' && (
          <div className="p-6">
            {imageUrls.length === 0 && !heroImage ? (
              <div className="text-center py-12 text-gray-500">
                <ImageIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No images have been generated yet.</p>
                <Button onClick={onBack} variant="outline" className="mt-3 gap-2">
                  <ChevronLeft className="h-4 w-4" /> Go back to Images step
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {heroImage && (
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Hero Image</p>
                    <img src={heroImage} alt="Hero" className="w-full h-48 object-cover rounded-lg" />
                  </div>
                )}
                {imageUrls.filter(u => u !== heroImage).map((url, i) => (
                  <div key={i}>
                    <img src={url} alt={`Section image ${i + 1}`} className="w-full h-40 object-cover rounded-lg" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="p-6">
            {products.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No products selected.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map(p => (
                  <div key={p.id} className="rounded-lg border p-3 text-center">
                    {p.image_url && (
                      <img src={p.image_url} alt={p.title} className="w-full h-32 object-contain rounded mb-2" />
                    )}
                    <h4 className="text-sm font-semibold line-clamp-2">{p.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">{p.vendor}</p>
                    <p className="text-sm font-bold mt-1">${typeof p.price === 'number' ? p.price.toFixed(2) : p.price}</p>
                    {p.selected_role && (
                      <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                        {p.selected_role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex gap-2 px-8 py-4 border-t">
        <Button onClick={onBack} variant="outline" className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back to Images
        </Button>
        <Button
          onClick={onPublish}
          className="ml-auto gap-2"
          style={{ background: 'var(--ppw-accent)', color: '#fff' }}
        >
          Continue to Publish <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
