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
  } from 'lucide-react'
import type { GeneratedArticle } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'

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

  const publishToShopify = async () => {
    setIsPublishing(true)
    setPublishStatus('idle')
    setPublishResult(null)

    try {
      const tags = article.category || article.shopifyBlogTag || ''

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
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Featured Image (Shopify)</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">1200 x 600</span>
                  </div>
                  <div className="mb-2 flex gap-2">
                    <Input
                      placeholder="Paste featured image URL here..."
                      value={featuredImageInput}
                      onChange={(e) => setFeaturedImageInput(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFeaturedImageUrl(featuredImageInput)}
                    >
                      Set
                    </Button>
                    {featuredImageUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          setFeaturedImageUrl('')
                          setFeaturedImageInput('')
                          onContentUpdate?.(article.htmlContent || '', { featuredImage: undefined })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {featuredImageUrl ? (
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
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30" style={{ aspectRatio: '2/1' }}>
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="mx-auto mb-2 h-8 w-8" />
                        <p className="text-sm font-medium">No featured image set</p>
                        <p className="text-xs">Paste a URL above (1200 x 600 recommended)</p>
                      </div>
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
          <TabsContent value="products" className="mt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              {(article.products || []).map((product) => (
                <Card key={product.id} className="border-border/50">
                  <CardContent className="flex gap-4 p-4">
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl || "/placeholder.svg"}
                        alt={product.title}
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 space-y-1">
                      <h4 className="font-medium leading-tight">{product.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary">{product.price}</span>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={product.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1 h-3 w-3" />
                            View
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!article.products || article.products.length === 0) && (
                <p className="col-span-2 py-8 text-center text-muted-foreground">
                  No products recommended for this article.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
