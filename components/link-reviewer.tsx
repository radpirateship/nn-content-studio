'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  Check,
  X,
  Pencil,
  Loader2,
  Link2,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react'
import type { LinkSuggestion, GeneratedArticle } from '@/lib/types'

interface LinkReviewerProps {
  article: GeneratedArticle
  internalLinks: { title: string; url: string; description?: string }[]
  collectionsLinks: { title: string; url: string }[]
  onApplyLinks: (enrichedHtml: string, linkCount: number) => void
  onNext: () => void
  onBack: () => void
}

export function LinkReviewer({
  article,
  internalLinks,
  collectionsLinks,
  onApplyLinks,
  onNext,
  onBack,
}: LinkReviewerProps) {
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [appliedCount, setAppliedCount] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const totalAvailableLinks = internalLinks.length + collectionsLinks.length

  const handleBack = () => {
    const unapplied = suggestions.filter(s => s.status === 'approved')
    if (unapplied.length > 0 && appliedCount === null) {
      if (!confirm(`You have ${unapplied.length} approved links that haven't been applied yet. Go back anyway?`)) {
        return
      }
    }
    onBack()
  }

  const handleScan = async () => {
    setIsScanning(true)
    setScanError(null)
    setSuggestions([])

    try {
      const response = await fetch('/api/articles/scan-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent: article.htmlContent,
          internalLinks,
          collectionsLinks,
          articleTitle: article.title,
          articleKeyword: article.keyword,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to scan')

      setSuggestions(data.suggestions || [])
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Scan failed')
    } finally {
      setIsScanning(false)
    }
  }

  const handleApprove = (id: string) => {
    setSuggestions(prev =>
      prev.map(s => (s.id === id ? { ...s, status: 'approved' as const } : s))
    )
  }

  const handleReject = (id: string) => {
    setSuggestions(prev =>
      prev.map(s => (s.id === id ? { ...s, status: 'rejected' as const } : s))
    )
  }

  const handleEditSave = (id: string, editedAnchor: string, editedUrl: string) => {
    setSuggestions(prev =>
      prev.map(s =>
        s.id === id ? { ...s, editedAnchor, editedUrl, status: 'approved' as const } : s
      )
    )
    setEditingId(null)
  }

  const approvedLinks = suggestions.filter(s => s.status === 'approved')
  const pendingLinks = suggestions.filter(s => s.status === 'pending')
  const rejectedLinks = suggestions.filter(s => s.status === 'rejected')

  const handleApplyApproved = async () => {
    if (approvedLinks.length === 0) return
    setIsApplying(true)

    try {
      const response = await fetch('/api/articles/apply-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.dbId,
          htmlContent: article.htmlContent,
          approvedLinks,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to apply links')

      setAppliedCount(data.linkCount)
      onApplyLinks(data.htmlContent, data.linkCount)
    } catch (error) {
      console.error('Failed to apply links:', error)
    } finally {
      setIsApplying(false)
    }
  }

  const approveAll = () => {
    setSuggestions(prev => prev.map(s => (s.status === 'pending' ? { ...s, status: 'approved' as const } : s)))
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
      {/* Header */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Search className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 2: Internal Linking</CardTitle>
                <CardDescription>
                  The SEO Strategist analyzes your draft and recommends link placements
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleBack}>
                Back to Editor
              </Button>
              <Button size="sm" onClick={onNext} className="gap-1.5">
                Continue to Visuals
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Scan Button + Status */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {totalAvailableLinks > 0
                  ? `${totalAvailableLinks} URLs available (${internalLinks.length} topical authority + ${collectionsLinks.length} collections)`
                  : 'No internal URLs available. Upload your Topical Authority Map in Resources first.'}
              </p>
              {suggestions.length > 0 && (
                <div className="flex gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    {approvedLinks.length} approved
                  </Badge>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                    {pendingLinks.length} pending
                  </Badge>
                  {rejectedLinks.length > 0 && (
                    <Badge variant="secondary" className="bg-red-100 text-red-700">
                      {rejectedLinks.length} rejected
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {suggestions.length > 0 && pendingLinks.length > 0 && (
                <Button variant="outline" size="sm" onClick={approveAll}>
                  <Check className="mr-1.5 h-4 w-4" />
                  Approve All
                </Button>
              )}
              <Button
                onClick={handleScan}
                disabled={isScanning || totalAvailableLinks === 0}
                className="gap-1.5"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : suggestions.length > 0 ? (
                  <>
                    <Search className="h-4 w-4" />
                    Re-Scan
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Scan for Link Opportunities
                  </>
                )}
              </Button>
            </div>
          </div>

          {scanError && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{scanError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Link Suggestions</CardTitle>
            <CardDescription>Review each suggestion. Approve, edit, or reject before applying.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    isEditing={editingId === suggestion.id}
                    onApprove={() => handleApprove(suggestion.id)}
                    onReject={() => handleReject(suggestion.id)}
                    onStartEdit={() => setEditingId(suggestion.id)}
                    onSaveEdit={(anchor, url) => handleEditSave(suggestion.id, anchor, url)}
                    onCancelEdit={() => setEditingId(null)}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {suggestions.length === 0 && !isScanning && !scanError && (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No scan results yet</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Click &ldquo;Scan for Link Opportunities&rdquo; to analyze your article
            </p>
          </CardContent>
        </Card>
      )}
        </div>{/* end space-y-6 */}
      </div>{/* end scrollable area */}

      {/* ── Sticky Footer: Apply Links / Success ── */}
      {approvedLinks.length > 0 && appliedCount === null && (
        <div className="flex-shrink-0 border-t bg-green-50/80 px-6 py-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-green-800">
                {approvedLinks.length} link{approvedLinks.length > 1 ? 's' : ''} approved and ready to insert
              </p>
              <p className="text-xs text-green-700/70">
                Links will be injected into the article HTML as anchor tags
              </p>
            </div>
            <Button
              onClick={handleApplyApproved}
              disabled={isApplying}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {isApplying ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Link2 className="mr-1.5 h-4 w-4" />
                  Apply {approvedLinks.length} Links
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {appliedCount !== null && (
        <div className="flex-shrink-0 border-t bg-green-50 px-6 py-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {appliedCount} internal link{appliedCount > 1 ? 's' : ''} successfully inserted
                </p>
                <p className="text-xs text-green-700/70">
                  Links are now embedded in your article HTML
                </p>
              </div>
            </div>
            <Button size="sm" onClick={onNext} className="gap-1.5">
              Continue to Visuals
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Individual Suggestion Card ---
function SuggestionCard({
  suggestion,
  isEditing,
  onApprove,
  onReject,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: {
  suggestion: LinkSuggestion
  isEditing: boolean
  onApprove: () => void
  onReject: () => void
  onStartEdit: () => void
  onSaveEdit: (anchor: string, url: string) => void
  onCancelEdit: () => void
}) {
  const [editAnchor, setEditAnchor] = useState(suggestion.editedAnchor || suggestion.anchorText)
  const [editUrl, setEditUrl] = useState(suggestion.editedUrl || suggestion.targetUrl)

  const borderColor =
    suggestion.status === 'approved'
      ? 'border-green-200 bg-green-50/50'
      : suggestion.status === 'rejected'
        ? 'border-red-200 bg-red-50/30 opacity-60'
        : 'border-border/50'

  if (isEditing) {
    return (
      <div className="rounded-lg border-2 border-blue-300 bg-blue-50/30 p-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Anchor Text</label>
            <Input
              value={editAnchor}
              onChange={(e) => setEditAnchor(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Target URL</label>
            <Input
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancelEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => onSaveEdit(editAnchor, editUrl)}>
              Save & Approve
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border p-4 transition-colors ${borderColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          {/* Anchor + URL */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              &ldquo;{suggestion.editedAnchor || suggestion.anchorText}&rdquo;
            </Badge>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <a
              href={suggestion.editedUrl || suggestion.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              {suggestion.targetTitle || suggestion.targetUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Rationale */}
          <p className="text-xs leading-relaxed text-muted-foreground">{suggestion.rationale}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex shrink-0 gap-1">
          {suggestion.status === 'pending' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                onClick={onApprove}
                title="Approve"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                onClick={onStartEdit}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={onReject}
                title="Reject"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
          {suggestion.status === 'approved' && (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              <Check className="mr-1 h-3 w-3" />
              Approved
            </Badge>
          )}
          {suggestion.status === 'rejected' && (
            <Badge variant="secondary" className="bg-red-100 text-red-600">
              <X className="mr-1 h-3 w-3" />
              Rejected
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
