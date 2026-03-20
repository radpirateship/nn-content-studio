import { z } from "zod"

const optionalString = z.string().trim().optional()
const nullableOptionalString = z.string().trim().nullable().optional()
const productInputSchema = z.object({
  title: z.string().trim().min(1),
  description: optionalString,
  price: optionalString,
  imageUrl: optionalString,
  url: optionalString,
  handle: optionalString,
  vendor: optionalString,
  tags: optionalString,
  id: optionalString,
  productType: optionalString,
  compareAtPrice: optionalString,
})

export const generateArticleRequestSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  keyword: z.string().trim().min(1, "keyword is required"),
  category: optionalString,
  tone: optionalString,
  wordCount: z.coerce.number().int().positive().max(10000).optional(),
  products: z.array(productInputSchema).optional(),
  relatedArticles: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        url: z.string().trim().min(1),
        description: z.string().trim().min(1),
      })
    )
    .optional(),
  articleType: optionalString,
  audience: optionalString,
  collection: optionalString,
  specialInstructions: optionalString,
  includeComparisonTable: z.boolean().optional(),
})

export const revampGenerateRequestSchema = z.object({
  existingContent: z.string().trim().min(1, "existingContent is required"),
  existingShopifyId: z.number().int().positive().optional(),
  existingHandle: optionalString,
  category: z.string().trim().min(1, "category is required"),
  keyword: z.string().trim().min(1, "keyword is required"),
  tone: optionalString,
  wordCount: z.coerce.number().int().positive().max(10000).optional(),
  includeProducts: z.boolean().optional(),
  includeFAQ: z.boolean().optional(),
  includeEmailCapture: z.boolean().optional(),
  includeCalculator: z.boolean().optional(),
  calculatorType: optionalString,
  includeComparisonTable: z.boolean().optional(),
  specialInstructions: optionalString,
  titleTag: optionalString,
  metaDescription: optionalString,
  approvedOutline: z
    .array(
      z.object({
        heading: z.string().trim().min(1),
        keyPoints: z.array(z.string().trim()).default([]),
        isNew: z.boolean().default(false),
      })
    )
    .default([]),
  citations: z
    .array(
      z.object({
        id: optionalString,
        url: z.string().trim().url("citation url must be a valid URL"),
        title: optionalString,
        notes: optionalString,
      })
    )
    .default([]),
  revampSourceId: z.number().int().positive().optional(),
  collection: optionalString,
  relatedArticles: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        url: z.string().trim().min(1),
        description: z.string().trim().min(1),
      })
    )
    .optional(),
})

export const shopifyPublishRequestSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  bodyHtml: z.string().trim().min(1, "bodyHtml is required"),
  summary: optionalString,
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  author: optionalString,
  handle: optionalString,
  metafields: z
    .array(
      z.object({
        namespace: z.string().trim().min(1),
        key: z.string().trim().min(1),
        value: z.string(),
        type: z.string().trim().min(1),
      })
    )
    .optional(),
  blogId: z.union([z.number().int().positive(), z.string().trim().min(1)]).optional(),
  published: z.boolean().optional(),
  featuredImageUrl: optionalString,
  featuredImageAlt: optionalString,
  category: optionalString,
})

export const createArticleSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  slug: z.string().trim().min(1, "slug is required"),
  category: nullableOptionalString,
  keyword: nullableOptionalString,
  html_content: z.string().trim().min(1, "html_content is required"),
  meta_description: nullableOptionalString,
  schema_markup: nullableOptionalString,
  featured_image_url: nullableOptionalString,
  word_count: z.coerce.number().int().min(0).optional(),
  status: optionalString.default("draft"),
  tone: nullableOptionalString,
  article_type: nullableOptionalString,
  shopify_blog_tag: nullableOptionalString,
})

export const updateArticleSchema = z
  .object({
    id: z.union([z.number().int().positive(), z.string().trim().min(1)]),
    title: nullableOptionalString,
    slug: nullableOptionalString,
    category: nullableOptionalString,
    keyword: nullableOptionalString,
    html_content: nullableOptionalString,
    meta_description: nullableOptionalString,
    schema_markup: nullableOptionalString,
    featured_image_url: nullableOptionalString,
    word_count: z.coerce.number().int().min(0).optional(),
    status: nullableOptionalString,
    tone: nullableOptionalString,
    article_type: nullableOptionalString,
    shopify_blog_tag: nullableOptionalString,
  })
  .refine((body) => body.id !== undefined && body.id !== null && String(body.id).trim().length > 0, {
    message: "id is required",
    path: ["id"],
  })
