'use client'

import { useState } from 'react'
import { ArrowRight, Plus, X, Search, Loader2, Upload, Info } from 'lucide-react'
import { toast } from 'sonner'
import { RevampStepper, type RevampStep } from './revamp-stepper'

interface RevampArticleViewProps {
  onAnalysisComplete: (
    analysis: any,
    originalContent: string,
    citations: { url: string; title?: string; notes?: string }[],
    settings: any
  ) => void
}

interface Citation {
  id: string
  url: string
  title?: string
  notes?: string
}

interface BlogPost {
  id: number
  url: string
  section: string
  slug: string
  category: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  created_at: string
}

const NN_CATEGORIES = [
  'creatine',
  'whey-protein',
  'plant-protein',
  'pre-workout',
  'post-workout',
  'mass-gainer',
  'collagen',
  'vitamins-minerals',
  'greens-superfoods',
  'fiber-digestive',
  'weight-management',
  'general-nutrition',
]

export function RevampArticleView({ onAnalysisComplete }: RevampArticleViewProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'shopify' | 'browse'>('paste')
  const [articleContent, setArticleContent] = useState('')
  const [citations, setCitations] = useState<Citation[]>([{ id: '1', url: '', title: '', notes: '' }])
  const [category, setCategory] = useState(NN_CATEGORIES[0])
  const [keyword, setKeyword] = useState('')
  const [tone, setTone] = useState('Educational')
  const [wordCount, setWordCount] = useState('2000')
  const [settings, setSettings] = useState({
    includeProducts: true,
    includeFAQ: true,
    includeEmailCapture: false,
    includeCalculator: false,
    includeComparisonTable: false,
    includeImages: true,
    calculatorType: 'creatine-dosage',
    videoUrl: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [shopifyQuery, setShopifyQuery] = useState('')
  const [shopifyResults, setShopifyResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([])
  const [isLoadingBlogPosts, setIsLoadingBlogPosts] = useState(false)
  const [isUploadingCSV, setIsUploadingCSV] = useState(false)

  const addCitation = () => {
    setCitations([...citations, { id: Date.now().toString(), url: '', title: '', notes: '' }])
  }

  const removeCitation = (id: string) => {
    setCitations(citations.filter(c => c.id !== id))
  }

  const updateCitation = (id: string, field: keyof Citation, value: string) => {
    setCitations(
      citations.map(c => (c.id === id ? { ...c, [field]: value } : c))
    )
  }

  const searchShopify = async () => {
    if (!shopifyQuery.trim()) return
    setIsSearching(true)
    try {
      const response = await fetch(
        `/api/shopify/blog/search?query=${encodeURIComponent(shopifyQuery)}`
      )
      if (response.ok) {
        const data = await response.json()
        setShopifyResults(data.articles || [])
      }
    } catch (error) {
      console.error('Failed to search Shopify:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const fetchFromShopify = async (articleId: string) => {
    try {
      const response = await fetch(`/api/shopify/blog/fetch?id=${articleId}`)
      if (response.ok) {
        const data = await response.json()
        setArticleContent(data.body_html || '')
        setActiveTab('paste')
        setShopifyResults([])
      }
    } catch (error) {
      console.error('Failed to fetch article from Shopify:', error)
    }
  }

  const fetchBlogPosts = async () => {
    setIsLoadingBlogPosts(true)
    try {
      const response = await fetch('/api/blog-posts?sort=clicks&limit=100')
      if (response.ok) {
        const data = await response.json()
        setBlogPosts(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch blog posts:', error)
    } finally {
      setIsLoadingBlogPosts(false)
    }
  }

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingCSV(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/blog-posts', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        await fetchBlogPosts()
      } else {
        console.error('Failed to upload CSV')
      }
    } catch (error) {
      console.error('CSV upload failed:', error)
    } finally {
      setIsUploadingCSV(false)
      event.target.value = ''
    }
  }

  const revampBlogPost = (post: BlogPost) => {
    // Shopify API access not available yet — set up paste tab with
    // the article URL and pre-fill category/keyword so the user can
    // copy-paste the HTML from Shopify admin manually
    setArticleContent('')
    setCategory(post.category)
    setKeyword(post.slug.replace(/-/g, ' '))
    setActiveTab('paste')
    // Small delay so the tab switch renders, then focus the textarea
    setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Paste"]')
      if (textarea) {
        textarea.placeholder = `Paste the HTML for: ${post.url}\n\nOpen this URL in Shopify Admin → Blog posts → find this article → copy the HTML`
        textarea.focus()
      }
    }, 100)
  }

  const formatSlugToTitle = (slug: string): string => {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const handleAnalyze = async () => {
    if (!articleContent.trim()) {
      toast.error('Please provide article content', { description: 'Paste HTML, enter a Shopify URL, or select a blog post.' })
      return
    }
    if (!keyword.trim()) {
      toast.error('Please enter a primary keyword', { description: 'The keyword is used for SEO analysis and link suggestions.' })
      return
    }

    setIsLoading(true)
    try {
      const validCitations = citations.filter(c => c.url.trim())
      const response = await fetch('/api/revamp/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingContent: articleContent,
          citations: validCitations,
          category,
          keyword,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze article')
      }

      const responseData = await response.json()
      // API returns { analysis: { ... } } — unwrap the inner object
      const analysis = responseData.analysis || responseData
      const settingsData = {
        category,
        keyword,
        tone,
        wordCount: parseInt(wordCount),
        ...settings,
      }

      onAnalysisComplete(analysis, articleContent, validCitations, settingsData)
    } catch (error) {
      console.error('[revamp] Analysis failed:', error)
      toast.error('Analysis failed', { description: error instanceof Error ? error.message : 'Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  const stepperStep: RevampStep = isLoading ? 'analyzing' : 'input'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Progress Stepper */}
      <div className="flex-shrink-0 border-b px-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-warm)' }}>
        <RevampStepper currentStep={stepperStep} />
      </div>

      <div className="flex flex-1 overflow-hidden">
      {/* Left Column: Article Input + Citations */}
      <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: 'var(--border)' }}>
        {/* Header */}
        <div className="flex-shrink-0 border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
          <h1 className="font-serif text-[22px] font-semibold mb-1" style={{ color: 'var(--text1)' }}>
            Revamp Article
          </h1>
          <p className="text-[13px] leading-[1.5]" style={{ color: 'var(--text3)' }}>
            Paste or fetch an existing article, then analyze it. You&apos;ll review the analysis —
            word count, heading structure, content gaps — and customize an improved outline before generating.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b px-6 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setActiveTab('paste')}
            className="px-4 py-2.5 text-[12px] font-medium border-b-[2px] transition-all"
            style={{
              color: activeTab === 'paste' ? 'var(--nn-accent)' : 'var(--text3)',
              borderBottomColor: activeTab === 'paste' ? 'var(--nn-accent)' : 'transparent',
            }}
          >
            Paste Content
          </button>
          <button
            onClick={() => setActiveTab('shopify')}
            className="px-4 py-2.5 text-[12px] font-medium border-b-[2px] transition-all"
            style={{
              color: activeTab === 'shopify' ? 'var(--nn-accent)' : 'var(--text3)',
              borderBottomColor: activeTab === 'shopify' ? 'var(--nn-accent)' : 'transparent',
            }}
          >
            Fetch from Shopify
          </button>
          <button
            onClick={() => {
              setActiveTab('browse')
              if (blogPosts.length === 0) {
                fetchBlogPosts()
              }
            }}
            className="px-4 py-2.5 text-[12px] font-medium border-b-[2px] transition-all"
            style={{
              color: activeTab === 'browse' ? 'var(--nn-accent)' : 'var(--text3)',
              borderBottomColor: activeTab === 'browse' ? 'var(--nn-accent)' : 'transparent',
            }}
          >
            Browse
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'paste' && (
            <div>
              <label className="block text-[12px] font-mono uppercase tracking-[0.5px] mb-2" style={{ color: 'var(--text3)' }}>
                Article Content
              </label>
              <textarea
                value={articleContent}
                onChange={e => setArticleContent(e.target.value)}
                placeholder="Paste your HTML or text content here..."
                className="w-full h-[200px] p-3 rounded-lg border resize-none"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
              />
            </div>
          )}

          {activeTab === 'shopify' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 mb-3" style={{ color: 'var(--text4)' }} />
              <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--text2)' }}>
                Shopify API Integration
              </p>
              <p className="text-[12px] max-w-[320px]" style={{ color: 'var(--text4)' }}>
                Direct Shopify blog search requires API access that is not yet configured. Use the <strong>Paste</strong> tab to paste article HTML, or use <strong>Browse</strong> to pick from your GSC data.
              </p>
            </div>
          )}

          {activeTab === 'browse' && (
            <div className="space-y-4">
              {/* Upload Area */}
              <div className="p-4 rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    disabled={isUploadingCSV}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <Upload className="h-5 w-5 mb-2" style={{ color: 'var(--text3)' }} />
                    <div className="text-[13px] font-medium" style={{ color: 'var(--text2)' }}>
                      {isUploadingCSV ? 'Uploading...' : 'Upload GSC data (nn-blog-posts.csv)'}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
                      Click to browse
                    </div>
                  </div>
                </label>
              </div>

              {/* Blog Posts List */}
              {blogPosts.length > 0 && (
                <div>
                  <div className="text-[13px] font-mono mb-3" style={{ color: 'var(--text2)' }}>
                    {blogPosts.length} blog posts loaded — sorted by clicks
                  </div>

                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {blogPosts.map(post => (
                      <div
                        key={post.id}
                        className="p-3 rounded-lg border hover:border-opacity-100 transition-all"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[13px] font-medium leading-snug" style={{ color: 'var(--text1)' }}>
                              {formatSlugToTitle(post.slug)}
                            </h3>
                            {post.category && (
                              <div className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--surface)', color: 'var(--text2)' }}>
                                {post.category.replace(/-/g, ' ')}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => revampBlogPost(post)}
                            className="px-2.5 py-1 rounded text-[11px] font-medium text-white transition-all flex-shrink-0"
                            style={{ background: 'var(--nn-accent)' }}
                          >
                            Revamp This
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-[11px] font-mono">
                          <div>
                            <div style={{ color: 'var(--text4)' }}>Clicks</div>
                            <div className="font-semibold" style={{ color: 'var(--text1)' }}>
                              {(post.clicks ?? 0).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text4)' }}>Impressions</div>
                            <div className="font-semibold" style={{ color: 'var(--text1)' }}>
                              {(post.impressions ?? 0).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text4)' }}>Position</div>
                            <div className="font-semibold" style={{ color: 'var(--text1)' }}>
                              {post.position > 0 ? post.position.toFixed(1) : '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isLoadingBlogPosts && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text3)' }} />
                </div>
              )}

              {!isLoadingBlogPosts && blogPosts.length === 0 && (
                <div className="py-8 text-center" style={{ color: 'var(--text3)' }}>
                  <p className="text-[13px]">No blog posts loaded yet.</p>
                  <p className="text-[12px] mt-1">Upload a CSV file to get started.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Citations Panel */}
        <div className="flex-shrink-0 border-t p-6" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-mono uppercase tracking-[0.5px]" style={{ color: 'var(--text3)' }}>
              Citations
            </h2>
            <button
              onClick={addCitation}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-all"
              style={{ color: 'var(--nn-accent)' }}
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>

          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {citations.map(citation => (
              <div key={citation.id} className="space-y-2 p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                <input
                  type="url"
                  value={citation.url}
                  onChange={e => updateCitation(citation.id, 'url', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-2 py-1.5 text-[11px] rounded border"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
                />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    type="text"
                    value={citation.title || ''}
                    onChange={e => updateCitation(citation.id, 'title', e.target.value)}
                    placeholder="Title (optional)"
                    className="px-2 py-1.5 text-[11px] rounded border"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
                  />
                  <button
                    onClick={() => removeCitation(citation.id)}
                    className="px-2 py-1.5 rounded transition-all"
                    style={{ color: 'var(--text3)', background: 'var(--surface)' }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <textarea
                  value={citation.notes || ''}
                  onChange={e => updateCitation(citation.id, 'notes', e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full px-2 py-1.5 text-[11px] rounded border h-12 resize-none"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Settings */}
      <div className="w-[340px] flex-shrink-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-[0.5px] mb-2" style={{ color: 'var(--text3)' }}>
              Category
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-[12px]"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
            >
              {NN_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat.replace(/-/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Keyword */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-[0.5px] mb-2" style={{ color: 'var(--text3)' }}>
              Primary Keyword
            </label>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="e.g., creatine benefits"
              className="w-full px-3 py-2 rounded-lg border text-[12px]"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
            />
          </div>

          {/* Tone */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-[0.5px] mb-2" style={{ color: 'var(--text3)' }}>
              Tone
            </label>
            <select
              value={tone}
              onChange={e => setTone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-[12px]"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
            >
              {['Educational', 'Scientific', 'Conversational', 'Motivational'].map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Word Count */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-[0.5px] mb-2" style={{ color: 'var(--text3)' }}>
              Target Word Count
            </label>
            <select
              value={wordCount}
              onChange={e => setWordCount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-[12px]"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
            >
              {['1500', '2000', '2500', '3000', '3500', '4000'].map(wc => (
                <option key={wc} value={wc}>
                  {wc} words
                </option>
              ))}
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-2">
            {[
              { key: 'includeProducts', label: 'Include Products' },
              { key: 'includeFAQ', label: 'Include FAQ' },
              { key: 'includeEmailCapture', label: 'Include Email Capture' },
              { key: 'includeComparisonTable', label: 'Include Comparison Table' },
              { key: 'includeImages', label: 'Generate AI Images (Gemini)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[key as keyof typeof settings] as boolean}
                  onChange={e =>
                    setSettings({ ...settings, [key]: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-[12px]" style={{ color: 'var(--text2)' }}>
                  {label}
                </span>
              </label>
            ))}
          </div>

          {/* Calculator Toggle */}
          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={settings.includeCalculator}
              onChange={e =>
                setSettings({ ...settings, includeCalculator: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-[12px]" style={{ color: 'var(--text2)' }}>
              Include Calculator
            </span>
          </label>

          {settings.includeCalculator && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-[0.5px] mb-2" style={{ color: 'var(--text3)' }}>
                Calculator Type
              </label>
              <select
                value={settings.calculatorType}
                onChange={e =>
                  setSettings({ ...settings, calculatorType: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border text-[12px]"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
              >
                {[
                  'creatine-loading',
                  'creatine-dosage',
                  'creatine-timing',
                  'creatine-water-intake',
                  'creatine-body-composition',
                  'creatine-cycling',
                  'creatine-cost',
                ].map(ct => (
                  <option key={ct} value={ct}>
                    {ct.replace(/-/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Video URL */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-[0.5px] mb-2" style={{ color: 'var(--text3)' }}>
              Video URL (YouTube/Vimeo)
            </label>
            <input
              type="url"
              value={settings.videoUrl}
              onChange={e => setSettings({ ...settings, videoUrl: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-3 py-2 rounded-lg border text-[12px]"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
            />
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-[0.5px] mb-2" style={{ color: 'var(--text3)' }}>
              Special Instructions
            </label>
            <textarea
              placeholder="Any specific requirements for this rewrite..."
              className="w-full px-3 py-2 rounded-lg border text-[11px] h-24 resize-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex-shrink-0 border-t p-4" style={{ borderColor: 'var(--border)' }}>
          <div
            className="flex items-start gap-2 mb-3 px-1 text-[11.5px] leading-[1.5]"
            style={{ color: 'var(--text4)' }}
          >
            <Info className="h-3.5 w-3.5 shrink-0 mt-[1px]" />
            <span>
              This will analyze the content and take you to a review page where you can
              adjust the outline, tone, and word count before generating the rewrite.
            </span>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-[13px] text-white transition-all"
            style={{ background: 'var(--nn-accent)', opacity: isLoading ? 0.7 : 1 }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing content...
              </>
            ) : (
              <>
                Analyze Article
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}
