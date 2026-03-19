'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Leaf, 
  Settings,
  FileText,
  Package
} from 'lucide-react'

interface DashboardHeaderProps {
  productCount: number
  articleCount: number
}

export function DashboardHeader({ productCount, articleCount }: DashboardHeaderProps) {
  return (
    <header className="border-b border-border/50 bg-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Leaf className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">NN Content Studio</h1>
            <p className="text-xs text-muted-foreground">Naked Nutrition</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-4 sm:flex">
            <div className="flex items-center gap-1.5 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Products:</span>
              <Badge variant="secondary">{(productCount ?? 0).toLocaleString()}</Badge>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Articles:</span>
              <Badge variant="secondary">{articleCount}</Badge>
            </div>
          </div>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
