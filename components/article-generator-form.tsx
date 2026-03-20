'use client'

import React from "react"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Sparkles, FileText, ImageIcon, ShoppingBag, HelpCircle, Code, Upload, Download, X, ListChecks } from 'lucide-react'
import type { ArticleInput, ArticleTone } from '@/lib/types'
import { CATEGORY_LABELS, TONE_LABELS } from '@/lib/types'
import type { NNCategory } from '@/lib/nn-categories'

const SHOPIFY_BLOG_TAG_LABELS: Record<string, string> = {
  'news': 'News',
  'wellness': 'Wellness',
  'recipes': 'Recipes',
  'fitness': 'Fitness',
  'diets': 'Diets',
  'protein': 'Protein',
  'supplements': 'Supplements',
}

interface ArticleGeneratorFormProps {
  onSubmit: (input: ArticleInput) => Promise<void>
  onBulkSubmit?: (inputs: ArticleInput[]) => Promise<void>
  isGenerating: boolean
  initialBulkArticles?: ArticleInput[]
}

export function parseCSV(text: string): ArticleInput[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  
  const headers = lines[0].split(',').map(h => h.trim())
  
  return lines.slice(1).filter(line => line.trim()).map(line => {
    // Handle commas inside quotes
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())
    
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    
    return {
      title: row.title || '',
      keyword: row.keyword || '',
    category: (row.category || getStickyCategory()) as NNCategory,
    tone: (row.tone || 'authoritative') as ArticleTone,
      wordCount: parseInt(row.wordCount) || 2000,
      includeProducts: ['yes', 'true', '1', ''].includes(row.includeProducts?.toLowerCase() ?? ''),
      includeFAQ: ['yes', 'true', '1', ''].includes(row.includeFAQ?.toLowerCase() ?? ''),
      includeSchema: ['yes', 'true', '1', ''].includes(row.includeSchema?.toLowerCase() ?? ''),
      shopifySlug: row.shopifySlug || '',
      shopifyBlogTag: (row.shopifyBlogTag || 'news') as string,
    }
  }).filter(a => a.title && a.keyword)
}

function getStickyCategory(): NNCategory {
  if (typeof window === 'undefined') return 'general-nutrition'
  try {
    const saved = localStorage.getItem('nn-sticky-category')
    if (saved) return saved as NNCategory
  } catch {}
  return 'general-nutrition'
}

function getStickyBlogTag(): string {
  if (typeof window === 'undefined') return 'news'
  try {
    const saved = localStorage.getItem('nn-sticky-blogtag')
    if (saved) return saved
  } catch {}
  return 'news'
}

export function ArticleGeneratorForm({ onSubmit, onBulkSubmit, isGenerating, initialBulkArticles }: ArticleGeneratorFormProps) {
  const [mode, setMode] = useState<'single' | 'bulk'>(initialBulkArticles?.length ? 'bulk' : 'single')
  const [bulkArticles, setBulkArticles] = useState<ArticleInput[]>(initialBulkArticles ?? [])
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState<ArticleInput>(() => ({
    title: '',
    keyword: '',
    category: getStickyCategory(),
    tone: 'authoritative',
    wordCount: 2000,
    includeProducts: true,
    includeFAQ: true,
    includeSchema: true,
    shopifySlug: '',
    shopifyBlogTag: getStickyBlogTag(),
  }))

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (!formData.title.trim()) errors.title = 'Title is required'
    else if (formData.title.trim().length < 10) errors.title = 'Title should be at least 10 characters'
    if (!formData.keyword.trim()) errors.keyword = 'Target keyword is required'
    if (formData.wordCount && (formData.wordCount < 300 || formData.wordCount > 10000)) {
      errors.wordCount = 'Word count should be between 300 and 10,000'
    }
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validate()
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) return
    await onSubmit(formData)
  }

  const generateSlugFromTitle = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const updateField = <K extends keyof ArticleInput>(field: K, value: ArticleInput[K]) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      // Auto-generate slug from title if slug hasn't been manually edited
      if (field === 'title' && typeof value === 'string') {
        const currentAutoSlug = generateSlugFromTitle(prev.title)
        if (!prev.shopifySlug || prev.shopifySlug === currentAutoSlug) {
          updated.shopifySlug = generateSlugFromTitle(value)
        }
      }
      // Auto-match blog tag to category when category changes + persist to localStorage
      if (field === 'category') {
        const categoryToTag: Record<string, string> = {
          'protein-powder': 'protein',
          'whey-protein': 'protein',
          'vegan-protein-powder': 'protein',
          'collagen-peptides': 'wellness',
          'overnight-oats': 'recipes',
          'improve-performance-recovery': 'fitness',
          'supplements': 'supplements',
          'kids': 'wellness',
          'creatine': 'supplements',
          'pre-workout': 'supplements',
          'post-workout': 'fitness',
          'bcaa': 'supplements',
          'general-nutrition': 'news',
        }
        updated.shopifyBlogTag = categoryToTag[value as string] || 'news'
        try {
          localStorage.setItem('nn-sticky-category', value as string)
          localStorage.setItem('nn-sticky-blogtag', updated.shopifyBlogTag)
        } catch {}
      }
      return updated
    })
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Generate New Article</CardTitle>
              <CardDescription>Create SEO-optimized wellness content with AI</CardDescription>
            </div>
          </div>
          <div className="flex rounded-lg border border-border/50 bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'single' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'bulk' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Bulk CSV
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mode === 'single' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title & Keyword */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Article Title <span style={{ color: '#c44' }}>*</span></Label>
              <Input
                id="title"
                placeholder="e.g., The Complete Guide to Whey Protein Powder"
                value={formData.title}
                onChange={(e) => { updateField('title', e.target.value); setValidationErrors(prev => { const { title, ...rest } = prev; return rest }) }}
                required
                disabled={isGenerating}
                style={validationErrors.title ? { borderColor: '#c44' } : undefined}
              />
              {validationErrors.title && <p className="text-[11px] mt-1" style={{ color: '#c44' }}>{validationErrors.title}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyword">Target Keyword <span style={{ color: '#c44' }}>*</span></Label>
              <Input
                id="keyword"
                placeholder="e.g., best whey protein powder"
                value={formData.keyword}
                onChange={(e) => { updateField('keyword', e.target.value); setValidationErrors(prev => { const { keyword, ...rest } = prev; return rest }) }}
                required
                disabled={isGenerating}
                style={validationErrors.keyword ? { borderColor: '#c44' } : undefined}
              />
              {validationErrors.keyword && <p className="text-[11px] mt-1" style={{ color: '#c44' }}>{validationErrors.keyword}</p>}
            </div>
          </div>

          {/* Category & Tone */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => updateField('category', v as NNCategory)}
                disabled={isGenerating}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">Writing Tone</Label>
              <Select
                value={formData.tone}
                onValueChange={(v) => updateField('tone', v as ArticleTone)}
                disabled={isGenerating}
              >
                <SelectTrigger id="tone">
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TONE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Word Count */}
          <div className="space-y-2">
            <Label htmlFor="wordCount">Target Word Count</Label>
            <Select
              value={String(formData.wordCount)}
              onValueChange={(v) => updateField('wordCount', parseInt(v))}
              disabled={isGenerating}
            >
              <SelectTrigger id="wordCount">
                <SelectValue placeholder="Select word count" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1500">1,500 words - Standard article</SelectItem>
                <SelectItem value="2000">2,000 words - Comprehensive guide</SelectItem>
                <SelectItem value="2500">2,500 words - In-depth resource</SelectItem>
                <SelectItem value="3000">3,000 words - Ultimate guide</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Shopify Publishing */}
          <div className="space-y-4 rounded-lg border border-border/50 bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">Shopify Publishing</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shopifySlug">URL / Slug</Label>
                <div className="flex items-center gap-0">
                  <span className="inline-flex h-9 shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 text-xs text-muted-foreground">
                    /blogs/wellness/
                  </span>
                  <Input
                    id="shopifySlug"
                    placeholder="your-article-slug"
                    value={formData.shopifySlug || ''}
                    onChange={(e) => updateField('shopifySlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    disabled={isGenerating}
                    className="rounded-l-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shopifyBlogTag">Blog Tag</Label>
                <Select
                  value={formData.shopifyBlogTag || 'news'}
                  onValueChange={(v) => updateField('shopifyBlogTag', v as string)}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="shopifyBlogTag">
                    <SelectValue placeholder="Select blog tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SHOPIFY_BLOG_TAG_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="space-y-4 rounded-lg border border-border/50 bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">Include in Article</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background p-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="includeProducts" className="text-sm font-normal cursor-pointer">
                    Product Recommendations
                  </Label>
                </div>
                <Switch
                  id="includeProducts"
                  checked={formData.includeProducts}
                  onCheckedChange={(v) => updateField('includeProducts', v)}
                  disabled={isGenerating}
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background p-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="includeFAQ" className="text-sm font-normal cursor-pointer">
                    FAQ Section
                  </Label>
                </div>
                <Switch
                  id="includeFAQ"
                  checked={formData.includeFAQ}
                  onCheckedChange={(v) => updateField('includeFAQ', v)}
                  disabled={isGenerating}
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background p-3">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="includeSchema" className="text-sm font-normal cursor-pointer">
                    Schema Markup
                  </Label>
                </div>
                <Switch
                  id="includeSchema"
                  checked={formData.includeSchema}
                  onCheckedChange={(v) => updateField('includeSchema', v)}
                  disabled={isGenerating}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isGenerating || !formData.title || !formData.keyword}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Article...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Article
              </>
            )}
          </Button>
        </form>
        ) : (
        <div className="space-y-6">
          {/* CSV Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Upload CSV File</Label>
              <button
                type="button"
                onClick={() => {
                  const csv = 'title,keyword,category,tone,wordCount,shopifySlug,shopifyBlogTag,includeProducts,includeFAQ,includeSchema\n'
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'bulk-articles-template.csv'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Download Template
              </button>
            </div>
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 bg-muted/20 p-8 transition-colors hover:border-primary/30 hover:bg-muted/40"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const file = e.dataTransfer.files[0]
                if (file && file.name.endsWith('.csv')) {
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    const text = ev.target?.result as string
                    setBulkArticles(parseCSV(text))
                  }
                  reader.readAsText(file)
                }
              }}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Click or drag CSV file here</p>
              <p className="text-xs text-muted-foreground">Columns: title, keyword, category, tone, wordCount, shopifySlug, shopifyBlogTag, includeProducts, includeFAQ, includeSchema</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    const text = ev.target?.result as string
                    setBulkArticles(parseCSV(text))
                  }
                  reader.readAsText(file)
                  e.target.value = ''
                }
              }}
            />
          </div>

          {/* Parsed Articles Preview */}
          {bulkArticles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{bulkArticles.length} article{bulkArticles.length > 1 ? 's' : ''} ready</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBulkArticles([])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-3">
                {bulkArticles.map((article, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-md border border-border/30 bg-background p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{article.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{article.keyword}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{CATEGORY_LABELS[article.category]}</span>
                        {article.shopifyBlogTag && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{SHOPIFY_BLOG_TAG_LABELS[article.shopifyBlogTag]}</span>
                        )}
                        {article.shopifySlug && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">/{article.shopifySlug}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setBulkArticles(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate All Button */}
          <Button
            size="lg"
            className="w-full"
            disabled={isGenerating || bulkArticles.length === 0}
            onClick={() => onBulkSubmit?.(bulkArticles)}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Articles...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate {bulkArticles.length} Article{bulkArticles.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
        )}
      </CardContent>
    </Card>
  )
}
