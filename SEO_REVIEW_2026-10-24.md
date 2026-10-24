# Search acquisition improvements — October 24, 2026

Baseline: `366a483` on `main`. Production remains the existing GitHub/Vercel site at https://www.sendoragift.com/.

## Observations and scope

- The baseline passes the repository's SEO checks for 120 indexable pages. Production robots.txt, sitemap.xml, the IndexNow verification key, the real-estate page and golf product page return HTTP 200 without an X-Robots-Tag restriction in the checked responses. This is not proof of search-engine indexing or successful crawler access from every network.
- robots.txt already permits OAI-SearchBot and other listed crawlers. GA4 `G-2Y0286VCBM`, conversion events and AI referral classification are already implemented. Do not count these as new work.
- The real-estate page repeats broad occasion/product lists and lacks a detailed closing/handover decision path. The site has no dedicated automotive handover page despite relevant folder, pen and keyring components. The golf page has useful FAQs but no direct link to the original detailed golf sample video.
- Public search checks surface commercial pages for automotive handover products, real-estate closing gifts and golf accessory sets. These observations suggest relevant commercial intent, not verified keyword volume, competition difficulty or a forecast of demand.
- No Search Console, GA4 reporting or hosting crawler-log account data was accessed. The primary cause of low traffic remains unconfirmed. A site: query cannot establish indexed-page totals.

## Changes

1. Add one dedicated car dealership handover page with three configurations, document/fob fit guidance, logo considerations, sample references, six answers and contextual quote links.
2. Rewrite the existing real-estate URL around closing gifts and property handover kits. Keep its URL and distinguish closing documents, key handover and new-home appreciation. Clarify PU material, optional personalization and multi-address delivery scope.
3. Add three golf player-gift directions and a direct original sample-video link to the existing product page. Clearly distinguish optional combinations from shown contents.
4. Add crawlable links from the homepage, solution hub, product catalog, folder and pen pages. Include both handover directions in the existing catalog filters. No duplicate locale/city/keyword pages are created.
5. Include self-canonicals, shared organization identity, breadcrumbs, visible dates and matching FAQ JSON-LD. Update sitemap dates only for content/link changes. FAQ markup does not promise Google FAQ rich results or AI citations.
6. Preserve the selected handover set through both existing inquiry forms, category selection and WhatsApp context. Cache-bust the changed script in its two consumers. Retain endpoints, consent, uploads and existing tracking.

The new pages reuse existing photographs as explicitly labeled component/sample references. They do not invent a completed automotive/real-estate order, fixed price, universal minimum quantity, certification or delivery result. Material and company facts follow SITE_FACTS.md.

## Validation before release

- `node scripts/seo_checks.js`: 121 indexable pages pass; all reachable from homepage; canonical, sitemap, fragment, JSON-LD/visible-answer and image-dimension checks pass.
- `node --test tests/*.test.js`: 64 pass, including both handover directions in both inquiry routes.
- `node --check assets/js/quote-context.js` and `git diff --check`: pass.
- `python scripts/audit_site.py`: no errors. Its stylesheet-name warnings do not recognize the buyer-page stylesheet, which supplies max-width:100% and height:auto. Existing sample/about warnings and admin H1 warning remain.
- The connected browser cannot reach the executor's local preview (`ERR_CONNECTION_REFUSED`); deployment/production visual verification is pending at this checkpoint.
- No real inquiry or outbound WhatsApp message was sent.

## Measurement plan

Establish a baseline from the last complete 28 days before release, and retain the preceding 28 days for context. Export Search Console performance by query, page, country and device, plus the page-indexing report. Use the same filters for later comparisons.

Priority URL/query groups:

| Page | Intended query family | Measure |
| --- | --- | --- |
| /car-dealership-handover-gift-sets.html | car dealership handover gift sets; vehicle delivery gifts; branded document wallet kits | Discovery/indexing, impressions, clicks, qualified enquiries |
| /corporate-gifts-for-real-estate-companies.html | custom real estate closing gifts; property handover gift kits | Existing vs new query coverage, clicks and enquiry conversion |
| /products/golf-tournament-gift-set/ | custom golf tournament gifts; player gift sets; divot tool and marker gift sets | Query relevance, sample visits, qualified enquiries |
| /custom-pu-document-folders.html and /custom-metal-pens.html | custom logo document folders; branded metal pens | Retain existing queries, visits into handover directions |

- First 7–14 days: inspect new/changed URLs in Search Console; check selected canonical and crawl/indexing exclusions. Request indexing of priority URLs when available. Verify sitemap submission and review legitimate crawler failures in hosting logs.
- After 28 complete days: compare impressions, clicks and qualified enquiries; separate branded from non-branded queries and country/device mix. A new URL has no equivalent pre-release baseline, so compare it by cohort rather than claiming percentage growth from zero.
- Impressions absent: investigate discovery, crawl access, canonical/indexing and relevance before adding more pages. Impressions with low positions: strengthen the matching product evidence and answer the actual queries. Relevant impressions with weak CTR: compare the title/description with the query. Visits without enquiries: examine product fit, destinations, form use and offer clarity.
- In GA4 compare organic search landing sessions and existing generate_lead / whatsapp_click events. A WhatsApp click is not a completed enquiry. AI referral categories capture only observable referrals/UTMs; missing referrers and zero-click answers prevent a complete AI-visibility count.
- The previously documented IndexNow engine-side 403 is not resolved or hidden by this change. The public key returning 200 does not establish submission acceptance. IndexNow is not a Google indexing mechanism.
- External discovery follow-up: align the existing Alibaba/company profile information and use relevant genuine partner/event links where relationships exist. Do not purchase links, fabricate reviews or mass-post AI articles. Such outreach is not performed in this release.

## Primary references

- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- https://developers.openai.com/api/docs/bots

No indexing, ranking, citation, traffic or revenue gain is asserted by this release.
