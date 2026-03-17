'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { 
  Pencil, 
  Loader2, 
  Check, 
  X, 
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface Section {
  id: string
  type: string
  label: string
  html: string
  startIndex: number
  endIndex: number
}

interface SectionEditorProps {
  htmlContent: string
  onContentUpdate: (newHtml: string) => void
  articleTitle?: string
  articleKeyword?: string
}

// Parse HTML into editable sections
function parseHtmlSections(html: string): Section[] {
  const sections: Section[] = []
  
  // Define section patterns to identify
  const sectionPatterns = [
    { regex: /<section[^>]*class="[^"]*nn-section[^"]*overview[^"]*"[^>]*>[\s\S]*?<\/section>/gi, type: 'overview', label: 'Overview' },
    { regex: /<div[^>]*class="[^"]*nn-takeaways[^"]*"[^>]*>[\s\S]*?<\/div>/gi, type: 'takeaways', label: 'Key Takeaways' },
    { regex: /<section[^>]*class="[^"]*nn-section[^"]*"[^>]*id="[^"]*"[^>]*>[\s\S]*?<\/section>/gi, type: 'content', label: 'Content Section' },
    { regex: /<div[^>]*class="[^"]*nn-faq[^"]*"[^>]*>[\s\S]*?<\/div>(?=\s*<(?:section|div|script|$))/gi, type: 'faq', label: 'FAQ Section' },
    { regex: /<div[^>]*class="[^"]*nn-product-grid[^"]*"[^>]*>[\s\S]*?<\/div>(?=\s*<(?:section|div|$))/gi, type: 'products', label: 'Featured Products' },
  ]

  let sectionIndex = 0
  
  for (const pattern of sectionPatterns) {
    const regex = new RegExp(pattern.regex.source, 'gi')
    let match
    
    while ((match = regex.exec(html)) !== null) {
      // Extract section title if available
      const h2Match = match[0].match(/<h2[^>]*>(.*?)<\/h2>/i)
      const label = h2Match ? h2Match[1].replace(/<[^>]*>/g, '').trim() : pattern.label
      
      sections.push({
        id: `section-${sectionIndex++}`,
        type: pattern.type,
        label: label || pattern.label,
        html: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      })
    }
  }

  // Sort by position in document
  sections.sort((a, b) => a.startIndex - b.startIndex)
  
  return sections
}

export function SectionEditor({ htmlContent, onContentUpdate, articleTitle, articleKeyword }: SectionEditorProps) {
  const [sections, setSections] = useState<Section[]>(() => parseHtmlSections(htmlContent))
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [editInstructions, setEditInstructions] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const handleEditRequest = async () => {
    if (!editingSection || !editInstructions.trim()) return

    setIsEditing(true)
    setPreviewHtml(null)

    try {
      const response = await fetch('/api/articles/edit-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionHtml: editingSection.html,
          sectionType: editingSection.type,
          editInstructions: editInstructions,
          articleContext: `Title: ${articleTitle || 'Unknown'}, Keyword: ${articleKeyword || 'Unknown'}`,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to edit section')
      }

      const data = await response.json()
      setPreviewHtml(data.revisedHtml)
    } catch (error) {
      console.error('Edit error:', error)
      alert(error instanceof Error ? error.message : 'Failed to edit section')
    } finally {
      setIsEditing(false)
    }
  }

  const handleAcceptEdit = () => {
    if (!editingSection || !previewHtml) return

    // Replace the section in the full HTML
    const newHtml = 
      htmlContent.substring(0, editingSection.startIndex) +
      previewHtml +
      htmlContent.substring(editingSection.endIndex)

    onContentUpdate(newHtml)
    
    // Re-parse sections with new content
    setSections(parseHtmlSections(newHtml))
    
    // Reset state
    setEditingSection(null)
    setEditInstructions('')
    setPreviewHtml(null)
    setDialogOpen(false)
  }

  const handleRejectEdit = () => {
    setPreviewHtml(null)
  }

  const openEditDialog = (section: Section) => {
    setEditingSection(section)
    setEditInstructions('')
    setPreviewHtml(null)
    setDialogOpen(true)
  }

  const sectionTypeColors: Record<string, string> = {
    overview: 'bg-blue-100 text-blue-800',
    takeaways: 'bg-green-100 text-green-800',
    content: 'bg-gray-100 text-gray-800',
    faq: 'bg-purple-100 text-purple-800',
    products: 'bg-amber-100 text-amber-800',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Section Editor
        </CardTitle>
        <CardDescription>
          Click on any section to request AI-powered edits
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-2">
            {sections.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No editable sections found. Generate an article first.
              </p>
            ) : (
              sections.map((section) => (
                <div
                  key={section.id}
                  className="border rounded-lg overflow-hidden"
                >
                  <div 
                    className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => toggleSection(section.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={sectionTypeColors[section.type] || 'bg-gray-100 text-gray-800'}>
                        {section.type}
                      </Badge>
                      <span className="font-medium text-sm">{section.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditDialog(section)
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {expandedSections.has(section.id) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  {expandedSections.has(section.id) && (
                    <div className="p-3 border-t bg-background">
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground max-h-48 overflow-y-auto">
                        {section.html.substring(0, 500)}
                        {section.html.length > 500 && '...'}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                Edit: {editingSection?.label}
              </DialogTitle>
              <DialogDescription>
                Describe what changes you want to make to this section
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Current Content Preview */}
              <div>
                <label className="text-sm font-medium mb-2 block">Current Content</label>
                <ScrollArea className="h-32 rounded-md border p-3 bg-muted/30">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: editingSection?.html || '' }}
                  />
                </ScrollArea>
              </div>

              {/* Edit Instructions */}
              <div>
                <label className="text-sm font-medium mb-2 block">Edit Instructions</label>
                <Textarea
                  placeholder="Describe the changes you want... e.g., 'Make this more concise', 'Add more scientific evidence', 'Change the tone to be more casual', 'Add a bullet point about temperature ranges'"
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  rows={3}
                  disabled={isEditing}
                />
              </div>

              {/* Generate Button */}
              {!previewHtml && (
                <Button 
                  onClick={handleEditRequest} 
                  disabled={isEditing || !editInstructions.trim()}
                  className="w-full"
                >
                  {isEditing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Edit...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Edit
                    </>
                  )}
                </Button>
              )}

              {/* Preview */}
              {previewHtml && (
                <div className="space-y-3">
                  <label className="text-sm font-medium block">Revised Content</label>
                  <ScrollArea className="h-48 rounded-md border p-3 bg-green-50/50">
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </ScrollArea>
                  
                  <div className="flex gap-2">
                    <Button onClick={handleAcceptEdit} className="flex-1">
                      <Check className="h-4 w-4 mr-2" />
                      Accept Changes
                    </Button>
                    <Button variant="outline" onClick={handleRejectEdit}>
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button variant="ghost" onClick={handleEditRequest} disabled={isEditing}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Regenerate
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
