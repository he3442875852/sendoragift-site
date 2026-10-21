# Sendora Gift search and buyer-answer improvements — October 21, 2026

Baseline: `main` at `5b639d2900007f7ed0734a0d139b45f124e967d7`.

The initial technical check passed for all 120 indexable pages. This iteration improves the existing procurement content and its connections rather than expanding the URL inventory.

## Changes

- Reorganize `corporate-gift-answers.html` into six buyer topics with 24 questions. Replace the visible “AEO” label and development-oriented instructions with purchasing guidance. Add direct links to detailed guides and company information.
- Replace generic FAQs with six topic-specific answers on each of the MOQ, logo methods, order timeline, sample approval and international shipping guides.
- Add one accessible comparison table to each of those five guides: component-level MOQ drivers, logo methods, approval stages, sample types and shipment options. Add practical checks without inventing fixed prices, universal minimums or delivery promises.
- Clarify that DDP is a delivery term, separate from the mode of transport. Link the shipping explanation to the ICC source.
- Make the questions available in server-delivered HTML. Add stable question anchors and a small script that opens a directly linked answer; the content remains readable without JavaScript.
- Generate matching FAQ markup from the same question/answer pairs used in the rendered HTML. Remove generic Service nodes from these editorial pages; keep Article metadata for the five guides and FAQPage metadata for the answer hub. Match the visible breadcrumb hierarchy, authorship and revised dates.
- Reuse the existing responsive navigation on the six edited pages. Add page-topic navigation and keyboard-accessible horizontal scrolling for comparison tables.
- Link the answer hub and shipping guide from the homepage and display the confirmed operating company in the homepage footer.
- Change sitemap lastmod only for the seven revised HTML pages. Preserve URLs, redirects, contact details, product imagery, inquiry endpoints and tracking behavior.

## Validation before publication

- `node scripts/seo_checks.js`: passes for all 120 indexable pages, including sitemap, canonical URL, internal link, fragment, FAQ text and article metadata checks. All pages remain reachable from the homepage.
- `node --test tests/*.test.js`: 61 passed, 0 failed. These existing tests use mocks; they do not send live inquiries.
- `node --check assets/js/buyer-answers.js`: passes.
- HTML parser review: no duplicate IDs on the six revised guides; every question ID in JSON-LD resolves to an HTML answer.
- `git diff --check`: passes.

## Measurement and limits

These changes improve content clarity and technical consistency; they do not establish indexing, rankings, AI citations or conversion gains. Existing source tracking already recognizes AI referrals. Measure the revised URLs in Search Console and the existing lead reporting after crawlers revisit them, comparing impressions, clicks, inquiry submissions and recorded referral sources. No Search Console account data was accessed in this review.

FAQ markup is kept consistent with visible content. It is not a promise of Google FAQ rich results, which Google limits to eligible authoritative government and health sites. No special AI markup or llms.txt change is presented as a ranking requirement.

## References

- [Google: optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Google: general structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google: FAQ and HowTo rich result changes](https://developers.google.com/search/blog/2023/08/howto-faq-changes)
- [ICC: DDP and EXW explained](https://academy.iccwbo.org/incoterms/article/incoterms-2020-exw-or-ddp/)

Business facts are preserved from `SITE_FACTS.md`. Product and sample descriptions remain references rather than invented completed-order evidence.
