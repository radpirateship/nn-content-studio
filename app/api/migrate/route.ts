// One-time migration endpoint Ã¢ÂÂ runs DB migrations and seeds collections registry
// Safe to call multiple times (all operations use IF NOT EXISTS / ON CONFLICT)
import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

// Canonical collection list from PPW_COLLECTION_DATABASE_MATCH.csv
const CANONICAL_COLLECTIONS = [
  { label: 'Barrel Saunas',             slug: 'barrel-saunas',             url: 'https://nakednutrition.com/collections/barrel-saunas' },
  { label: 'Cold Plunges',              slug: 'cold-plunges',              url: 'https://nakednutrition.com/collections/cold-plunges' },
  { label: 'Hydrogen Water',            slug: 'hydrogen-water',            url: 'https://nakednutrition.com/collections/hydrogen-water' },
  { label: 'Hyperbaric Chambers',       slug: 'hyperbaric-chambers',       url: 'https://nakednutrition.com/collections/hyperbaric-chambers' },
  { label: 'Infrared Saunas',           slug: 'infrared-saunas',           url: 'https://nakednutrition.com/collections/infrared-saunas' },
  { label: 'Pilates',                   slug: 'pilates',                   url: 'https://nakednutrition.com/collections/pilates' },
  { label: 'Red Light Therapy',         slug: 'red-light-therapy',         url: 'https://nakednutrition.com/collections/red-light-therapy' },
  { label: 'Sauna Accessories',         slug: 'sauna-accessories',         url: 'https://nakednutrition.com/collections/sauna-accessories' },
  { label: 'Saunas',                    slug: 'saunas',                    url: 'https://nakednutrition.com/collections/saunas' },
  { label: 'Sensory Deprivation Tanks', slug: 'sensory-deprivation-tanks', url: 'https://nakednutrition.com/collections/sensory-deprivation-tanks' },
  { label: 'Steam',                     slug: 'steam',                     url: 'https://nakednutrition.com/collections/steam' },
  { label: 'Traditional Saunas',        slug: 'traditional-saunas',        url: 'https://nakednutrition.com/collections/traditional-saunas' },
  { label: 'Water Ionizers',            slug: 'water-ionizers',            url: 'https://nakednutrition.com/collections/water-ionizers' },
]

export async function GET() {
  const results: Record<string, string> = {}
  const sql = getDb()

  try {
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS collection_slug TEXT`
    await sql`CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection_slug)`
    results['products.collection_slug'] = 'OK'
  } catch (e) { results['products.collection_slug'] = `ERROR: ${e}` }

  try {
    await sql`ALTER TABLE topical_authority ADD COLUMN IF NOT EXISTS collection_slug TEXT`
    await sql`CREATE INDEX IF NOT EXISTS idx_ta_collection ON topical_authority(collection_slug)`
    results['topical_authority.collection_slug'] = 'OK'
  } catch (e) { results['topical_authority.collection_slug'] = `ERROR: ${e}` }

  try {
    await sql`ALTER TABLE collections ADD COLUMN IF NOT EXISTS collection_slug TEXT`
    results['collections.collection_slug'] = 'OK'
  } catch (e) { results['collections.collection_slug'] = `ERROR: ${e}` }

  try {
    await sql`ALTER TABLE collections_registry ADD COLUMN IF NOT EXISTS url TEXT`
    results['collections_registry.url'] = 'OK'
  } catch (e) { results['collections_registry.url'] = `ERROR: ${e}` }

  let seeded = 0
  const seedErrors: string[] = []
  for (const col of CANONICAL_COLLECTIONS) {
    try {
      await sql`
        INSERT INTO collections_registry (slug, label, is_builtin, url)
        VALUES (${col.slug}, ${col.label}, TRUE, ${col.url})
        ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, is_builtin = TRUE, url = EXCLUDED.url
      `
      seeded++
    } catch (e) { seedErrors.push(`${col.slug}: ${e}`) }
  }
  results['collections_registry_seed'] = seedErrors.length === 0
    ? `Seeded/updated ${seeded} collections`
    : `Seeded ${seeded}, errors: ${seedErrors.join('; ')}`

  try {
    const rows = await sql`SELECT slug FROM collections_registry ORDER BY label`
    results['registry_list'] = rows.map((r: {slug: string}) => r.slug).join(', ')
  } catch (e) { results['registry_check'] = `ERROR: ${e}` }

  try {
    const c = await sql`SELECT COUNT(*) as n FROM products`
    results['products_total'] = `${c[0].n} products in DB`
    const s = await sql`SELECT COUNT(*) as n FROM products WHERE collection_slug IS NOT NULL`
    results['products_scoped'] = `${s[0].n} products scoped`
  } catch (e) { results['products_check'] = `ERROR: ${e}` }

  
  // --- Collections registry cleanup (2026-03-12) ---
  try {
    // Remove deprecated built-in collections
    await sql`DELETE FROM collections_registry WHERE slug = 'float-tanks'`
    await sql`DELETE FROM collections_registry WHERE slug = 'cold-plunge'`
    await sql`DELETE FROM collections_registry WHERE slug = 'pilates-equipment'`
    results['collections_cleanup'] = 'Removed float-tanks, cold-plunge, and pilates-equipment'
  } catch (e) { results['collections_cleanup'] = `ERROR: ${e}` }

  try {
    // Upsert all current built-in collections (including cardio + corrected slugs)
    await sql`
      INSERT INTO collections_registry (slug, label, is_builtin) VALUES
        ('saunas', 'Saunas', TRUE),
        ('cold-plunges', 'Cold Plunges', TRUE),
        ('red-light-therapy', 'Red Light Therapy', TRUE),
        ('hyperbaric-chambers', 'Hyperbaric Chambers', TRUE),
        ('massage-equipment', 'Massage Equipment', TRUE),
        ('recovery-tools', 'Recovery Tools', TRUE),
        ('general-wellness', 'General Wellness', TRUE),
        ('steam', 'Steam', TRUE),
        ('sensory-deprivation-tanks', 'Sensory Deprivation Tanks', TRUE),
        ('elliptical-machines', 'Elliptical Machines', TRUE),
        ('exercise-bikes', 'Exercise Bikes', TRUE),
        ('treadmills', 'Treadmills', TRUE),
        ('stair-climbers', 'Stair Climbers', TRUE),
        ('vertical-climbers', 'Vertical Climbers', TRUE),
        ('pilates', 'Pilates', TRUE)
      ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, is_builtin = EXCLUDED.is_builtin
    `
    results['collections_upsert'] = 'All 15 built-in collections upserted'
  } catch (e) { results['collections_upsert'] = `ERROR: ${e}` }

  try {
    await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_type TEXT`
    results['articles.article_type'] = 'OK'
  } catch (e) { results['articles.article_type'] = `ERROR: ${e}` }

  return NextResponse.json({ success: true, results })
}
