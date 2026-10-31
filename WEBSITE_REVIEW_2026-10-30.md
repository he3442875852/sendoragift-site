# Sendora Gift buyer journey update — 30–31 October 2026

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
- Update sitemap lastmod for the pages with substantive content edits in each phase.
- Preserve conditional MOQ wording; no gift-box measurements or unconfirmed product specifications were introduced.

## Validation

- `node --test tests/*.test.js`: 80 passing tests, including combined catalog filtering, navigation disclosures, inquiry context, email payload and postal-code persistence.
- `node scripts/seo_checks.js`: 122 indexable pages passed, all reachable from the homepage.
- `git diff --check`: passed.
- Browser QA: desktop navigation and catalog filters, the dealership configuration-to-inquiry flow, quantity and packing hydration, visible selected-brief summaries, the golf sample video panel, collapsed concept galleries and the sample-hub section order.
- Responsive iframe QA: the first phase covered 390px and 800px outer widths. The detail-page follow-up verified the 390px configuration-to-inquiry flow, selected-brief wrapping and page-width checks. These are responsive layout checks, not physical-device tests.
- Inquiry email and persistence verified with mocked services; no test email was sent to the live mailbox.

## Measurement after publication

Use Search Console to compare qualified impressions and clicks by existing landing page, and GA4 to compare product visits, WhatsApp clicks and successful inquiry submissions. Interpret results alongside publishing dates, campaigns and seasonality. The existing attribution and successful-inquiry tracking are retained and extended with bounded product/configuration context. See MEASUREMENT_PLAN_2026-10-31.md for event definitions and account-side checks that have not yet been performed.

## Detail-page follow-up — 31 October 2026

- Eight core set pages now offer three product-specific configuration starting points, quantity and packing preferences. These replace the repeated five-card fact section; the new sample-reference panels replace the repeated generic bulk-gifting block.
- The metal-pen and PU-folder pages have their own presentation/structure selectors in place of generic use-case cards.
- Dealership and property-handover pages now have selectable configurations and distinct approval/allocation workflows. Golf planning now covers recipient allocation, artwork approval and packed-component counts.
- The sample hub prioritizes three existing physical photo records and one physical video record before general component references. Product evidence panels state what each reference shows and what remains to be confirmed; the pickleball illustration is explicitly labeled as such.
- Configuration selections continue into the existing contact form with a visible summary, quantity and proposed items. The same context reaches WhatsApp and the existing inquiry message. Unknown or mismatched configuration IDs are ignored, and buyer-written messages are preserved.
- GET search/selection forms no longer receive hidden lead identifiers or attribution fields from the inquiry tracker. The existing POST inquiry forms keep their attribution handling.
- Added product/detail, configuration, reference, video and inquiry-start events. Successful inquiry and WhatsApp events can carry bounded product/configuration IDs. No live performance outcome is claimed; GA4 custom-dimension setup and account data access remain outstanding.
- Existing URLs, images, anti-spam handling, upload limits, contacts and conditional commercial specifications are preserved. There is no hosting or database migration.

## Final verification for the combined submission

- All 12 configuration forms expose exactly three recognized product-specific options with one initial selection; all 36 option IDs resolve correctly.
- The contact summary uses valid block markup and preserves line breaks. Buyer-edited messages remain intact when a product is changed.
- 80 automated tests pass; SEO checks pass for 122 indexable pages; whitespace checks pass.
- Browser interaction checks used local preview copies with production analytics initialization disabled. The final inquiry email and database handling were tested with mocked services; no live message was sent.
- The changes are prepared for the existing PR #77. Production publication is separate from the combined source submission.

## Commercial-hub follow-up — 31 October 2026

The next pass studies Luxopack's catalog, corporate industry page, detailed magnetic-box specification page, cases, documentation and buying guides. It connects Sendora's previously improved detail pages through five rebuilt hubs: solutions, single logo products, company/procurement checks, packaging and the guide directory. A shared responsive layout prioritizes product categories, purpose-specific confirmation points, physical sample references, packaging tradeoffs and guides by purchase stage. The existing packaging form, sample anchors, article URLs, publication dates and structured FAQ text are preserved. Eight product-category cards, six occasion routes, four packing formats and four guide stages now lead to existing detail pages and evidence.

Research observations, implementation mapping and verification limits are documented in `LUXOPACK_ARCHITECTURE_REVIEW_2026-10-31.md`. All 80 automated tests and 122-page SEO checks pass. Additional source checks confirm one H1 per hub, unique IDs, valid in-page links and unchanged packaging form contracts. Browser QA covers five mobile iframe widths, menu navigation, local table scrolling, the old sample-photo fragment, the 16-card article directory and packaging form input without submission. These changes extend the same PR without production publication or traffic-result claims.

## Inquiry reliability follow-up — 31 October 2026

The fourth pass fixes the final inquiry step rather than adding another content section: keyboard navigation and complete validation in the three-step quote, explicit API success confirmation, bounded request waiting, in-page verification retries, attachment feedback/removal, safe error recovery and hidden spam traps. A shared upload-limit module keeps public form configuration and server enforcement aligned. Twenty-three form pages refresh the shared script version. Existing endpoints, server-side verification, attachment checks, upload limits, contacts and production hosting remain in place.

All 93 tests and 122-page SEO checks pass. Browser QA verifies Enter advancement, simulated unconfirmed-response recovery, verification initialization retry without losing the name, oversize-file rejection/removal and a mobile iframe without horizontal overflow. No live inquiry email was sent. See `INQUIRY_RELIABILITY_REVIEW_2026-10-31.md` for the issue-to-fix mapping, tests and verification limits.
