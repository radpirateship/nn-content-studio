export type NNCategory =
  | 'creatine'
  | 'whey-protein'
  | 'casein-protein'
  | 'pea-protein'
  | 'rice-protein'
  | 'mass-gainer'
  | 'pre-workout'
  | 'post-workout'
  | 'bcaa'
  | 'collagen'
  | 'greens'
  | 'fiber'
  | 'vitamins'
  | 'probiotics'
  | 'energy'
  | 'weight-management'
  | 'keto'
  | 'vegan'
  | 'general-nutrition'

export const CATEGORIES: NNCategory[] = [
  'creatine', 'whey-protein', 'casein-protein', 'pea-protein', 'rice-protein',
  'mass-gainer', 'pre-workout', 'post-workout', 'bcaa', 'collagen',
  'greens', 'fiber', 'vitamins', 'probiotics', 'energy',
  'weight-management', 'keto', 'vegan', 'general-nutrition',
]

export const CATEGORY_LABELS: Record<NNCategory, string> = {
  'creatine': 'Creatine',
  'whey-protein': 'Whey Protein',
  'casein-protein': 'Casein Protein',
  'pea-protein': 'Pea Protein',
  'rice-protein': 'Rice Protein',
  'mass-gainer': 'Mass Gainer',
  'pre-workout': 'Pre-Workout',
  'post-workout': 'Post-Workout Recovery',
  'bcaa': 'BCAAs & Amino Acids',
  'collagen': 'Collagen',
  'greens': 'Greens & Superfoods',
  'fiber': 'Fiber & Digestive Health',
  'vitamins': 'Vitamins & Minerals',
  'probiotics': 'Probiotics',
  'energy': 'Energy & Focus',
  'weight-management': 'Weight Management',
  'keto': 'Keto & Low-Carb',
  'vegan': 'Vegan Nutrition',
  'general-nutrition': 'General Nutrition',
}

export const CATEGORY_OPTIONS = CATEGORIES.map(c => ({
  value: c,
  label: CATEGORY_LABELS[c],
}))
