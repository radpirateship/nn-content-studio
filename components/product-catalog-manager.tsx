'use client'

import React from "react"

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Package,
  Check,
  X,
  FileSpreadsheet,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORY_LABELS } from '@/lib/types'

interface Product {
  id: string
  title: string
  description: string
  price: string
  imageUrl?: string
  category?: string
  productType?: string
  vendor?: string
  tags?: string
  handle?: string
  url?: string
  inventoryQty?: string
}

interface ProductCatalogManagerProps {
  onProductsLoaded?: (count: number) => void
}

export function ProductCatalogManager({ onProductsLoaded }: ProductCatalogManagerProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isDragging, setIsDragging] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [dbStatus, setDbStatus] = useState<{ count: number; lastUpdated?: string } | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)

  const handleClearProducts = async () => {
    if (!confirm('Remove all uploaded products? Articles will pull featured products directly from your Shopify store instead.')) return
    setIsClearing(true)
    try {
      const res = await fetch('/api/products', { method: 'DELETE' })
      if (res.ok) {
        setProducts([])
        setCategories([])
        setTotalCount(0)
        setDbStatus({ count: 0 })
        onProductsLoaded?.(0)
      }
    } catch {
      setError('Failed to clear products')
    } finally {
      setIsClearing(false)
    }
  }

  const loadAllProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products?limit=500')
      if (response.ok) {
        const data = await response.json()
        setDbStatus({ count: data.total || 0 })
        setTotalCount(data.total || 0)
        setProducts(data.products || [])
        setCategories(data.categories || [])
        if (data.total > 0) onProductsLoaded?.(data.total)
      }
    } catch {
      // ignore
    }
  }, [onProductsLoaded])

  // Fetch current database status on mount
  useEffect(() => {
    setStatusLoading(true)
    loadAllProducts().finally(() => setStatusLoading(false))
  }, [loadAllProducts])

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())
    return values
  }

  // Helper to look up header value case-insensitively
  const getHeaderValue = (row: Record<string, string>, possibleHeaders: string[]): string => {
    const lowerRow = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.toLowerCase(), v])
    )
    for (const header of possibleHeaders) {
      const value = lowerRow[header.toLowerCase()]
      if (value) return value
    }
    return ''
  }

  const handleFileUpload = async (file: File) => {
    setIsLoading(true)
    setError(null)

    try {
      // Parse CSV client-side to extract only needed columns (avoids body size limits)
      const text = await file.text()

      // Split CSV into logical rows, respecting multi-line quoted fields (e.g. Body HTML)
      const splitCSVRows = (csv: string): string[] => {
        const rows: string[] = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < csv.length; i++) {
          const char = csv[i]
          if (char === '"') {
            if (inQuotes && csv[i + 1] === '"') {
              current += '""'
              i++
            } else {
              inQuotes = !inQuotes
            }
            current += char
          } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && csv[i + 1] === '\n') i++ // skip \r\n
            if (current.trim()) rows.push(current)
            current = ''
          } else {
            current += char
          }
        }
        if (current.trim()) rows.push(current)
        return rows
      }

      const lines = splitCSVRows(text)
      if (lines.length < 2) throw new Error('CSV file is empty or invalid')

      const headers = parseCSVLine(lines[0])
      const parsedProducts: Array<Record<string, string>> = []
      const seenHandles = new Set<string>()

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const values = parseCSVLine(line)
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h.trim()] = values[idx]?.trim() || '' })

        // Support both Shopify and NN custom formats with case-insensitive headers
        const title = getHeaderValue(row, ['Title', 'title'])
        const handle = getHeaderValue(row, ['Handle', 'handle'])
        const description = getHeaderValue(row, ['Body (HTML)', 'Body HTML', 'description', 'Description'])
        const price = getHeaderValue(row, ['Variant Price', 'price', 'Price'])
        const compareAtPrice = getHeaderValue(row, ['Variant Compare At Price', 'compareAtPrice', 'Compare At Price'])
        const sku = getHeaderValue(row, ['Variant SKU', 'sku', 'SKU'])
        const vendor = getHeaderValue(row, ['Vendor', 'vendor'])
        const productType = getHeaderValue(row, ['Product Type', 'Type', 'productType', 'category', 'Category'])
        const tags = getHeaderValue(row, ['Tags', 'tags'])
        const imageUrl = getHeaderValue(row, ['Image Src', 'imageUrl', 'Image Url', 'image_url'])
        const productUrl = getHeaderValue(row, ['url', 'URL', 'product_url', 'Product URL'])
        const status = getHeaderValue(row, ['Status', 'status']) || 'active'
        const inventoryQty = getHeaderValue(row, ['Total Inventory Qty', 'Variant Inventory Qty', 'inventoryQty', 'inventory_qty'])

        // Skip variant rows (no title, same handle) and duplicates
        if (!title) continue
        if (seenHandles.has(handle)) continue
        seenHandles.add(handle)

        parsedProducts.push({
          id: getHeaderValue(row, ['ID', 'id']) || handle || `product-${i}`,
          title,
          handle,
          description: description.slice(0, 500),
          price,
          compareAtPrice,
          sku,
          vendor,
          productType,
          tags,
          category: productType,
          imageUrl,
          status,
          inventoryQty,
          url: productUrl,
        })
      }

      if (parsedProducts.length === 0) throw new Error('No products found in CSV. Check that it has a "Title" column.')

      // Send slim JSON payload instead of raw CSV
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: parsedProducts }),
      })

      if (!response.ok) {
        let errorMsg = 'Failed to upload products'
        try {
          const data = await response.json()
          errorMsg = data.error || errorMsg
        } catch {
          errorMsg = `Upload failed (${response.status})`
        }
        throw new Error(errorMsg)
      }

      const data = await response.json()
      setTotalCount(data.count || 0)
      setDbStatus({ count: data.count || 0 })
      onProductsLoaded?.(data.count)
      await loadAllProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
      handleFileUpload(file)
    } else {
      setError('Please upload a CSV or Excel file')
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      if (searchTerm) params.set('search', searchTerm)
      params.set('limit', '20')

      const response = await fetch(`/api/products?${params}`)
      const data = await response.json()
      setProducts(data.products || [])
      if (data.categories) setCategories(data.categories)
    } catch {
      setError('Failed to fetch products')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchTerm || 
      p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = selectedCategory === 'all' || 
      p.category?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      p.productType?.toLowerCase().includes(selectedCategory.toLowerCase())

    return matchesSearch && matchesCategory
  })

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
            <Package className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl">Product Catalog</CardTitle>
            <CardDescription>
              {statusLoading
                ? 'Checking database...'
                : totalCount > 0
                  ? `${totalCount.toLocaleString()} products in database (showing ${products.length})`
                  : 'No products in database — upload your product CSV'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Database Status Banner */}
        {!statusLoading && (
          <div className={cn(
            'flex items-center gap-2 rounded-lg p-3 text-sm',
            dbStatus && dbStatus.count > 0 
              ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20' 
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
          )}>
            {dbStatus && dbStatus.count > 0 ? (
              <>
                <Check className="h-4 w-4 shrink-0" />
                <span className="flex-1"><strong>{dbStatus.count} products</strong> from CSV upload - these override Shopify API</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearProducts}
                  disabled={isClearing}
                  className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {isClearing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                  Remove CSV
                </Button>
              </>
            ) : (
              <>
                <Check className="h-4 w-4 shrink-0" />
                <span><strong>Using Shopify API</strong> - products pulled directly from your store collections</span>
              </>
            )}
          </div>
        )}
        {statusLoading && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Checking database for saved products...</span>
          </div>
        )}

        {/* Upload Area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'relative rounded-lg border-2 border-dashed p-6 text-center transition-colors',
            isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-border/50 hover:border-primary/50',
            isLoading && 'pointer-events-none opacity-50'
          )}
        >
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileInput}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={isLoading}
          />
          <div className="flex flex-col items-center gap-2">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {isLoading ? 'Processing...' : 'Drop CSV file here or click to upload'}
              </p>
              <p className="text-sm text-muted-foreground">
                Upload your NN products CSV or Shopify export
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Search & Filter */}
        {products.length > 0 && (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat.toLowerCase()}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Result count */}
            <p className="text-xs text-muted-foreground px-0.5">
              {searchTerm || selectedCategory !== 'all'
                ? `Showing ${filteredProducts.length} of ${products.length} products`
                : `${products.length} products`}
            </p>

            {/* Product List */}
            <ScrollArea className="h-[520px] rounded-lg border border-border/50">
              <div className="divide-y divide-border/50">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="h-10 w-10 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {product.url ? (
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium truncate leading-tight hover:underline block"
                        >
                          {product.title}
                        </a>
                      ) : (
                        <p className="text-sm font-medium truncate leading-tight">{product.title}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {product.price ? `$${product.price}` : ''}
                        {product.price && product.vendor ? ' · ' : ''}
                        {product.vendor || ''}
                      </p>
                    </div>
                    {(product.category || product.productType) && (
                      <Badge variant="secondary" className="shrink-0 text-xs capitalize">
                        {(product.category || product.productType || '').replace(/-/g, ' ')}
                      </Badge>
                    )}
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="h-8 w-8 mb-3 opacity-30" style={{ color: 'var(--text4)' }} />
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text2)' }}>
                      {products.length === 0 ? 'No products synced' : 'No products match your filters'}
                    </p>
                    <p className="text-[12px] mt-1" style={{ color: 'var(--text4)' }}>
                      {products.length === 0
                        ? 'Upload a product CSV or sync from Shopify to get started.'
                        : 'Try adjusting your search or category filter.'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  )
}
