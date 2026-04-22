import type { Owner } from './types'

export interface AssignmentResult {
  owner: Owner
  reason: string
  needsReview: boolean
}

// ── Keyword lists per bucket ──────────────────────────────────
// Each entry is a phrase; matching is substring on the lowercased issue type.
// Order within each list doesn't matter — we report the first match found.

const TECH_KEYWORDS = [
  // canonicals
  'canonical',
  // redirects
  'redirect', '301', '302', '3xx',
  // status codes
  'status code', '4xx', '5xx', '404', '500', 'broken link', 'broken internal link',
  // robots / crawl directives
  'robots', 'noindex', 'nofollow',
  // sitemap
  'sitemap',
  // schema / structured data
  'schema', 'structured data', 'json-ld', 'schema.org', 'rich result', 'rich snippet',
  // crawling
  'crawl', 'crawlability', 'crawl budget', 'crawl error', 'crawl depth',
  // rendering
  'render', 'rendering', 'javascript rendering', 'client-side', 'server-side',
  // indexing
  'index', 'indexing', 'indexability', 'coverage', 'excluded from index',
  // other technical
  'hreflang', 'ssl', 'https', 'mixed content', 'core web vitals',
  'lcp', 'cls', 'fid', 'inp', 'page speed', 'load time', 'performance',
  'url structure', 'url parameter', 'pagination', 'facet',
]

const CONTENT_KEYWORDS = [
  // page metadata
  'meta description', 'meta title', 'title tag', 'metadata', 'page title',
  'open graph', 'og tag',
  // headings (careful: h1 must come before h10 etc.)
  'missing h1', 'duplicate h1', ' h1', 'heading tag', 'missing heading',
  // internal linking
  'internal link', 'internal linking',
  // commercial / landing content
  'commercial', 'product page', 'category page', 'landing page',
  'content gap', 'page gap', 'missing content',
  // thin / duplicate content
  'thin content', 'duplicate content', 'near-duplicate', 'duplicate title',
  // image
  'alt text', 'image alt', 'missing alt',
]

const COPY_KEYWORDS = [
  // blog / article
  'blog', 'article', 'editorial', 'post',
  // copy quality
  'copy improvement', 'copywriting', 'copy quality', 'copy issue',
  // refreshes / rewrites
  'blog refresh', 'content refresh', 'refresh', 'rewrite', 'update copy',
  // keyword / topical
  'keyword targeting', 'keyword optimis', 'topical authority', 'keyword density',
  // anchor
  'anchor text',
]

// ── Matcher ───────────────────────────────────────────────────

function firstMatch(text: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    if (text.includes(kw)) return kw
  }
  return null
}

// ── Public function ───────────────────────────────────────────

export function assignOwner(issueType: string): AssignmentResult {
  const lower = issueType.toLowerCase()

  const techKw    = firstMatch(lower, TECH_KEYWORDS)
  const contentKw = firstMatch(lower, CONTENT_KEYWORDS)
  const copyKw    = firstMatch(lower, COPY_KEYWORDS)

  const matchCount = [techKw, contentKw, copyKw].filter(Boolean).length

  // ── Ambiguous: multiple buckets matched ───────────────────
  if (matchCount > 1) {
    const matched = [
      techKw    && `Tech ("${techKw}")`,
      contentKw && `Site Content ("${contentKw}")`,
      copyKw    && `Copy / Blog ("${copyKw}")`,
    ].filter(Boolean).join(', ')

    // Assign to the highest-priority match (tech > content > copy) but flag it
    const owner: Owner = techKw ? 'tech' : contentKw ? 'site_content_lead' : 'copy_blog_lead'
    return {
      owner,
      reason: `Ambiguous — matched multiple buckets: ${matched}. Please confirm the correct owner.`,
      needsReview: true,
    }
  }

  // ── No match: flag for human review ──────────────────────
  if (matchCount === 0) {
    return {
      owner: 'site_content_lead',
      reason: `No keyword match for "${issueType}". Defaulted to Site Content Lead — please assign manually.`,
      needsReview: true,
    }
  }

  // ── Unambiguous matches ───────────────────────────────────
  if (techKw) {
    return {
      owner: 'tech',
      reason: `Assigned to Tech — issue type contains "${techKw}" (canonicals / redirects / status codes / robots / sitemap / schema / crawling / rendering / indexing).`,
      needsReview: false,
    }
  }

  if (contentKw) {
    return {
      owner: 'site_content_lead',
      reason: `Assigned to Site Content Lead — issue type contains "${contentKw}" (page metadata / internal linking / commercial page content).`,
      needsReview: false,
    }
  }

  // copyKw must be set at this point
  return {
    owner: 'copy_blog_lead',
    reason: `Assigned to Copy / Blog Lead — issue type contains "${copyKw}" (blog copy / article improvements / editorial content).`,
    needsReview: false,
  }
}
