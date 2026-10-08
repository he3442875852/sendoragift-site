# Sendora Gift website and SEO/GEO review — 2026-10-08

Base: `main` at `71710abe9bd87b0f7ce809f8a382ce2e5136307c`. Changes are proposed in a draft PR; production is not changed by this review.

## Findings and corrections

| Finding | Correction |
| --- | --- |
| 12 indexable pages contained FAQ content that differed from the displayed questions or answers, or declared duplicate FAQ nodes. | Synchronize the FAQ data to the existing visible questions. Consolidate drinkware FAQ data into one node and remove its repeated visible question. |
| The homepage brand inherited a dark anchor color on its dark header and footer. | Make the homepage logo selector specific enough to preserve its light color while retaining the scrolled header state. |
| The desktop hero diagonal placed some light trust-list text over the light background. | Use a vertical background split that stays outside the copy column. |
| Homepage hero `aria-labelledby` referenced an absent `home-title`. | Restore the matching H1 ID. |
| The shared buyer-question wrapper retained three columns below the mobile breakpoint. | Include that wrapper in the existing one-column responsive rule. |
| PU folder and metal pen buying pages needed more specific specification and artwork guidance. | Add comparison tables, sample/packaging checks, RFQ fields and two new visible questions per page. Preserve model-dependent MOQ, pricing and timing. |

FAQ corrections cover employee appreciation, custom mug sets, coffee-break sets, wellness kits, budget sets, compact sets, drinkware, custom gifts, sample projects and three related blog articles. Existing Organization, Service, WebPage and BlogPosting nodes are retained.

## SEO/GEO improvements

- PU folders: distinguish paper format from external dimensions; compare opening folders, pouches and portfolios; specify centering relative to a flap, seam or edge; approve debossing on the actual PU surface and measure the loaded folder before box approval.
- Metal pens: distinguish engraving contrast from printed color; compare logo methods; review two marking positions and final visibility in the pen case; confirm the exact mechanism and refill.
- Update the two pages' visible revision dates and WebPage `dateModified`, plus affected sitemap entries and existing `llms.txt` buyer guidance.
- Enhance `scripts/seo_checks.js` to reject invalid JSON-LD, multiple FAQPage nodes, FAQ questions/answers absent from visible text, repeated schema questions and broken `aria-labelledby` references.
- No new landing-page URLs are added. Existing canonicals, redirect rules, contact details, inquiry endpoints, tracking and anti-spam logic are preserved.

These changes improve clarity and consistency. They do not guarantee rankings, indexing, rich results or AI citations. `llms.txt` is an optional directory, not an indexing requirement or a Google ranking mechanism.

## Verification

| Check | Result |
| --- | --- |
| Enhanced `node scripts/seo_checks.js` | Pass: 119 indexable pages |
| Existing `node --test tests/*.test.js` | Pass: 42 tests, zero failures |
| `python scripts/audit_site.py` | Zero errors; seven existing heuristic warnings |
| Repository resource references from HTML | 787 references checked against the source tree; zero unresolved paths |
| Baseline static audit | No duplicate titles/descriptions/H1, missing canonicals, broken internal links/anchors, invalid JSON-LD syntax, sitemap omissions or orphan indexable pages |
| Enhanced checker against the unmodified baseline | Correctly rejects the known FAQ defects, duplicate FAQ node and missing hero label |
| `git diff --check` | Pass |
| Live desktop homepage and contact page | Loaded, no broken loaded images observed; contact and upload controls present; no site-origin console errors observed |

The seven existing heuristic warnings concern image-ratio guard detection on five sample pages and About, plus two H1 elements in the non-indexable admin page. They are not newly introduced errors.

## Verification limits and release checks

- The test suite mocks email, database and challenge services. No real inquiry was submitted, so actual inbox receipt and production provider credentials are not verified.
- Terminal access to the public origin timed out. The browser client refused `robots.txt`, and the search reader could not retrieve the XML/TXT endpoints. Their source syntax/configuration was checked, but their production HTTP status and crawler access were not established. These client failures do not prove the website is unavailable.
- Search Console and GA4 account reports are not available in this session. Actual index coverage, traffic changes, conversion totals and AI visibility were not measured.
- The base commit has successful status checks from two Vercel projects. Production branch, root directory, domain binding and Cloudflare settings were not inspected; a successful check alone does not establish which project serves the domain.
- Binary assets were not downloaded or decoded. Resource-path checks do not verify every asset's production status or intrinsic dimensions.
- Review the PR preview on desktop and mobile before merging. After the owner's merge, verify the production homepage, the two revised product pages, sitemap delivery and one explicitly marked test inquiry if desired.

References: [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features) and [Google generative AI search optimization guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
