'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  ChevronLeft,
  Upload,
  Loader2,
  AlertCircle,
  Trash2,
  ChevronDown,
  X,
  Database,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UltimateGuide } from './ultimate-guide-wizard'

type ViewMode = 'database' | 'upload' | 'pick' | 'arrange'

interface ParsedProduct {
  id: string
  title: string
  handle: string
  image_url: string
  price: number
  vendor: string
}

interface SelectedProduct extends ParsedProduct {
  selected_role?: 'best-value' | 'best-upgrade'
  selected_subcategory?: string
}

interface GuideProductSelectorProps {
  guide: UltimateGuide
  onSave: (guide: UltimateGuide) => void
  onBack: () => void
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"'
        i++
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function splitCSVRows(csv: string): string[] {
  return csv
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
}

function parseMatrixifyCSV(csv: string): ParsedProduct[] {
  const rows = splitCSVRows(csv)
  if (rows.length < 2) return []

  const header = parseCSVLine(rows[0]).map(h => h.toLowerCase())
  const products: ParsedProduct[] = []

  for (let i = 1; i < rows.length; i++) {
    const fields = parseCSVLine(rows[i])
    if (fields.length < 1) continue

    const obj: Record<string, string> = {}
    header.forEach((h, idx) => {
      obj[h] = fields[idx] || ''
    })

    if (obj.handle && obj.title) {
      products.push({
        id: obj.handle,
        title: obj.title,
        handle: obj.handle,
        image_url: obj.image_url || '/placeholder.jpg',
        price: parseInt(obj.price || '0', 10),
        vendor: obj.vendor || 'Unknown',
      })
    }
  }

  return products
}

function ProductPickerCard({
  product,
  isSelected,
  onSelect,
}: {
  product: ParsedProduct
  isSelected: boolean
  onSelect: (product: ParsedProduct) => void
}) {
  return (
    <button
      onClick={() => onSelect(product)}
      className={cn(
        'rounded-lg border-2 p-3 text-left transition-all',
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      )}
    >
      <img
        src={product.image_url}
        alt={product.title}
        className="w-full h-32 object-cover rounded mb-2"
        onError={e => { (e.target as HTMLImageElement).src = '/placeholder.jpg' }}
      />
      <h4 className="font-semibold text-sm line-clamp-2">{product.title}</h4>
      <p className="text-xs text-gray-600">{product.vendor}</p>
      <p className="text-sm font-bold mt-2">${Number(product.price).toLocaleString()}</p>
    </button>
  )
}

function SelectedProductEditor({
  product,
  subcategories,
  onUpdate,
  onRemove,
}: {
  product: SelectedProduct
  subcategories: string[]
  onUpdate: (product: SelectedProduct) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3 bg-blue-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold">{product.title}</h4>
          <p className="text-sm text-gray-600">{product.vendor}</p>
          <p className="text-sm font-bold mt-1">${Number(product.price).toLocaleString()}</p>
        </div>
        <button onClick={onRemove} className="text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Subcategory</label>
          <select
            value={product.selected_subcategory || ''}
            onChange={e =>
              onUpdate({ ...product, selected_subcategory: e.target.value })
            }
            className="w-full px-2 py-1.5 border rounded text-sm"
          >
            <option value="">Select...</option>
            {subcategories.map(sc => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Role</label>
          <select
            value={product.selected_role || ''}
            onChange={e =>
              onUpdate({
                ...product,
                selected_role: e.target.value as 'best-value' | 'best-upgrade' | undefined,
              })
            }
            className="w-full px-2 py-1.5 border rounded text-sm"
          >
            <option value="">Select...</option>
            <option value="best-value">Best Value</option>
            <option value="best-upgrade">Best Upgrade</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export function GuideProductSelector({ guide, onSave, onBack }: GuideProductSelectorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(guide.collection_slug ? 'database' : 'upload')
  const [csvInput, setCsvInput] = useState('')
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([])
  const [dbProducts, setDbProducts] = useState<ParsedProduct[]>([])
  const [isLoadingDb, setIsLoadingDb] = useState(false)
  const [dbSearch, setDbSearch] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    guide.selected_products || []
  )
  const [isSaving, setIsSaving] = useState(false)
  const [subcategories, setSubcategories] = useState<string[]>(['Option 1', 'Option 2', 'Option 3'])

  // Auto-load products from DB when collection is set
  useEffect(() => {
    if (guide.collection_slug) {
      loadProductsFromDb(guide.collection_slug)
    }
  }, [guide.collection_slug])

  const loadProductsFromDb = async (collection?: string) => {
    setIsLoadingDb(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (collection) params.set('category', collection)
      if (dbSearch) params.set('search', dbSearch)

      const resp = await fetch('/api/products?' + params.toString())
      if (resp.ok) {
        const data = await resp.json()
        const products: ParsedProduct[] = (data.products || data || []).map((p: Record<string, unknown>) => ({
          id: (p.handle as string) || (p.id as string) || '',
          title: (p.title as string) || '',
          handle: (p.handle as string) || '',
          image_url: (p.imageUrl as string) || (p.image_url as string) || (p.featured_image as string) || '/placeholder.jpg',
          price: typeof p.price === 'number' ? p.price : parseInt(String(p.price || '0'), 10),
          vendor: (p.vendor as string) || 'Unknown',
        }))
        setDbProducts(products)
        if (viewMode === 'database') {
          setParsedProducts(products)
        }
      }
    } catch (err) {
      console.error('Failed to load products from DB:', err)
    } finally {
      setIsLoadingDb(false)
    }
  }

  const handleParseCsv = () => {
    try {
      const products = parseMatrixifyCSV(csvInput)
      if (products.length === 0) {
        alert('No valid products found in CSV')
        return
      }
      setParsedProducts(products)
      setViewMode('pick')
    } catch (err) {
      alert('Error parsing CSV: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const handleLoadFromDb = () => {
    loadProductsFromDb(guide.collection_slug)
    setParsedProducts(dbProducts)
    setViewMode('pick')
  }

  const handleSelectProduct = (product: ParsedProduct) => {
    const alreadySelected = selectedProducts.some(p => p.id === product.id)
    if (alreadySelected) {
      setSelectedProducts(prev => prev.filter(p => p.id !== product.id))
    } else {
      setSelectedProducts(prev => [...prev, { ...product }])
    }
  }

  const handleUpdateProduct = (product: SelectedProduct) => {
    setSelectedProducts(prev =>
      prev.map(p => (p.id === product.id ? product : p))
    )
  }

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId))
  }

  const handleSave = async () => {
    if (selectedProducts.length === 0) {
      alert('Please select at least one product')
      return
    }

    setIsSaving(true)

    try {
      const updatedGuide: UltimateGuide = {
        ...guide,
        selected_products: selectedProducts,
        products_complete: true,
      }

      await fetch('/api/ultimate-guides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guide.id,
          selected_products: selectedProducts,
          products_complete: true,
        }),
      })

      onSave(updatedGuide)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col p-8" style={{ background: 'var(--bg)' }}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Select Products</h2>
        <p className="text-sm text-gray-600">
          Step 2: Choose products to feature in your guide
          {guide.collection_slug && (
            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
              {guide.collection_slug}
            </span>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {(['database', 'upload', 'pick', 'arrange'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'px-4 py-2 font-medium text-sm border-b-2 transition-all flex items-center gap-1.5',
              viewMode === mode
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            {mode === 'database' && <><Database className="h-3.5 w-3.5" /> From Database</>}
            {mode === 'upload' && <><Upload className="h-3.5 w-3.5" /> CSV Upload</>}
            {mode === 'pick' && 'Pick Products'}
            {mode === 'arrange' && `Arrange (${selectedProducts.length})`}
          </button>
        ))}
      </div>

      {/* Database Tab */}
      {viewMode === 'database' && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-sm text-gray-600">
            Load products from your existing product catalog. These are the same products
            uploaded via the Products section.
          </p>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={dbSearch}
                onChange={e => setDbSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadProductsFromDb(guide.collection_slug)}
                className="w-full pl-9 pr-3 py-2 border rounded-md"
              />
            </div>
            <Button onClick={() => loadProductsFromDb(guide.collection_slug)} disabled={isLoadingDb} className="gap-2">
              {isLoadingDb ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Load Products
            </Button>
          </div>

          {dbProducts.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">{dbProducts.length} products found</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-auto">
                {dbProducts.map(product => (
                  <ProductPickerCard
                    key={product.id}
                    product={product}
                    isSelected={selectedProducts.some(p => p.id === product.id)}
                    onSelect={handleSelectProduct}
                  />
                ))}
              </div>
            </div>
          )}

          {dbProducts.length === 0 && !isLoadingDb && (
            <div className="rounded-lg border-2 border-dashed p-6 text-center text-gray-500">
              <Database className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>Click &ldquo;Load Products&rdquo; to pull from your catalog</p>
              {!guide.collection_slug && (
                <p className="text-xs mt-1">Tip: Set a collection in Setup to auto-filter products</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload Tab */}
      {viewMode === 'upload' && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-sm text-gray-600">
            Alternatively, paste a Matrixify CSV export to load products manually.
          </p>
          <div>
            <label className="block text-sm font-medium mb-2">Paste CSV (Matrixify format)</label>
            <textarea
              value={csvInput}
              onChange={e => setCsvInput(e.target.value)}
              placeholder="Paste CSV with columns: handle, title, image_url, price, vendor"
              className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
              rows={8}
            />
          </div>
          <Button onClick={handleParseCsv} className="gap-2">
            <Upload className="h-4 w-4" /> Parse CSV
          </Button>
        </div>
      )}

      {/* Pick Tab */}
      {viewMode === 'pick' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 overflow-auto">
          {parsedProducts.length === 0 ? (
            <div className="col-span-full rounded-lg border-2 border-dashed p-8 text-center text-gray-500">
              No products loaded. Use the Database or CSV tab first.
            </div>
          ) : (
            parsedProducts.map(product => (
              <ProductPickerCard
                key={product.id}
                product={product}
                isSelected={selectedProducts.some(p => p.id === product.id)}
                onSelect={handleSelectProduct}
              />
            ))
          )}
        </div>
      )}

      {/* Arrange Tab */}
      {viewMode === 'arrange' && (
        <div className="space-y-4 flex-1 overflow-auto max-w-2xl">
          {selectedProducts.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed p-8 text-center text-gray-500">
              No products selected. Go to Database or Pick tab first.
            </div>
          ) : (
            selectedProducts.map(product => (
              <SelectedProductEditor
                key={product.id}
                product={product}
                subcategories={subcategories}
                onUpdate={handleUpdateProduct}
                onRemove={() => handleRemoveProduct(product.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Selection Summary */}
      {selectedProducts.length > 0 && viewMode !== 'arrange' && (
        <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm font-medium text-blue-800">
            {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {selectedProducts.slice(0, 5).map(p => (
              <span key={p.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                {p.title.substring(0, 30)}
              </span>
            ))}
            {selectedProducts.length > 5 && (
              <span className="text-xs text-blue-600">+{selectedProducts.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-2 pt-6 border-t mt-auto">
        <Button onClick={onBack} variant="outline" className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back to Setup
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || selectedProducts.length === 0}
          className="ml-auto gap-2"
          style={{ background: 'var(--nn-accent)', color: '#fff' }}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              Continue to Content <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
