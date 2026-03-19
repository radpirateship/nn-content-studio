'use client'

import { cn } from '@/lib/utils'
import {
  FilePlus,
  FolderOpen,
  Package,
  Database,
  Layers,
  Zap,
  Check,
  FileText,
  Link2,
  ImageIcon,
  BarChart3,
  Clock,
  RefreshCw,
  List,
  Wrench,
  BookOpen,
} from 'lucide-react'

export type ViewId =
  | 'revamp-input'
  | 'revamp-analysis'
  | 'new-article'
  | 'outline-review'
  | 'article-content'
  | 'article-links'
  | 'article-images'
  | 'article-seo'
  | 'library'
  | 'queue'
  | 'bulk-queue'
  | 'products'
  | 'resources'
  | 'auto-run'
  | 'publish-confirm'
  | 'error'
  | 'workshop'
  | 'guide'

interface NavItem {
  id: ViewId
  label: string
  icon: React.ReactNode
  badge?: string
  badgeVariant?: 'green' | 'grey' | 'amber'
}

interface WorkflowStep {
  label: string
  status: 'done' | 'current' | 'pending'
}

interface AppSidebarProps {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
  articleCounts?: { drafts: number; published: number }
  workflowSteps?: WorkflowStep[]
  hasCurrentArticle?: boolean
  currentArticleTitle?: string
  articleBadges?: {
    content?: string
    links?: string
    linksVariant?: 'green' | 'grey' | 'amber'
    images?: string
    imagesVariant?: 'green' | 'grey' | 'amber'
    seo?: string
    seoVariant?: 'green' | 'grey' | 'amber'
  }
}

export function AppSidebar({
  activeView,
  onNavigate,
  articleCounts,
  workflowSteps,
  hasCurrentArticle,
  currentArticleTitle: _currentArticleTitle,
  articleBadges,
}: AppSidebarProps) {
  const revampItems: NavItem[] = [
    { id: 'revamp-input', label: 'Revamp Article', icon: <RefreshCw className="h-[18px] w-[18px]" /> },
    { id: 'revamp-analysis', label: 'Analysis Review', icon: <BarChart3 className="h-[18px] w-[18px]" /> },
  ]

  const createItems: NavItem[] = [
    { id: 'new-article', label: 'New Article', icon: <FilePlus className="h-[18px] w-[18px]" /> },
    { id: 'bulk-queue', label: 'Bulk Upload', icon: <Layers className="h-[18px] w-[18px]" /> },
    { id: 'auto-run', label: 'Auto-Run', icon: <Zap className="h-[18px] w-[18px]" /> },
  ]

  const articleItems: NavItem[] = [
    { id: 'article-content', label: 'Content', icon: <FileText className="h-[18px] w-[18px]" />, badge: articleBadges?.content, badgeVariant: 'green' },
    { id: 'article-links', label: 'Internal Links', icon: <Link2 className="h-[18px] w-[18px]" />, badge: articleBadges?.links, badgeVariant: articleBadges?.linksVariant || 'grey' },
    { id: 'article-images', label: 'Images', icon: <ImageIcon className="h-[18px] w-[18px]" />, badge: articleBadges?.images, badgeVariant: articleBadges?.imagesVariant || 'grey' },
    { id: 'article-seo', label: 'SEO', icon: <BarChart3 className="h-[18px] w-[18px]" />, badge: articleBadges?.seo, badgeVariant: articleBadges?.seoVariant || 'grey' },
  ]

  const libraryItems: NavItem[] = [
    { id: 'library', label: 'Articles', icon: <FolderOpen className="h-[18px] w-[18px]" />, badge: articleCounts ? `${articleCounts.drafts + articleCounts.published}` : undefined, badgeVariant: 'grey' },
    { id: 'queue', label: 'Queue', icon: <Clock className="h-[18px] w-[18px]" /> },
    { id: 'products', label: 'Products', icon: <Package className="h-[18px] w-[18px]" /> },
    { id: 'resources', label: 'Resources', icon: <Database className="h-[18px] w-[18px]" /> },
    { id: 'workshop', label: 'Workshop', icon: <Wrench className="h-[18px] w-[18px]" /> },
    { id: 'guide', label: 'Guide', icon: <BookOpen className="h-[18px] w-[18px]" /> },
  ]

  function renderNavItem(item: NavItem) {
    const isActive = activeView === item.id
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={cn(
          'flex w-full items-center gap-2.5 border-l-[2.5px] px-4 py-[7px] text-[13px] transition-all select-none',
          isActive
            ? 'font-semibold'
            : 'border-transparent font-normal hover:bg-[var(--surface)]'
        )}
        style={{
          color: isActive ? 'var(--nn-accent)' : 'var(--text2)',
          background: isActive ? 'var(--nn-accent-light)' : undefined,
          borderLeftColor: isActive ? 'var(--nn-accent)' : 'transparent',
        }}
      >
        <span className={cn('w-[18px] text-center flex-shrink-0', isActive ? 'opacity-100' : 'opacity-75')}>
          {item.icon}
        </span>
        <span className="flex-1 text-left">{item.label}</span>
        {item.badge && (
          <span
            className="ml-auto rounded-[10px] px-[7px] py-px text-[10px] font-mono font-medium"
            style={{
              background: item.badgeVariant === 'green' ? 'var(--nn-accent-light)' : item.badgeVariant === 'amber' ? 'rgba(212,147,10,0.1)' : 'var(--surface2)',
              color: item.badgeVariant === 'green' ? 'var(--nn-accent)' : item.badgeVariant === 'amber' ? '#d4930a' : 'var(--text4)',
            }}
          >
            {item.badge}
          </span>
        )}
      </button>
    )
  }

  function renderSectionLabel(label: string, icon?: React.ReactNode) {
    return (
      <div
        className="flex items-center gap-1.5 px-4 pt-3.5 pb-1.5 text-[9px] font-medium tracking-[1.5px] uppercase font-mono"
        style={{ color: 'var(--text4)' }}
      >
        {icon && <span className="opacity-60">{icon}</span>}
        {label}
      </div>
    )
  }

  return (
    <aside className="flex h-full flex-col overflow-y-auto border-r pt-3.5" style={{ background: 'var(--bg-warm)', borderColor: 'var(--border)' }}>

      {/* ⭐ Revamp Workflow (Primary) */}
      {renderSectionLabel('Revamp')}
      {revampItems.map(renderNavItem)}

      {hasCurrentArticle && (
        <>
          <div className="mx-4 my-2 h-px" style={{ background: 'var(--border)' }} />
          {renderSectionLabel('Current Article')}
          {articleItems.map(renderNavItem)}
        </>
      )}

      {/* 📝 Create New */}
      <div className="mx-4 my-2 h-px" style={{ background: 'var(--border)' }} />
      {renderSectionLabel('Create New')}
      {createItems.map(renderNavItem)}

      {/* 📚 Library */}
      <div className="mx-4 my-2 h-px" style={{ background: 'var(--border)' }} />
      {renderSectionLabel('Library')}
      {libraryItems.map(renderNavItem)}

      {/* ⚙️ Workflow Mini-Tracker */}
      {workflowSteps && workflowSteps.length > 0 && (
        <>
          <div className="mx-4 my-2 h-px" style={{ background: 'var(--border)' }} />
          <div className="px-4 py-3">
            <div
              className="mb-2.5 text-[9px] font-mono font-medium tracking-[1.2px] uppercase"
              style={{ color: 'var(--text4)' }}
            >
              Workflow
            </div>
            <div className="flex flex-col">
              {workflowSteps.map((step, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2 py-1 text-[12px]" style={{
                    color: step.status === 'done' ? 'var(--nn-accent)' : step.status === 'current' ? 'var(--text1)' : 'var(--text4)',
                    fontWeight: step.status === 'current' ? 500 : 400,
                  }}>
                    <div
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-mono"
                      style={{
                        border: '1.5px solid',
                        borderColor: step.status === 'done' ? 'var(--nn-accent)' : step.status === 'current' ? 'var(--text2)' : 'var(--border)',
                        background: step.status === 'done' ? 'var(--nn-accent-light)' : step.status === 'current' ? 'var(--surface)' : 'transparent',
                        color: step.status === 'done' ? 'var(--nn-accent)' : step.status === 'current' ? 'var(--text1)' : 'var(--text4)',
                      }}
                    >
                      {step.status === 'done' ? <Check className="h-2.5 w-2.5" /> : i + 1}
                    </div>
                    {step.label}
                  </div>
                  {i < workflowSteps.length - 1 && (
                    <div
                      className="ml-[8px] h-2 w-[1.5px]"
                      style={{
                        background: step.status === 'done' ? 'var(--nn-accent)' : 'var(--border)',
                        opacity: step.status === 'done' ? 0.35 : 1,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
