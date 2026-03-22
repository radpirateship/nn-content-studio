'use client'

import { useEffect, useMemo } from 'react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  FilePlus,
  FolderOpen,
  Package,
  Database,
  Layers,
  Zap,
  FileText,
  Link2,
  ImageIcon,
  BarChart3,
  Clock,
  RefreshCw,
  Wrench,
  BookOpen,
  FileCode,
  Plug,
  ScrollText,
  Send,
} from 'lucide-react'
import type { ViewId } from './app-sidebar'

interface GeneratedArticle {
  id: string
  title: string
  status?: string
  category?: string
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (view: ViewId) => void
  articles: GeneratedArticle[]
  onSelectArticle: (article: GeneratedArticle) => void
  hasCurrentArticle: boolean
}

interface CommandAction {
  id: string
  label: string
  icon: React.ReactNode
  group: 'navigation' | 'article-pipeline' | 'actions'
  action: () => void
  shortcut?: string
  requiresArticle?: boolean
}

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  articles,
  onSelectArticle,
  hasCurrentArticle,
}: CommandPaletteProps) {

  const actions: CommandAction[] = useMemo(() => [
    // Navigation
    { id: 'nav-revamp', label: 'Revamp Article', icon: <RefreshCw className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('revamp-input') },
    { id: 'nav-new', label: 'New Article', icon: <FilePlus className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('new-article') },
    { id: 'nav-library', label: 'Article Library', icon: <FolderOpen className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('library') },
    { id: 'nav-queue', label: 'Content Queue', icon: <Clock className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('queue') },
    { id: 'nav-products', label: 'Products', icon: <Package className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('products') },
    { id: 'nav-resources', label: 'Resources', icon: <Database className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('resources') },
    { id: 'nav-bulk', label: 'Bulk Upload', icon: <Layers className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('bulk-queue') },
    { id: 'nav-autorun', label: 'Auto-Run', icon: <Zap className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('auto-run') },
    { id: 'nav-workshop', label: 'Workshop', icon: <Wrench className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('workshop') },
    { id: 'nav-guide', label: 'Guide', icon: <BookOpen className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('guide') },
    { id: 'nav-techguide', label: 'Technical Guide', icon: <FileCode className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('tech-guide') },
    { id: 'nav-connections', label: 'Connections', icon: <Plug className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('connections') },
    { id: 'nav-logs', label: 'Logs', icon: <ScrollText className="h-4 w-4" />, group: 'navigation', action: () => onNavigate('logs') },

    // Article pipeline (only shown when article is loaded)
    { id: 'pipe-content', label: 'Go to Content', icon: <FileText className="h-4 w-4" />, group: 'article-pipeline', action: () => onNavigate('article-content'), shortcut: '⌘1', requiresArticle: true },
    { id: 'pipe-links', label: 'Go to Links', icon: <Link2 className="h-4 w-4" />, group: 'article-pipeline', action: () => onNavigate('article-links'), shortcut: '⌘2', requiresArticle: true },
    { id: 'pipe-images', label: 'Go to Images', icon: <ImageIcon className="h-4 w-4" />, group: 'article-pipeline', action: () => onNavigate('article-images'), shortcut: '⌘3', requiresArticle: true },
    { id: 'pipe-seo', label: 'Go to SEO', icon: <BarChart3 className="h-4 w-4" />, group: 'article-pipeline', action: () => onNavigate('article-seo'), shortcut: '⌘4', requiresArticle: true },
    { id: 'pipe-publish', label: 'Go to Publish', icon: <Send className="h-4 w-4" />, group: 'article-pipeline', action: () => onNavigate('publish-confirm'), shortcut: '⌘5', requiresArticle: true },
  ], [onNavigate])

  const filteredActions = actions.filter(a => !a.requiresArticle || hasCurrentArticle)

  const handleSelect = (action: CommandAction) => {
    action.action()
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search views, articles, and actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recent articles */}
        {articles.length > 0 && (
          <CommandGroup heading="Articles">
            {articles.slice(0, 8).map(article => (
              <CommandItem
                key={article.id}
                onSelect={() => {
                  onSelectArticle(article)
                  onOpenChange(false)
                }}
              >
                <FileText className="h-4 w-4" />
                <span className="flex-1 truncate">{article.title}</span>
                {article.status && (
                  <span className="text-[10px] font-mono opacity-50">{article.status}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Article pipeline */}
        {hasCurrentArticle && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Article Pipeline">
              {filteredActions.filter(a => a.group === 'article-pipeline').map(action => (
                <CommandItem key={action.id} onSelect={() => handleSelect(action)}>
                  {action.icon}
                  <span>{action.label}</span>
                  {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigate">
          {filteredActions.filter(a => a.group === 'navigation').map(action => (
            <CommandItem key={action.id} onSelect={() => handleSelect(action)}>
              {action.icon}
              <span>{action.label}</span>
              {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
