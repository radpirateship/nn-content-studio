'use client'

interface AppTopbarProps {
  isGenerating?: boolean
  generationMessage?: string
}

export function AppTopbar({ isGenerating, generationMessage }: AppTopbarProps) {
  return (
    <header
      className="flex items-center gap-3 px-5 relative z-10"
      style={{
        gridColumn: '1 / -1',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        height: 'var(--header-h)',
      }}
    >
      {/* Logo */}
      <div className="font-serif font-semibold text-[17px] tracking-[-0.3px]" style={{ color: 'var(--nn-accent)' }}>
        NN
        <span className="font-normal text-[14px] ml-1" style={{ color: 'var(--text3)' }}>Content Studio</span>
      </div>

      {/* Generation status (only when active) */}
      {isGenerating && (
        <>
          <div className="h-6 w-px mx-1" style={{ background: 'var(--border)' }} />
          <span className="text-[12px]" style={{ color: 'var(--text3)' }}>
            {generationMessage || 'Generating...'}
          </span>
        </>
      )}

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text2)' }}>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full font-serif text-[12px] font-semibold"
            style={{
              background: 'var(--nn-accent-light)',
              border: '1.5px solid var(--nn-accent)',
              color: 'var(--nn-accent)',
            }}
          >
            R
          </div>
          Ryan
        </div>
      </div>
    </header>
  )
}
