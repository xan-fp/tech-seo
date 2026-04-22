export interface FixGuide {
  what:  string        // plain-English explanation of the problem
  why:   string        // why it matters for SEO
  steps: string[]      // numbered action steps
  owner: string        // who does what
}

// Matched in order — first match wins.
// Each entry has a list of substrings to look for in the issue type (lowercased).
const GUIDES: { keywords: string[]; guide: FixGuide }[] = [
  {
    keywords: ['missing meta description', 'meta description'],
    guide: {
      what:  'Pages are missing a meta description tag.',
      why:   'Google uses meta descriptions as the snippet shown in search results. Without one, Google auto-generates one — often poorly — which reduces click-through rate.',
      steps: [
        'Open each affected URL in your CMS.',
        'Find the SEO / meta fields section (usually in Yoast, Rank Math, or your theme settings).',
        'Write a 140–160 character description that includes the page\'s main keyword and a clear call to action.',
        'Save and republish the page.',
        'Re-crawl the URL in Screaming Frog or Google Search Console to confirm the tag is present.',
      ],
      owner: 'Site Content Lead writes the copy. Dev may need to expose the field in the CMS if it\'s missing.',
    },
  },
  {
    keywords: ['missing title', 'title tag', 'missing title tag'],
    guide: {
      what:  'Pages are missing an HTML <title> tag.',
      why:   'The title tag is one of the strongest on-page SEO signals. It appears as the blue link in search results. Missing titles cause Google to auto-generate one, usually from the H1 or page content.',
      steps: [
        'Open each affected URL in your CMS.',
        'Set a unique title tag of 50–60 characters.',
        'Include the primary keyword near the beginning.',
        'Add your brand name at the end, separated by a dash or pipe (e.g. "School Hoodies | FreshPrints").',
        'Save and republish.',
      ],
      owner: 'Site Content Lead.',
    },
  },
  {
    keywords: ['duplicate title'],
    guide: {
      what:  'Multiple pages share the same title tag.',
      why:   'Duplicate titles confuse Google about which page to rank for a given keyword, causing them to compete against each other (cannibalisation).',
      steps: [
        'Export the list of duplicate URLs.',
        'For each group, decide which page is the "primary" one to rank.',
        'Give every other page in the group a unique, descriptive title reflecting its own content.',
        'If two pages are genuinely about the same topic, consider consolidating them into one page with a redirect.',
      ],
      owner: 'Site Content Lead.',
    },
  },
  {
    keywords: ['missing h1', 'h1: missing'],
    guide: {
      what:  'Pages are missing an H1 heading.',
      why:   'The H1 is the main headline of the page. Google uses it to understand page topic. Missing H1s are a weak content signal.',
      steps: [
        'Open each affected URL.',
        'Add a single H1 that describes the page\'s main topic.',
        'Make sure it includes the primary keyword.',
        'Do not use more than one H1 per page.',
        'The H1 and title tag can be similar but don\'t have to be identical.',
      ],
      owner: 'Site Content Lead.',
    },
  },
  {
    keywords: ['h1: multiple', 'multiple h1', 'h1: duplicate'],
    guide: {
      what:  'Pages have more than one H1 heading.',
      why:   'Multiple H1s dilute the page\'s topic signal and can confuse crawlers.',
      steps: [
        'Open each affected URL in your browser and inspect the HTML (right-click → View Page Source, search for "<h1").',
        'Keep only one H1 — the main page headline.',
        'Change any additional H1 tags to H2 or H3 as appropriate.',
        'Update in your CMS and republish.',
      ],
      owner: 'Site Content Lead. May need Dev if H1s are hard-coded in a template.',
    },
  },
  {
    keywords: ['thin content'],
    guide: {
      what:  'Pages have very little text content (typically under 300 words).',
      why:   'Google considers thin-content pages low quality, which can suppress rankings for the whole site.',
      steps: [
        'Review each affected URL — decide: expand it, merge it with another page, or remove it.',
        'Expand: add meaningful content (FAQs, how-it-works, testimonials, specs). Aim for 400–600+ words for commercial pages.',
        'Merge: if two thin pages cover the same topic, combine them into one stronger page and redirect the old URL.',
        'Remove: if the page has no purpose, add a noindex tag or redirect to the most relevant page.',
      ],
      owner: 'Site Content Lead for commercial pages. Copy / Blog Lead for blog/editorial pages.',
    },
  },
  {
    keywords: ['canonical', 'missing canonical'],
    guide: {
      what:  'Pages are missing a canonical tag, or the canonical tag is pointing to the wrong URL.',
      why:   'Without a canonical, Google may index duplicate versions of the same page (http vs https, www vs non-www, trailing slash vs none), splitting link equity.',
      steps: [
        'Confirm your preferred URL format (e.g. always https://www.example.com/ with trailing slash).',
        'Add a self-referencing canonical tag to every page: <link rel="canonical" href="[preferred URL]" />',
        'In most CMS platforms (WordPress + Yoast/Rank Math, Shopify), this is done automatically — verify it\'s enabled.',
        'For paginated pages (/page/2 etc), canonical should point to the paginated URL, not page 1.',
        'Re-crawl and verify using Screaming Frog → "Canonical" tab.',
      ],
      owner: 'Tech / Dev.',
    },
  },
  {
    keywords: ['redirect', '3xx', 'redirection', 'response codes: internal redirection'],
    guide: {
      what:  'Pages are returning 3xx redirect responses (301, 302, etc.).',
      why:   'Redirect chains waste crawl budget and can dilute link equity. Internal links should always point directly to the final destination URL.',
      steps: [
        'Export the list of redirecting URLs.',
        'Find where these URLs are linked internally (Screaming Frog → "Inlinks" tab).',
        'Update all internal links to point directly to the final destination URL, bypassing the redirect.',
        'If the redirect is intentional (old page moved), ensure it is a 301 (permanent) not a 302 (temporary).',
        'Eliminate any redirect chains (A → B → C should become A → C).',
      ],
      owner: 'Tech / Dev to update redirect rules. Site Content Lead to update internal links in CMS.',
    },
  },
  {
    keywords: ['4xx', '404', 'broken link', 'not found'],
    guide: {
      what:  'Pages are returning a 404 (Not Found) or other 4xx error.',
      why:   '404 pages waste crawl budget and create a bad user experience. If other sites link to these URLs, that link equity is lost.',
      steps: [
        'For each 404 URL, determine: was this page moved, deleted, or never existed?',
        'If moved: set up a 301 redirect from the old URL to the new one.',
        'If deleted permanently: redirect to the most relevant parent page or homepage.',
        'If linked internally: update the internal links in your CMS to the correct URL.',
        'Check Google Search Console → Coverage report to see if Google has flagged these.',
      ],
      owner: 'Tech / Dev to implement redirects. Site Content Lead to fix internal links.',
    },
  },
  {
    keywords: ['5xx', 'server error'],
    guide: {
      what:  'Pages are returning 5xx server errors.',
      why:   'Server errors prevent Google from crawling and indexing affected pages entirely.',
      steps: [
        'Check your hosting/server logs to identify the root cause.',
        'Common causes: database timeouts, memory limits, misconfigured server rules.',
        'Fix the underlying server issue immediately — this is the highest priority.',
        'Once fixed, request re-indexing via Google Search Console → URL Inspection → Request Indexing.',
        'Monitor Screaming Frog or your uptime tool to confirm resolution.',
      ],
      owner: 'Tech / Dev — urgent.',
    },
  },
  {
    keywords: ['noindex', 'excluded from index', 'not indexed', 'indexable url not indexed'],
    guide: {
      what:  'Pages are marked noindex or are being excluded from Google\'s index.',
      why:   'Noindexed pages will not appear in Google search results at all.',
      steps: [
        'Check each URL for a <meta name="robots" content="noindex"> tag.',
        'Also check the X-Robots-Tag HTTP response header.',
        'If noindex is intentional (e.g. thank-you pages, admin pages): no action needed.',
        'If noindex is accidental: remove the tag in your CMS or template.',
        'After fixing, use Google Search Console → URL Inspection → Request Indexing.',
        'For Screaming Frog: check Configuration → Robots → Check Internal Noindex.',
      ],
      owner: 'Tech / Dev to remove the tag. Site Content Lead to confirm which pages should be indexed.',
    },
  },
  {
    keywords: ['sitemap'],
    guide: {
      what:  'Issues detected with your XML sitemap.',
      why:   'The sitemap tells Google which pages exist and should be crawled. A broken or incomplete sitemap slows down indexing.',
      steps: [
        'Visit yoursite.com/sitemap.xml — confirm it loads and lists your key pages.',
        'Submit the sitemap in Google Search Console → Sitemaps.',
        'Check for: pages returning 4xx/5xx in the sitemap, noindexed pages included in the sitemap, or pages missing from the sitemap.',
        'Regenerate the sitemap in your CMS (Yoast, Rank Math, Shopify do this automatically).',
        'Remove any URLs from the sitemap that redirect or return errors.',
      ],
      owner: 'Tech / Dev.',
    },
  },
  {
    keywords: ['schema', 'structured data', 'json-ld'],
    guide: {
      what:  'Pages are missing structured data (schema markup).',
      why:   'Structured data helps Google understand page content and can unlock rich results (star ratings, FAQs, product info) in search.',
      steps: [
        'Identify which schema type is appropriate: Product, Article, BreadcrumbList, FAQPage, etc.',
        'Implement using JSON-LD (Google\'s preferred format) in the <head> of the page.',
        'Use Google\'s Rich Results Test (search.google.com/test/rich-results) to validate.',
        'For WordPress: use Yoast SEO, Rank Math, or Schema Pro plugins.',
        'For Shopify: most themes include basic product schema — verify it\'s complete.',
        'Submit updated URLs to Google Search Console for re-crawling.',
      ],
      owner: 'Tech / Dev to implement. Site Content Lead to provide the content values.',
    },
  },
  {
    keywords: ['internal link', 'internal linking'],
    guide: {
      what:  'Pages have weak or missing internal links.',
      why:   'Internal links pass authority between pages and help Google discover content. Pages with no internal links (orphan pages) may not get crawled.',
      steps: [
        'Identify which pages have the fewest internal links pointing to them.',
        'Add contextual links from high-traffic pages (homepage, category pages, popular blog posts) to these under-linked pages.',
        'Use descriptive anchor text that includes the target page\'s keyword (not "click here").',
        'Review your navigation — key commercial pages should be in the main nav or footer.',
        'Aim for every page to be reachable within 3 clicks from the homepage.',
      ],
      owner: 'Site Content Lead.',
    },
  },
  {
    keywords: ['alt text', 'image alt', 'missing alt'],
    guide: {
      what:  'Images are missing alt text attributes.',
      why:   'Alt text helps Google understand image content and is essential for accessibility. Images without alt text miss out on image search traffic.',
      steps: [
        'For each affected URL, identify the images missing alt text.',
        'Add descriptive alt text that explains what the image shows.',
        'Include a relevant keyword naturally if it fits — don\'t keyword-stuff.',
        'Decorative images (spacers, dividers) should have empty alt="" to be skipped by screen readers.',
        'In WordPress: edit the image in Media Library → Alt Text field.',
        'In Shopify: edit the image → Alt text field in the product/page editor.',
      ],
      owner: 'Site Content Lead.',
    },
  },
  {
    keywords: ['page speed', 'load time', 'core web vitals', 'lcp', 'cls', 'performance'],
    guide: {
      what:  'Pages are loading slowly or failing Core Web Vitals thresholds.',
      why:   'Page speed is a Google ranking factor. Slow pages also have higher bounce rates and lower conversion rates.',
      steps: [
        'Run each URL through PageSpeed Insights (pagespeed.web.dev) to get specific recommendations.',
        'Common fixes: compress images (use WebP format), enable browser caching, minify CSS/JS, use a CDN.',
        'LCP (Largest Contentful Paint): optimise the largest image or text block above the fold.',
        'CLS (Cumulative Layout Shift): add explicit width/height to images and embeds.',
        'Consider using Next.js Image component or a lazy-loading solution.',
        'Target: LCP under 2.5s, CLS under 0.1, INP under 200ms.',
      ],
      owner: 'Tech / Dev.',
    },
  },
  {
    keywords: ['hreflang'],
    guide: {
      what:  'Pages have missing or incorrect hreflang tags.',
      why:   'Hreflang tells Google which language/country version of a page to show to users in different regions.',
      steps: [
        'Map out all language/country variations of each page.',
        'Add hreflang tags to the <head> of every page, including a self-referencing tag.',
        'Ensure every page in a hreflang set links to all other versions bidirectionally.',
        'Validate using hreflang.org checker or Screaming Frog → Hreflang tab.',
        'Common errors: missing x-default, non-matching URLs, broken URLs in hreflang.',
      ],
      owner: 'Tech / Dev.',
    },
  },
  {
    keywords: ['duplicate content', 'near-duplicate'],
    guide: {
      what:  'Multiple pages contain very similar or identical content.',
      why:   'Duplicate content confuses Google about which version to rank and can suppress both pages.',
      steps: [
        'Review the duplicate pages — are they intentionally similar or accidentally so?',
        'If one is the clear "primary": add a canonical tag on duplicates pointing to the primary.',
        'If they should be distinct pages: rewrite each with unique, differentiated content.',
        'If one page is redundant: redirect it to the primary with a 301.',
        'For parameter-based duplicates (e.g. ?color=red): configure URL parameters in Google Search Console.',
      ],
      owner: 'Site Content Lead to rewrite. Tech / Dev to implement canonicals and redirects.',
    },
  },
  {
    keywords: ['robots', 'robots.txt'],
    guide: {
      what:  'Issues detected with robots.txt or robots meta tags.',
      why:   'Robots.txt controls which pages Googlebot can crawl. Misconfiguration can accidentally block entire sections of your site.',
      steps: [
        'Visit yoursite.com/robots.txt and review the Disallow rules.',
        'Use Google Search Console → robots.txt Tester to check specific URLs.',
        'Ensure you are not accidentally blocking /wp-admin/, CSS files, JS files, or key page directories.',
        'If blocking: remove the Disallow rule and submit a new crawl request.',
        'Check that your sitemap URL is listed: Sitemap: https://yoursite.com/sitemap.xml',
      ],
      owner: 'Tech / Dev.',
    },
  },
  {
    keywords: ['blog', 'article', 'editorial', 'content refresh', 'blog refresh'],
    guide: {
      what:  'Blog posts or articles need content improvements or a refresh.',
      why:   'Stale or thin blog content loses rankings over time. Refreshed posts with updated information often see significant ranking improvements.',
      steps: [
        'Check the post\'s current ranking in Google Search Console → Performance → Pages.',
        'Review the top 3 ranking pages for the same keyword — what do they cover that your post doesn\'t?',
        'Update statistics, examples, and any outdated information.',
        'Add new sections to address questions your post doesn\'t currently answer.',
        'Update the "Last updated" date in the post.',
        'Add more internal links from this post to other relevant content.',
        'Re-promote the updated post on social/newsletter.',
      ],
      owner: 'Copy / Blog Lead.',
    },
  },
  {
    keywords: ['security', 'hsts', 'x-frame', 'header'],
    guide: {
      what:  'Security-related HTTP headers are missing.',
      why:   'While not a direct ranking factor, missing security headers can affect site trustworthiness and are flagged by audit tools.',
      steps: [
        'Add the following headers in your server config or CDN (Vercel, Cloudflare, Netlify):',
        'Strict-Transport-Security: max-age=31536000; includeSubDomains',
        'X-Frame-Options: SAMEORIGIN',
        'X-Content-Type-Options: nosniff',
        'Referrer-Policy: strict-origin-when-cross-origin',
        'For Vercel: add these in next.config.mjs under headers().',
        'Validate using securityheaders.com.',
      ],
      owner: 'Tech / Dev.',
    },
  },
  {
    keywords: ['analytics', 'ga data', 'google analytics', 'tracking'],
    guide: {
      what:  'Pages are missing analytics tracking or have no GA data.',
      why:   'Without tracking, you cannot measure traffic, conversions, or the impact of SEO improvements.',
      steps: [
        'Verify Google Analytics / GA4 is installed: open the page, right-click → View Source, search for "gtag" or "G-XXXXXXX".',
        'If missing: install GA4 via Google Tag Manager or direct script.',
        'Check Google Tag Manager is firing on all page types (not just the homepage).',
        'Use Google Tag Assistant Chrome extension to debug.',
        'Confirm data is flowing in GA4 → Reports → Realtime.',
      ],
      owner: 'Tech / Dev to install. Site Content Lead to verify coverage.',
    },
  },
]

const DEFAULT_GUIDE: FixGuide = {
  what:  'This issue was flagged by your audit tool.',
  why:   'Review the issue details and affected URLs to understand the impact.',
  steps: [
    'Review each affected URL manually.',
    'Determine whether this is a technical issue (Dev), content issue (Site Content), or copy issue (Copy/Blog).',
    'Prioritise based on traffic — check Google Search Console to see which affected URLs get the most clicks.',
    'Document your fix plan in the ticket notes before approving.',
  ],
  owner: 'To be determined — check the Owner Bucket and reassign if needed.',
}

export function getFixGuide(issueType: string): FixGuide {
  const lower = issueType.toLowerCase()
  for (const { keywords, guide } of GUIDES) {
    if (keywords.some(k => lower.includes(k))) return guide
  }
  return DEFAULT_GUIDE
}
