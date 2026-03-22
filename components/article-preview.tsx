'use client'

import { useState } from 'react'
import JSZip from 'jszip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Eye,
  Code,
  FileText,
  Download,
  Copy,
  Check,
  ExternalLink,
  ShoppingBag,
  Pencil,
  FileDown,
  ImageIcon,
  Loader2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Link2,
  Trash2,
  Sparkles,
  PackageSearch,
  Plus,
  X,
  Save,
  } from 'lucide-react'
import type { GeneratedArticle } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'
import { buildShopifyTags } from '@/lib/tagMapping'

 interface ArticlePreviewProps {
  article: GeneratedArticle
  onEdit: () => void
  onContentUpdate?: (newHtml: string, updates?: Partial<GeneratedArticle>) => void
  onStatusChange?: (id: string, status: 'draft' | 'reviewing' | 'approved' | 'published' | 'failed') => void
  internalLinks?: { title: string; url: string; description?: string }[]
  onGoToStep?: (step: number) => void
  onPublish?: () => void
  }
  
  export function ArticlePreview({ article, onEdit, onGoToStep, onStatusChange, onPublish, onContentUpdate }: ArticlePreviewProps) {
  const [copiedHtml, setCopiedHtml] = useState(false)
  const [copiedSchema, setCopiedSchema] = useState(false)
  const [isDownloadingImages, setIsDownloadingImages] = useState(false)
  const [copiedForShopify, setCopiedForShopify] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [publishResult, setPublishResult] = useState<{ url?: string; error?: string } | null>(null)
  const [featuredImageUrl, setFeaturedImageUrl] = useState(article.featuredImage?.url || '')
  const [featuredImageInput, setFeaturedImageInput] = useState(article.featuredImage?.url || '')

  // Product management state
  const [articleProducts, setArticleProducts] = useState<typeof article.products>(article.products || [])
  const [isSavingProducts, setIsSavingProducts] = useState(false)
  const [productSaveStatus, setProductSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [isAutoSelecting, setIsAutoSelecting] = useState(false)
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [pickerProducts, setPickerProducts] = useState<Array<Record<string, string>>>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Set<string>>(new Set())

  const autoSelectProducts = async () => {
    setIsAutoSelecting(true)
    try {
      const params = new URLSearchParams()
      if (article.category) params.set('category', article.category)
      if (article.keyword) params.set('search', article.keyword)
      params.set('limit', '6')
      const res = await fetch(`/api/products?${params}`)
      if (res.ok) {
        const data = await res.json()
        const mapped = (data.products || []).map((p: Record<string, string>) => ({
          id: p.id || p.handle || '',
          handle: p.handle || '',
          title: p.title || '',
          description: p.description || '',
          vendor: p.vendor || '',
          productType: p.productType || p.category || '',
          tags: [],
          price: p.price || '',
          compareAtPrice: p.compareAtPrice || '',
          imageUrl: p.imageUrl || '',
          url: p.url || '',
          category: (p.category || '') as typeof article.category,
          isAvailable: true,
        }))
        setArticleProducts(mapped)
        setProductSaveStatus('idle')
      }
    } finally {
      setIsAutoSelecting(false)
    }
  }

  const openProductPicker = async () => {
    setShowProductPicker(true)
    setPickerSearch('')
    setPickerSelectedIds(new Set(articleProducts.map(p => p.id || p.handle)))
    if (pickerProducts.length === 0) {
      setPickerLoading(true)
      try {
        const res = await fetch('/api/products?limit=500')
        if (res.ok) {
          const data = await res.json()
          setPickerProducts(data.products || [])
        }
      } finally {
        setPickerLoading(false)
      }
    }
  }

  const togglePickerProduct = (p: Record<string, string>) => {
    const key = p.id || p.handle
    setPickerSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const confirmPickerSelection = () => {
    const selected = pickerProducts
      .filter(p => pickerSelectedIds.has(p.id || p.handle))
      .map(p => ({
        id: p.id || p.handle || '',
        handle: p.handle || '',
        title: p.title || '',
        description: p.description || '',
        vendor: p.vendor || '',
        productType: p.productType || p.category || '',
        tags: [],
        price: p.price || '',
        compareAtPrice: p.compareAtPrice || '',
        imageUrl: p.imageUrl || '',
        url: p.url || '',
        category: (p.category || '') as typeof article.category,
        isAvailable: true,
      }))
    setArticleProducts(selected)
    setShowProductPicker(false)
    setProductSaveStatus('idle')
  }

  const removeProduct = (id: string) => {
    setArticleProducts(prev => prev.filter(p => (p.id || p.handle) !== id))
    setProductSaveStatus('idle')
  }

  const saveProducts = async () => {
    if (!article.dbId) return
    setIsSavingProducts(true)
    try {
      const res = await fetch('/api/articles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: article.dbId,
          products: articleProducts.map(p => ({
            id: p.id,
            handle: p.handle,
            title: p.title,
            description: p.description,
            vendor: p.vendor,
            productType: p.productType,
            tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
            price: p.price,
            compareAtPrice: p.compareAtPrice,
            imageUrl: p.imageUrl,
            url: p.url,
          })),
        }),
      })
      if (res.ok) {
        onContentUpdate?.(article.htmlContent, { products: articleProducts })
        setProductSaveStatus('saved')
        setTimeout(() => setProductSaveStatus('idle'), 3000)
      } else {
        setProductSaveStatus('error')
      }
    } catch {
      setProductSaveStatus('error')
    } finally {
      setIsSavingProducts(false)
    }
  }

  const filteredPickerProducts = pickerProducts.filter(p =>
    !pickerSearch ||
    p.title?.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    p.category?.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    p.vendor?.toLowerCase().includes(pickerSearch.toLowerCase())
  )

  const publishToShopify = async () => {
    setIsPublishing(true)
    setPublishStatus('idle')
    setPublishResult(null)

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
          category: article.category,
          author: 'Naked Nutrition',
          handle: article.slug,
          published: true,
          featuredImageUrl: featuredImageUrl || undefined,
          featuredImageAlt: `${article.title} - Naked Nutrition`,
          metafields: [
            { namespace: 'global', key: 'title_tag', value: (article as any).titleTag || article.title, type: 'single_line_text_field' },
            { namespace: 'global', key: 'description_tag', value: article.metaDescription || '', type: 'single_line_text_field' },
          ],
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to publish')

      setPublishStatus('success')
      setPublishResult({ url: data.article?.url })
      onStatusChange?.(article.id, 'published')
    } catch (error) {
      setPublishStatus('error')
      setPublishResult({ error: error instanceof Error ? error.message : 'Failed to publish' })
    } finally {
      setIsPublishing(false)
    }
  }

  const copyHtmlForShopify = async () => {
    try {
      await navigator.clipboard.writeText(article.htmlContent || '')
      setCopiedForShopify(true)
      window.open('https://nakednutrition.myshopify.com/admin/articles/new', '_blank')
      setTimeout(() => setCopiedForShopify(false), 5000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = article.htmlContent || ''
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedForShopify(true)
      window.open('https://nakednutrition.myshopify.com/admin/articles/new', '_blank')
      setTimeout(() => setCopiedForShopify(false), 5000)
    }
  }

  const copyToClipboard = async (text: string, type: 'html' | 'schema') => {
    await navigator.clipboard.writeText(text)
    if (type === 'html') {
      setCopiedHtml(true)
      setTimeout(() => setCopiedHtml(false), 2000)
    } else {
      setCopiedSchema(true)
      setTimeout(() => setCopiedSchema(false), 2000)
    }
  }

  const downloadHtml = () => {
    const blob = new Blob([article.htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${article.slug}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadImagesAsZip = async () => {
    setIsDownloadingImages(true)
    
    try {
      const zip = new JSZip()
      const imagesFolder = zip.folder(`${article.slug}-images`)
      
      if (!imagesFolder) {
        throw new Error('Failed to create images folder')
      }
      
      const images: { url: string; name: string }[] = []
      
      if (article.featuredImage?.url) {
        images.push({
          url: article.featuredImage.url,
          name: `featured-image.${getImageExtension(article.featuredImage.url)}`
        })
      }
      
      if (article.contentImages && article.contentImages.length > 0) {
        article.contentImages.forEach((img, index) => {
          if (img.url) {
            images.push({
              url: img.url,
              name: `content-image-${index + 1}.${getImageExtension(img.url)}`
            })
          }
        })
      }
      
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
      let match
      let htmlImageIndex = 0
      while ((match = imgRegex.exec(article.htmlContent)) !== null) {
        const src = match[1]
        if (src && src !== '/placeholder.svg' && !src.includes('[IMAGE_PLACEHOLDER')) {
          htmlImageIndex++
          images.push({
            url: src,
            name: `html-image-${htmlImageIndex}.${getImageExtension(src)}`
          })
        }
      }
      
      if (images.length === 0) {
        alert('No images found in this article.')
        setIsDownloadingImages(false)
        return
      }
      
      for (const img of images) {
        try {
          let imageData: Blob | string
          
          if (img.url.startsWith('data:')) {
            const base64Data = img.url.split(',')[1]
            const byteCharacters = atob(base64Data)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            imageData = new Blob([byteArray])
          } else {
            const response = await fetch(img.url)
            imageData = await response.blob()
          }
          
          imagesFolder.file(img.name, imageData)
        } catch (error) {
          console.error(`Failed to download image: ${img.name}`, error)
        }
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${article.slug}-images.zip`
      a.click()
      URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Failed to create zip:', error)
      alert('Failed to download images. Please try again.')
    } finally {
      setIsDownloadingImages(false)
    }
  }
  
  const getImageExtension = (url: string | null | undefined): string => {
    if (!url) return 'png'
    if (url.startsWith('data:image/png')) return 'png'
    if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'jpg'
    if (url.startsWith('data:image/webp')) return 'webp'
    if (url.startsWith('data:image/gif')) return 'gif'
    
    const match = url.match(/\.(png|jpg|jpeg|webp|gif|svg)(\?|$)/i)
    return match ? match[1].toLowerCase() : 'png'
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl leading-tight">{article.title}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{CATEGORY_LABELS[article.category] || article.category}</Badge>
              <span className="text-muted-foreground">|</span>
              <span>{(article.wordCount || 0).toLocaleString()} words</span>
              <span className="text-muted-foreground">|</span>
              <span>Keyword: {article.keyword || 'N/A'}</span>
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
            <Button 
              variant="outline"
              size="sm" 
              onClick={() => {
                const blob = new Blob([article.htmlContent], { type: 'text/html' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${article.slug}.html`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              <FileDown className="mr-1.5 h-4 w-4" />
              Export HTML
            </Button>
            <Button 
              variant="outline"
              size="sm" 
              onClick={downloadImagesAsZip}
              disabled={isDownloadingImages}
            >
              {isDownloadingImages ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Zipping...
                </>
              ) : (
                <>
                  <ImageIcon className="mr-1.5 h-4 w-4" />
                  Download Images
                </>
              )}
            </Button>
            <Button
              size="sm"
            onClick={onPublish || publishToShopify}
            disabled={isPublishing || publishStatus === 'success'}
              className={
                publishStatus === 'success'
                  ? 'bg-green-600 hover:bg-green-600 text-white'
                  : publishStatus === 'error'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-[#96bf48] hover:bg-[#7da63e] text-white'
              }
            >
              {isPublishing ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : publishStatus === 'success' ? (
                <>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Published
                </>
              ) : publishStatus === 'error' ? (
                <>
                  <AlertCircle className="mr-1.5 h-4 w-4" />
                  Retry Publish
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-4 w-4" />
                  Publish to Shopify
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={copyHtmlForShopify}
              className={copiedForShopify ? 'bg-green-600 hover:bg-green-600 text-white border-green-600' : ''}
            >
              {copiedForShopify ? (
                <>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy & Open Shopify
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Status messages */}
        {publishStatus === 'success' && publishResult?.url && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Published successfully!</span>
            <a href={publishResult.url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 font-medium underline underline-offset-2">
              View on Shopify <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        {publishStatus === 'error' && publishResult?.error && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{publishResult.error}</span>
          </div>
        )}
        {copiedForShopify && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>HTML copied! In Shopify editor: click {'<>'} (Show HTML) and paste.</span>
          </div>
        )}

        {/* Enrichment Status + Next Steps */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Next Steps:</span>
          {article.hasInternalLinks ? (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              <Link2 className="mr-1 h-3 w-3" />
              {article.linkCount || 0} Links Added
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onGoToStep?.(2)}
              className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              <Link2 className="h-3.5 w-3.5" />
              Add Internal Links (Step 2)
            </Button>
          )}
          {article.hasImages ? (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              <ImageIcon className="mr-1 h-3 w-3" />
              {article.imageCount || 0} Images Added
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onGoToStep?.(3)}
              className="gap-1.5 border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Add Images (Step 3)
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="mb-4 w-full justify-start">
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="html" className="gap-1.5">
              <Code className="h-4 w-4" />
              HTML
            </TabsTrigger>
            <TabsTrigger value="meta" className="gap-1.5">
              <FileText className="h-4 w-4" />
              SEO & Meta
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5">
              <ShoppingBag className="h-4 w-4" />
              Products ({article.products?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Preview Tab */}
          <TabsContent value="preview" className="mt-0">
            <ScrollArea className="h-[600px] rounded-lg border border-border/50 bg-background">
              <div className="p-6">
                {/* Featured Image */}
                <div className="mb-6">
                  {featuredImageUrl ? (
                    <>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Featured Image</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">1200 × 600</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => {
                            setFeaturedImageUrl('')
                            setFeaturedImageInput('')
                            onContentUpdate?.(article.htmlContent || '', { featuredImage: undefined })
                          }}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                      <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio: '2/1' }}>
                        <img
                          src={featuredImageUrl}
                          alt={`${article.title} - Naked Nutrition`}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="rounded-xl bg-black/60 px-8 py-4 backdrop-blur-sm">
                            <h1 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl">{article.title}</h1>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 px-3 py-2">
                      <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                      <Input
                        placeholder="Paste featured image URL (1200 × 600)…"
                        value={featuredImageInput}
                        onChange={(e) => setFeaturedImageInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setFeaturedImageUrl(featuredImageInput) }}
                        className="h-7 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => setFeaturedImageUrl(featuredImageInput)}
                        disabled={!featuredImageInput.trim()}
                      >
                        Set
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Article Content */}
                <article 
                  className="prose prose-neutral max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: article.htmlContent }}
                />

                {/* FAQ Section */}
                {article.faqs && article.faqs.length > 0 && (
                  <div className="mt-8 border-t border-border pt-8">
                    <h2 className="mb-4 text-2xl font-bold">Frequently Asked Questions</h2>
                    <Accordion type="single" collapsible className="w-full">
                      {article.faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`faq-${index}`}>
                          <AccordionTrigger className="text-left font-medium">
                            {faq.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground">
                            {faq.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* HTML Tab */}
          <TabsContent value="html" className="mt-0">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(article.htmlContent, 'html')}
                >
                  {copiedHtml ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" />
                      Copy HTML
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadHtml}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Download
                </Button>
              </div>
              <ScrollArea className="h-[500px] rounded-lg border border-border/50 bg-muted/30">
                <pre className="p-4 text-sm">
                  <code>{article.htmlContent}</code>
                </pre>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* SEO & Meta Tab */}
          <TabsContent value="meta" className="mt-0">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-medium">Meta Description</h3>
                <p className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm text-muted-foreground">
                  {article.metaDescription || 'No meta description available'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(article.metaDescription || '').length} / 160 characters
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">URL Slug</h3>
                <p className="rounded-lg border border-border/50 bg-muted/30 p-3 font-mono text-sm">
                  /blogs/supplements/{article.slug}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Schema Markup (JSON-LD)</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(article.schemaMarkup, 'schema')}
                  >
                    {copiedSchema ? (
                      <>
                        <Check className="mr-1.5 h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <ScrollArea className="h-[200px] rounded-lg border border-border/50 bg-muted/30">
                  <pre className="p-3 text-xs">
                    <code>{article.schemaMarkup}</code>
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-0 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={autoSelectProducts}
                disabled={isAutoSelecting}
              >
                {isAutoSelecting
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                Auto-select
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openProductPicker}
              >
                <PackageSearch className="mr-1.5 h-3.5 w-3.5" />
                Browse catalog
              </Button>
              <div className="flex-1" />
              {productSaveStatus === 'saved' && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                </span>
              )}
              {productSaveStatus === 'error' && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Save failed
                </span>
              )}
              <Button
                size="sm"
                onClick={saveProducts}
                disabled={isSavingProducts || !article.dbId}
              >
                {isSavingProducts
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save
              </Button>
            </div>

            {/* Auto-select context hint */}
            {isAutoSelecting && (
              <p className="text-xs text-muted-foreground">
                Finding products matching <strong>{article.keyword}</strong> in <strong>{article.category}</strong>…
              </p>
            )}

            {/* Product cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {articleProducts.map((product) => (
                <Card key={product.id || product.handle} className="border-border/50">
                  <CardContent className="flex gap-3 p-3">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="h-16 w-16 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted shrink-0">
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <h4 className="text-sm font-medium leading-tight truncate">{product.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-xs font-semibold text-primary">${product.price}</span>
                        <div className="flex gap-1">
                          {product.url && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" asChild>
                              <a href={product.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => removeProduct(product.id || product.handle)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {articleProducts.length === 0 && (
                <div className="col-span-2 py-10 text-center text-muted-foreground space-y-2">
                  <ShoppingBag className="h-8 w-8 mx-auto opacity-30" />
                  <p className="text-sm">No products on this article yet.</p>
                  <p className="text-xs">Use <strong>Auto-select</strong> to find relevant products, or <strong>Browse catalog</strong> to pick manually.</p>
                </div>
              )}
            </div>

            {/* Product Picker Dialog */}
            <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Browse product catalog</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="relative">
                    <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pickerSelectedIds.size} selected
                  </p>
                  <ScrollArea className="h-80 rounded-lg border border-border/50">
                    {pickerLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {filteredPickerProducts.map(p => {
                          const key = p.id || p.handle
                          const selected = pickerSelectedIds.has(key)
                          return (
                            <button
                              key={key}
                              onClick={() => togglePickerProduct(p)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 ${selected ? 'bg-primary/5' : ''}`}
                            >
                              <div className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors ${selected ? 'bg-primary border-primary' : 'border-border'}`}>
                                {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                              </div>
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.title} className="h-9 w-9 rounded object-cover shrink-0" />
                              ) : (
                                <div className="h-9 w-9 rounded bg-muted shrink-0 flex items-center justify-center">
                                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{p.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {p.price ? `$${p.price}` : ''}
                                  {p.price && p.category ? ' · ' : ''}
                                  {(p.category || '').replace(/-/g, ' ')}
                                </p>
                              </div>
                            </button>
                          )
                        })}
                        {filteredPickerProducts.length === 0 && (
                          <p className="py-8 text-center text-sm text-muted-foreground">No products found</p>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setShowProductPicker(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={confirmPickerSelection}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add {pickerSelectedIds.size > 0 ? `${pickerSelectedIds.size} ` : ''}products
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
