# Sendora Gift buyer journey update — 30 October 2026

The homepage and core catalog previously linked to useful resources, but visitors had to scroll or search to find occasion pages and purchasing guidance. This update exposes those paths in navigation, adds occasion filtering to the existing catalog, and helps buyers compare gift formats before requesting options.

## Reference review

Reviewed the public LuxoPack homepage, product catalog, jewelry application guide, magnetic-box product page and quote page on 30 October 2026:

- https://luxopack.com/
- https://luxopack.com/products
- https://luxopack.com/industries/custom-jewelry-packaging-boxes
- https://luxopack.com/products/custom-magnetic-rigid-gift-box-manufacturer
- https://luxopack.com/quote

| Observed approach | Application to Sendora |
| --- | --- |
| Separate product and industry routes | Product, occasion and buying-guide navigation on the homepage and 29 existing core pages |
| Product cards support purchasing decisions | Twenty catalog cards identify suitable recipients and what needs confirmation |
| Comparison tables explain specification choices | Homepage compares compact gifts, welcome kits, handover gifts and golf event gifts |
| Commercial pages connect to procurement guidance | Navigation exposes budget, MOQ, logo, sample, timeline and shipping resources, plus the buying-question hub and blog |
| Quote page collects project context | Preserve selected-product prefilling and add an optional postal code to the contact brief, email and saved inquiry destination |

The competitor's traffic, conversion rate and search performance are not available from public page inspection. These changes address observed navigation and buying-information gaps; they do not establish a traffic uplift. Competitor statistics, prices, certifications, delivery promises and imagery were not imported.

## Scope

- Preserve the existing deep-green, ivory and bronze brand palette and current product images.
- Render navigation links in HTML, with native disclosure menus, keyboard Escape support, focus return, outside-click dismissal and a mobile/tablet menu.
- Add catalog occasion facets that combine with product type and search. Restore filters from URLs; retain attribution parameters and reset all filters together.
- Keep all existing product URLs and inquiry endpoints. No hosting migration or new content pages.
- Synchronize catalog ItemList schema with the twenty visible items (previously eighteen).
- Update sitemap lastmod for the three substantive content changes: homepage, catalog and contact.
- Preserve conditional MOQ wording; no gift-box measurements or unconfirmed product specifications were introduced.

## Validation

- `node --test tests/*.test.js`: 68 passing tests, including combined catalog filtering, navigation disclosures, inquiry context, email payload and postal-code persistence.
- `node scripts/seo_checks.js`: 122 indexable pages passed, all reachable from the homepage.
- `git diff --check`: passed.
- Browser QA: desktop navigation, catalog filters and reset, selected golf-set inquiry context, and optional postal-code visibility.
- Responsive iframe QA at 390px and 800px outer widths: menu behavior, keyboard dismissal, stacked catalog controls, and page-width checks. These are responsive layout checks, not physical-device tests.
- Inquiry email and persistence verified with mocked services; no test email was sent to the live mailbox.

## Measurement after publication

Use Search Console to compare qualified impressions and clicks by existing landing page, and GA4 to compare product visits, WhatsApp clicks and successful inquiry submissions. Interpret results alongside publishing dates, campaigns and seasonality. The current analytics implementation is retained.
