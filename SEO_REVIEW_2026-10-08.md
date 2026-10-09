# Sendora Gift deep website and SEO/GEO review — 2026-10-08 to 2026-10-09

This continuation starts from `main` at `8d0f2480121a062e652555ce9ceeab60729200fb`, after PR #63 was merged. The changes below are prepared in draft PR #64. They have not been merged into production by this review.

## Findings and corrections

| Finding | Correction |
| --- | --- |
| Five indexable pages could not be reached by following indexable links from the homepage. A self-link or a link from another disconnected page had masked the problem in a basic incoming-link count. | Link the existing Solutions hub from the homepage and blog directory. All 120 indexable pages are now reachable from the homepage. |
| Ten links across eight indexable pages pointed to permanent redirect sources. | Point them directly to the existing canonical destinations. Keep any query parameters and fragments; preserve the redirect rules for older external links. |
| Eighteen article or guide pages lacked an article-schema image. | Add a relevant existing image. Five planning-reference pages now show a corresponding product arrangement with an explicit illustrative caption instead of using a generic share image. Connect Sendora Gift author/publisher data to the existing organization identity. |
| The blog directory classified a root procurement guide as BlogPosting and described only a partial article inventory. | Describe the directory as CollectionPage and ItemList. List all 26 visible news/blog articles, with unique URLs and sequential positions; retain other procurement guides as normal visible links. |
| Five illustrative case pages used completed-order language such as a buyer having approved artwork or goods having been packed. One also gave a generic 3–5 week production estimate. | Rewrite those passages as planning instructions, retain illustrative quantities and disclosures, and remove the generic schedule. Match their article headlines to the displayed sample-plan headings and show the revision date. |
| The homepage presented a representative collage as “REAL PROJECT PROOF”. | Label it as a reference arrangement and link buyers to the existing original physical sample records. |

## Further entity and article review — October 9, 2026

| Finding | Correction |
| --- | --- |
| Ninety-two indexable pages used buyer roles such as procurement teams, HR teams and sourcing agents as Organization `areaServed`. That property describes a geographic service area. | Use the existing homepage value, `Worldwide`, rather than the buyer-role array. No new countries, delivery guarantees or local offices are claimed. |
| Thirty-four indexable articles did not display a clear company byline and labeled date. | Show a linked Sendora Gift byline with the existing publication date and, when different, the existing editorial revision date. Move duplicate dates out of quick-answer panels and category labels. Preserve all original article dates. |
| Sixteen article author/publisher objects named the company without its shared organization identity. | Connect both fields to the existing `https://www.sendoragift.com/#organization` entity and its homepage URL. The complete company entity already appears on these pages. |
| Twenty-five article pages used the generic website Open Graph type. | Set their share type to `article`, consistent with their Article/BlogPosting content. |

All 40 indexable articles now have visible authorship, a labeled date matching their schema, an identifiable company author/publisher and the article share type. No additional news article was duplicated: the October 8 folder-and-pen resource update remains the one new article in this PR.

The sitemap revision date changes on 97 edited HTML pages reflect changes to visible bylines, share metadata or structured company data. Historical Article `datePublished` and `dateModified` values are unchanged on all 40 articles; metadata repairs do not pretend to be new editorial publications.

The checker now also rejects buyer roles used as service geography, disconnected article author/publisher identities, incorrect share types, absent bylines and visible dates that conflict with structured or displayed dates. Running it against the previous PR source detects all of these pre-existing problems. Date-label checks use an explicit UTC day so the result does not depend on the machine timezone.

## New English news article

- Title: **New Buyer Guides for PU Document Folders and Metal Pens**
- Canonical route: `/blog/pu-document-folders-metal-pens-buyer-guide-update.html`
- Publication date: October 8, 2026; author and publisher: Sendora Gift.
- Content: a factual company resource update explaining folder structures and loaded fit, engraving versus printing, two-logo positions, pen-case visibility, approval evidence and RFQ inputs.
- Includes a quick answer, comparison table, visible buyer questions, labeled illustrative image, navigation and inquiry links.
- Adds NewsArticle, WebPage, BreadcrumbList, FAQPage, Organization and WebSite data, plus canonical, Open Graph and Twitter metadata. The FAQ data matches the displayed questions and answers.
- Featured first in the blog directory and linked from both relevant product pages. The article is two clicks from the homepage and has inbound links from three separate pages.
- Registered in both existing sitemaps and the optional `llms.txt` directory. Sitemap modification dates reflect the pages changed in this review; historical publication dates are preserved.
- No product launch, confirmed inventory, customer shipment, certification, fixed price, universal MOQ or guaranteed lead time is claimed.

## Verification

| Check | Result |
| --- | --- |
| `node scripts/seo_checks.js` | Pass: 120 indexable pages; all reachable from the homepage |
| Existing `node --test tests/*.test.js` | Pass: 42 tests, zero failures |
| `python scripts/audit_site.py` | Zero errors; seven existing heuristic warnings |
| Internal links and fragments | No broken links or fragments found |
| Edited HTML | No nesting mismatches found on the 97 HTML pages edited in the October 9 continuation |
| Images in indexable HTML | No missing alt attributes or dimension attributes |
| Repository resource references | 799 same-origin HTML asset references checked against local files and the remote asset inventory in the continuation; zero unresolved paths |
| Inquiry markup | All 19 forms on the edited HTML pages are byte-for-byte unchanged |
| Directory and news data | 26 visible article links agree with the directory schema; the new article has matching dates, canonical identity and visible FAQ text |
| Article provenance and service geography | Pass: 40 articles with matching visible authors/dates and shared company identity; 92 buyer-role service-area values corrected; all 40 original article dates preserved |
| Checker against the merged baseline | Correctly rejects the disconnected five-page cluster, redirect links, missing article images and legacy directory markup |
| Checker against the previous PR source | Correctly rejects 92 service-area defects, 25 share-type defects, 16 disconnected authors and publishers, and 34 missing bylines/labeled dates |
| `git diff --check` | Pass |
| Live production observations | Homepage logo is white and the earlier hero background correction is deployed. Homepage, blog, contact, PU-folder and metal-pen pages load; no horizontal overflow or broken completed image loads observed in the inspected desktop views. Contact has the existing POST endpoint, multipart upload and required fields. |

The seven heuristic warnings are unchanged: image-ratio guard detection on five sample pages and About, and two H1 tags in the non-indexable admin page. Dedicated image styling and noindex behavior require contextual interpretation; these warnings are not treated as new failures.

The permanent checker now validates explicit canonicals, canonical/Open Graph agreement, article image presence and date ordering, directory-list consistency, both sitemap inventories, direct canonical internal links, same-page fragments and crawl reachability. Existing FAQ, accessibility-label, title, description and inquiry-form checks remain.

## Limits

- Production observations cover the existing live version. The new article and this continuation need the owner's merge before they appear on the public domain.
- Earlier Vercel preview access required authentication in this browser. Access verification of the new PR preview timed out; the previous content commit's two deployment checks succeeded. A local preview attempt also failed because this browser could not reach the workspace service. Desktop/mobile visual inspection of the continuation remains unverified.
- Inquiry tests mock email, database and challenge services. No real inquiry was submitted and actual inbox delivery was not tested.
- Search Console/GA4 reports, crawler HTTP responses for XML/TXT files, provider credentials, Vercel domain binding and Cloudflare configuration were not inspected. Index coverage, rankings, traffic changes and AI citations are not measured.
- Resource-path and dimension-attribute checks do not decode every binary asset or prove every asset's production response.
- Structured-data checks here are repository checks, not a completed Google Rich Results Test.

These improvements make the site's content and discovery paths clearer; they do not guarantee rankings, indexing or AI citations. `llms.txt` remains an optional directory, not a Google ranking requirement.

References: [Google article structured data](https://developers.google.com/search/docs/appearance/structured-data/article), [Google publication dates](https://developers.google.com/search/docs/appearance/publication-dates), [Google canonical URL consistency](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites), [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features), [Schema.org areaServed](https://schema.org/areaServed), [Schema.org ItemList](https://schema.org/ItemList).
