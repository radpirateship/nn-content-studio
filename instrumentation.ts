export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
          try {
                  const { existsSync, writeFileSync } = await import('fs')
                  if (!existsSync('.env.local')) {
                            const vars = [
                                        'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'DATABASE_URL',
                                        'SHOPIFY_STORE_DOMAIN', 'SHOPIFY_STOREFRONT_ACCESS_TOKEN',
                                        'SHOPIFY_ACCESS_TOKEN', 'NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN',
                                        'SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET',
                                      ]
                            const lines: string[] = []
        for (const v of vars) {
                    if (process.env[v]) lines.push(`${v}=${process.env[v]}`)
        }
                            if (lines.length > 0) {
                                        writeFileSync('.env.local', lines.join('\n') + '\n')
                                        console.log(`[v0] instrumentation: recreated .env.local with ${lines.length} vars`)
                            }
                  }
          } catch (err) {
                  // On Vercel, the filesystem is read-only — this is expected and safe to ignore
            console.log('[v0] instrumentation: skipping .env.local write (read-only filesystem)')
          }
    }
}
