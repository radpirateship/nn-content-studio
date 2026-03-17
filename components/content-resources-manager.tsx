'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Upload, 
  Search, 
  Link2, 
  FolderOpen,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Tag,
  Trash2,
  BarChart3,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORY_LABELS } from '@/lib/types'

interface TopicalAuthority {
  id: string
  type: string
  title: string
  primaryKeyword: string
  intent: string
  format: string
  wordCount: number
  priority: string
  action: string
  existingUrl: string
  optimize: boolean
  notes: string
  searchVolume: string
  titleTag: string
  metaDescription: string
  collectionSlug?: string
}

interface Collection {
  id: string
  url: string
  category: string
  primaryKeyword: string
  searchVolume: string
  keywordDifficulty: string
  secondaryKeywords: string[]
  optimizedTitleTag: string
  optimizedMetaDescription: string
  currentPosition: string
  currentImpressions: string
  priority: string
  estimatedImpact: string
  optimizedEC: boolean
  collectionSlug?: string
}

interface ResourceSummary {
  [slug: string]: {
    topicalAuthority: number
    collections: number
    products: number
  }
}

interface ContentResourcesManagerProps {
  onTopicalAuthorityLoaded?: (count: number) => void
  onCollectionsLoaded?: (count: number) => void
}

export function ContentResourcesManager({ 
  onTopicalAuthorityLoaded, 
  onCollectionsLoaded 
}: ContentResourcesManagerProps) {
  // Dynamic collections from registry (hardcoded + custom)
  const [allCollections, setAllCollections] = useState<{ slug: string; label: string; is_builtin: boolean }[]>([])

  // Collection selection
  const [selectedCollection, setSelectedCollection] = useState<string>('')
  const [summary, setSummary] = useState<ResourceSummary>({})
  const [summaryLoading, setSummaryLoading] = useState(true)

  // Add Collection dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [addingCollection, setAddingCollection] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Topical Authority state
  const [topicalAuthority, setTopicalAuthority] = useState<TopicalAuthority[]>([])
  const [taLoading, setTaLoading] = useState(false)
  const [taError, setTaError] = useState<string | null>(null)
  const [taDragging, setTaDragging] = useState(false)
  const [taSearchTerm, setTaSearchTerm] = useState('')
  const [taFileName, setTaFileName] = useState<string | null>(null)

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([])
  const [colLoading, setColLoading] = useState(false)
  const [colError, setColError] = useState<string | null>(null)
  const [colDragging, setColDragging] = useState(false)
  const [colSearchTerm, setColSearchTerm] = useState('')
  const [colFileName, setColFileName] = useState<string | null>(null)

  // Status
  const [taStatusLoading, setTaStatusLoading] = useState(false)
  const [colStatusLoading, setColStatusLoading] = useState(false)

  // Fetch registry + summary on mount
  useEffect(() => {
    fetchRegistry()
    fetchSummary()
  }, [])

  async function fetchRegistry() {
    try {
      const res = await fetch('/api/collections/registry')
      if (res.ok) {
        const data = await res.json()
        setAllCollections(data.collections || [])
      }
    } catch (error) {
      console.error('Failed to fetch collections registry:', error)
      // Fallback to hardcoded
      setAllCollections(
        Object.entries(CATEGORY_LABELS).map(([slug, label]) => ({ slug, label, is_builtin: true }))
      )
    }
  }

  async function handleAddCollection() {
    if (!newCollectionName.trim()) return
    setAddingCollection(true)
    setAddError(null)
    try {
      const res = await fetch('/api/collections/registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        setAddError(err.error || 'Failed to create collection')
        return
      }
      const created = await res.json()
      setAllCollections(prev => [...prev, { slug: created.slug, label: created.label, is_builtin: false }])
      setNewCollectionName('')
      setAddDialogOpen(false)
      setSelectedCollection(created.slug)
      // Refresh summary to include the new (empty) collection
      fetchSummary()
    } catch (error) {
      setAddError('Network error creating collection')
    } finally {
      setAddingCollection(false)
    }
  }

  // Fetch collection-specific data when collection changes
  useEffect(() => {
    if (selectedCollection) {
      fetchCollectionData(selectedCollection)
    } else {
      setTopicalAuthority([])
      setCollections([])
    }
  }, [selectedCollection])

  async function fetchSummary() {
    setSummaryLoading(true)
    try {
      const response = await fetch('/api/resources?type=summary')
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error)
    }
    setSummaryLoading(false)
  }

  async function fetchCollectionData(slug: string) {
    setTaStatusLoading(true)
    setColStatusLoading(true)
    try {
      const [taRes, colRes] = await Promise.all([
        fetch(`/api/resources?type=topical-authority&collection=${slug}`),
        fetch(`/api/resources?type=collections&collection=${slug}`),
      ])
      if (taRes.ok) {
        const taData = await taRes.json()
        setTopicalAuthority(taData.items || [])
        onTopicalAuthorityLoaded?.(taData.count || 0)
      }
      if (colRes.ok) {
        const colData = await colRes.json()
        setCollections(colData.items || [])
        onCollectionsLoaded?.(colData.count || 0)
      }
    } catch (error) {
      console.error('Failed to fetch collection data:', error)
    }
    setTaStatusLoading(false)
    setColStatusLoading(false)
  }

  // Upload Topical Authority CSV
  const handleTAUpload = useCallback(async (file: File) => {
    if (!selectedCollection) {
      setTaError('Please select a collection first')
      return
    }
    setTaLoading(true)
    setTaError(null)
    setTaFileName(file.name)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'topical-authority')
      formData.append('collection_slug', selectedCollection)

      const response = await fetch('/api/resources', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      
      setTopicalAuthority(data.items || [])
      onTopicalAuthorityLoaded?.(data.count || 0)
      // Refresh summary
      fetchSummary()
    } catch (error) {
      setTaError(error instanceof Error ? error.message : 'Upload failed')
    }
    setTaLoading(false)
  }, [selectedCollection, onTopicalAuthorityLoaded])

  // Upload Collections CSV
  const handleColUpload = useCallback(async (file: File) => {
    setColLoading(true)
    setColError(null)
    setColFileName(file.name)
    try {
      // Parse the simple collection,url CSV
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) throw new Error('CSV must have a header row and at least one collection')

      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
      const colIdx = headers.findIndex(h => h === 'collection' || h === 'name' || h === 'label')
      const urlIdx = headers.findIndex(h => h === 'url' || h === 'link' || h === 'href')
      if (colIdx === -1) throw new Error('CSV must have a "collection" column')

      const parsed: { label: string; slug: string; url: string }[] = []
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''))
        const label = parts[colIdx]
        const url = urlIdx !== -1 ? parts[urlIdx] : ''
        if (!label) continue
        // Derive slug from URL if available, otherwise from label
        const slug = url
          ? url.replace(/^.*\/collections\//, '').replace(/\/$/, '').toLowerCase()
          : label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        parsed.push({ label, slug, url })
      }
      if (parsed.length === 0) throw new Error('No collections found in CSV')

      // Upsert into collections_registry via migrate endpoint logic
      const response = await fetch('/api/collections/registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collections: parsed }),
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)

      // Refresh dropdown
      const regRes = await fetch('/api/collections/registry')
      if (regRes.ok) {
        const regData = await regRes.json()
        if (regData.collections) setAllCollections(regData.collections)
      }
      setCollections(parsed.map((c, i) => ({ id: `col-${i}`, primaryKeyword: c.label, url: c.url, category: c.slug })))
      onCollectionsLoaded?.(parsed.length)
      fetchSummary()
    } catch (error) {
      setColError(error instanceof Error ? error.message : 'Upload failed')
    }
    setColLoading(false)
  }, [onCollectionsLoaded, fetchSummary])

  // Helper: get label from slug
  const getLabel = (slug: string) => allCollections.find(c => c.slug === slug)?.label || (CATEGORY_LABELS as Record<string, string>)[slug] || slug

  // Delete handlers - scoped to collection
  const handleDeleteTA = useCallback(async () => {
    if (!selectedCollection) return
    if (!confirm(`Clear all topical authority data for ${getLabel(selectedCollection)}?`)) return
    try {
      await fetch(`/api/resources?type=topical-authority&collection=${selectedCollection}`, { method: 'DELETE' })
      setTopicalAuthority([])
      onTopicalAuthorityLoaded?.(0)
      fetchSummary()
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }, [selectedCollection, onTopicalAuthorityLoaded])

  const handleDeleteCol = useCallback(async () => {
    if (!selectedCollection) return
    if (!confirm(`Clear all collection data for ${getLabel(selectedCollection)}?`)) return
    try {
      await fetch(`/api/resources?type=collections&collection=${selectedCollection}`, { method: 'DELETE' })
      setCollections([])
      onCollectionsLoaded?.(0)
      fetchSummary()
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }, [selectedCollection, onCollectionsLoaded])

  // Drag and drop handlers
  const handleTADrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setTaDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt'))) {
      handleTAUpload(file)
    } else {
      setTaError('Please upload a CSV, TSV, or TXT file')
    }
  }, [handleTAUpload])

  const handleTADragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setTaDragging(true)
  }, [])

  const handleTADragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setTaDragging(false)
  }, [])

  const handleColDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setColDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt'))) {
      handleColUpload(file)
    } else {
      setColError('Please upload a CSV, TSV, or TXT file')
    }
  }, [handleColUpload])

  const handleColDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setColDragging(true)
  }, [])

  const handleColDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setColDragging(false)
  }, [])

  // Filter items by search
  const filteredTA = topicalAuthority.filter(item => {
    if (!taSearchTerm) return true
    const search = taSearchTerm.toLowerCase()
    return item.title.toLowerCase().includes(search) || 
           item.primaryKeyword.toLowerCase().includes(search) ||
           item.type.toLowerCase().includes(search)
  })

  const filteredCol = collections.filter(item => {
    if (!colSearchTerm) return true
    const search = colSearchTerm.toLowerCase()
    return item.url.toLowerCase().includes(search) || 
           item.primaryKeyword.toLowerCase().includes(search) ||
           item.category.toLowerCase().includes(search)
  })

  return (
    <div className="space-y-6">
      {/* Collection Selector + Summary Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Collection Resources
          </CardTitle>
          <CardDescription>
            Select a collection to manage its topical authority articles and collection metadata.
            Resources are scoped per collection to ensure correct internal linking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Collection Picker + Add Button */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium whitespace-nowrap">Active Collection:</label>
            <Select value={selectedCollection} onValueChange={setSelectedCollection}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a collection..." />
              </SelectTrigger>
              <SelectContent>
                {allCollections.map((col) => (
                  <SelectItem key={col.slug} value={col.slug}>
                    <span className="flex items-center gap-2">
                      {col.label}
                      {!col.is_builtin && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">Custom</Badge>
                      )}
                      {summary[col.slug] && (summary[col.slug].topicalAuthority > 0 || summary[col.slug].products > 0) && (
                        <Badge variant="secondary" className="text-xs ml-1">
                          {summary[col.slug].topicalAuthority} TA
                          {summary[col.slug].products > 0 && ` · ${summary[col.slug].products} P`}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) { setAddError(null); setNewCollectionName('') } }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Collection
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Add New Collection</DialogTitle>
                  <DialogDescription>
                    Create a new product collection for organizing resources and generating content.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Collection Name</label>
                    <Input
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="e.g. PEMF Therapy Devices"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCollection()}
                    />
                  </div>
                  {newCollectionName.trim() && (
                    <p className="text-xs text-muted-foreground">
                      Slug: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                        {newCollectionName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
                      </code>
                    </p>
                  )}
                  {addError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {addError}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddCollection} disabled={addingCollection || !newCollectionName.trim()}>
                    {addingCollection ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Creating...</> : 'Create Collection'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Summary Grid */}
          {!summaryLoading && (
            <div className="flex flex-wrap gap-2">
              {allCollections.map((col) => {
                const s = summary[col.slug] || { topicalAuthority: 0, collections: 0, products: 0 }
                const hasData = s.topicalAuthority > 0 || s.collections > 0 || s.products > 0
                return (
                  <button
                    key={col.slug}
                    onClick={() => setSelectedCollection(col.slug)}
                    className={cn(
                      "p-2 rounded-md border text-xs text-center transition-colors cursor-pointer min-w-[90px]",
                      selectedCollection === col.slug 
                        ? "border-primary bg-primary/10 font-medium" 
                        : hasData 
                          ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10" 
                          : "border-muted hover:bg-muted/50"
                    )}
                  >
                    <div className="font-medium truncate">{col.label.split(' ')[0]}</div>
                    {hasData ? (
                      <div className="text-muted-foreground mt-0.5">
                        {s.topicalAuthority > 0 && <span>{s.topicalAuthority} TA</span>}
                        {s.products > 0 && <span className="ml-1">{s.products} P</span>}
                      </div>
                    ) : (
                      <div className="text-muted-foreground mt-0.5">{'—'}</div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload / View Tabs - only show when collection selected */}
      {selectedCollection && (
        <Tabs defaultValue="topical-authority" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="topical-authority" className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Topical Authority
              {topicalAuthority.length > 0 && (
                <Badge variant="secondary" className="ml-1">{topicalAuthority.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="collections" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Collections
              {collections.length > 0 && (
                <Badge variant="secondary" className="ml-1">{collections.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Topical Authority Tab */}
          <TabsContent value="topical-authority" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Topical Authority — {getLabel(selectedCollection)}
                    </CardTitle>
                    <CardDescription>
                      Upload a CSV with your topical authority map for this collection
                    </CardDescription>
                  </div>
                  {topicalAuthority.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleDeleteTA} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Upload area */}
                <div
                  onDrop={handleTADrop}
                  onDragOver={handleTADragOver}
                  onDragLeave={handleTADragLeave}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                    taDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  )}
                >
                  {taLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing {taFileName}...</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Drag & drop CSV file here or click to browse
                      </p>
                      <Input
                        type="file"
                        accept=".csv,.tsv,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleTAUpload(file)
                        }}
                        className="max-w-xs mx-auto"
                      />
                    </>
                  )}
                </div>

                {taError && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {taError}
                  </div>
                )}

                {taStatusLoading && topicalAuthority.length === 0 && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading existing data...
                  </div>
                )}

                {/* Results */}
                {topicalAuthority.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">{topicalAuthority.length} articles loaded</span>
                        {taFileName && <span className="text-xs text-muted-foreground">from {taFileName}</span>}
                      </div>
                      <div className="relative w-48">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={taSearchTerm}
                          onChange={(e) => setTaSearchTerm(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[300px] rounded-md border">
                      <div className="p-2 space-y-1">
                        {filteredTA.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{item.title}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                <Tag className="w-3 h-3" />
                                {item.primaryKeyword || 'No keyword'}
                                {item.searchVolume && <span>{'· Vol: '}{item.searchVolume}</span>}
                                {item.priority && <Badge variant="outline" className="text-[10px] px-1">{item.priority}</Badge>}
                              </div>
                            </div>
                            {item.existingUrl && (
                              <a href={item.existingUrl} target="_blank" rel="noopener noreferrer" 
                                 className="ml-2 text-muted-foreground hover:text-primary">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collections Tab */}
          <TabsContent value="collections" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Collections List
                    </CardTitle>
                    <CardDescription>
                      Upload your <strong>NN_COLLECTION_DATABASE_MATCH.csv</strong> to define collections and populate all dropdowns. Format: <code>collection,url</code>
                    </CardDescription>
                  </div>
                  {collections.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleDeleteCol} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Upload area */}
                <div
                  onDrop={handleColDrop}
                  onDragOver={handleColDragOver}
                  onDragLeave={handleColDragLeave}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                    colDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  )}
                >
                  {colLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing {colFileName}...</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Drag & drop CSV file here or click to browse
                      </p>
                      <Input
                        type="file"
                        accept=".csv,.tsv,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleColUpload(file)
                        }}
                        className="max-w-xs mx-auto"
                      />
                    </>
                  )}
                </div>

                {colError && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {colError}
                  </div>
                )}

                {colStatusLoading && collections.length === 0 && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading existing data...
                  </div>
                )}

                {/* Results */}
                {collections.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">{collections.length} collections loaded</span>
                        {colFileName && <span className="text-xs text-muted-foreground">from {colFileName}</span>}
                      </div>
                      <div className="relative w-48">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={colSearchTerm}
                          onChange={(e) => setColSearchTerm(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[300px] rounded-md border">
                      <div className="p-2 space-y-1">
                        {filteredCol.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{item.primaryKeyword || item.category}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                {item.url && (
                                  <span className="truncate max-w-[200px]">{item.url.replace('https://nakednutrition.com', '')}</span>
                                )}
                                {item.searchVolume && <span>{'· Vol: '}{item.searchVolume}</span>}
                                {item.priority && <Badge variant="outline" className="text-[10px] px-1">{item.priority}</Badge>}
                              </div>
                            </div>
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noopener noreferrer"
                                 className="ml-2 text-muted-foreground hover:text-primary">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!selectedCollection && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Select a collection above to manage its resources</p>
            <p className="text-xs mt-1">Each collection has its own topical authority articles and collection metadata</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
