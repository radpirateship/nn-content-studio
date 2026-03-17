'use client'

import { useState } from 'react'
import { ArrowRight, Plus, X, Search, Loader2 } from 'lucide-react'

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
  const [activeTab, setActiveTab] = useState<'paste' | 'shopify'>('paste')
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
    calculatorType: 'creatine-dosage',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [shopifyQuery, setShopifyQuery] = useState('')
  const [shopifyResults, setShopifyResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

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

  const handleAnalyze = async () => {
    if (!articleContent.trim()) {
      alert('Please provide article content')
      return
    }
    if (!keyword.trim()) {
      alert('Please enter a primary keyword')
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

      const analysis = await response.json()
      const settingsData = {
        category,
        keyword,
        tone,
        wordCount: parseInt(wordCount),
        ...settings,
      }

      onAnalysisComplete(analysis, articleContent, validCitations, settingsData)
    } catch (error) {
      console.error('Analysis failed:', error)
      alert('Failed to analyze article. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Column: Article Input + Citations */}
      <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: 'var(--border)' }}>
        {/* Header */}
        <div className="flex-shrink-0 border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
          <h1 className="font-serif text-[22px] font-semibold mb-1" style={{ color: 'var(--text1)' }}>
            Revamp Article
          </h1>
          <p className="text-[13px]" style={{ color: 'var(--text3)' }}>
            Analyze and rewrite existing content
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
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-mono uppercase tracking-[0.5px] mb-2" style={{ color: 'var(--text3)' }}>
                  Search Shopify Blog
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shopifyQuery}
                    onChange={e => setShopifyQuery(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && searchShopify()}
                    placeholder="Search by title..."
                    className="flex-1 px-3 py-2 rounded-lg border text-[13px]"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
                  />
                  <button
                    onClick={searchShopify}
                    disabled={isSearching}
                    className="px-3 py-2 rounded-lg text-[13px] font-medium text-white transition-all"
                    style={{ background: 'var(--nn-accent)' }}
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {shopifyResults.length > 0 && (
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  {shopifyResults.map(article => (
                    <button
                      key={article.id}
                      onClick={() => fetchFromShopify(article.id)}
                      className="w-full text-left px-4 py-3 border-b hover:bg-opacity-50 transition-all"
                      style={{
                        background: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--text1)',
                        ':hover': { background: 'var(--surface)' },
                      }}
                    >
                      <div className="text-[12px] font-medium">{article.title}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
                        {article.created_at}
                      </div>
                    </button>
                  ))}
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
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-[13px] text-white transition-all"
            style={{ background: 'var(--nn-accent)', opacity: isLoading ? 0.7 : 1 }}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
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
  )
}
