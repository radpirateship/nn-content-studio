'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Save, 
  X, 
  Eye, 
  Code,
  RefreshCw,
  Loader2
} from 'lucide-react'
import type { GeneratedArticle } from '@/lib/types'

interface ArticleEditorProps {
  article: GeneratedArticle
  onSave: (article: GeneratedArticle) => void
  onCancel: () => void
  onRegenerate?: (section: string) => Promise<void>
}

export function ArticleEditor({ article, onSave, onCancel, onRegenerate }: ArticleEditorProps) {
  const [editedArticle, setEditedArticle] = useState<GeneratedArticle>({ ...article })
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('content')

  const handleSave = () => {
    // Recalculate word count
    const textContent = editedArticle.htmlContent.replace(/<[^>]*>/g, ' ')
    const wordCount = textContent.split(/\s+/).filter(Boolean).length
    
    onSave({
      ...editedArticle,
      wordCount,
    })
  }

  const handleRegenerate = async (section: string) => {
    if (!onRegenerate) return
    setIsRegenerating(true)
    try {
      await onRegenerate(section)
    } finally {
      setIsRegenerating(false)
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-xl">Edit Article</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="mr-1.5 h-4 w-4" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="mr-1.5 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="meta">SEO & Meta</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={editedArticle.title}
                onChange={(e) => setEditedArticle(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">HTML Content</Label>
                {onRegenerate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerate('content')}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                    )}
                    Regenerate
                  </Button>
                )}
              </div>
              <Textarea
                id="content"
                value={editedArticle.htmlContent}
                onChange={(e) => setEditedArticle(prev => ({ ...prev, htmlContent: e.target.value }))}
                className="min-h-[400px] font-mono text-sm"
              />
            </div>
          </TabsContent>

          {/* Meta Tab */}
          <TabsContent value="meta" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="metaDesc">Meta Description</Label>
              <Textarea
                id="metaDesc"
                value={editedArticle.metaDescription}
                onChange={(e) => setEditedArticle(prev => ({ ...prev, metaDescription: e.target.value }))}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                {editedArticle.metaDescription.length} / 160 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={editedArticle.slug}
                onChange={(e) => setEditedArticle(prev => ({ ...prev, slug: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keyword">Target Keyword</Label>
              <Input
                id="keyword"
                value={editedArticle.keyword}
                onChange={(e) => setEditedArticle(prev => ({ ...prev, keyword: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schema">Schema Markup (JSON-LD)</Label>
              <Textarea
                id="schema"
                value={editedArticle.schemaMarkup}
                onChange={(e) => setEditedArticle(prev => ({ ...prev, schemaMarkup: e.target.value }))}
                className="min-h-[200px] font-mono text-xs"
              />
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview">
            <ScrollArea className="h-[500px] rounded-lg border border-border/50 bg-background">
              <div className="p-6">
                <h1 className="mb-4 text-3xl font-bold">{editedArticle.title}</h1>
                <article 
                  className="prose prose-neutral max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: editedArticle.htmlContent }}
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
