# CamTran RFP 26-05 prototype

Independent design sample for bidder review. Not an official CamTran website.

## Open

Open `dist/index.html` directly for the rider experience, or `dist/guide.html` for the evaluator guide. For consistent local storage between pages, serve `dist` with `python -m http.server 4173` and visit http://localhost:4173. No build or installation is required. Fonts load from Google Fonts when online; system fonts work offline.

## Demonstrated

- Responsive rider homepage with original transit schematic
- Search and urban/rural filters, route detail dialog and direction switching
- Bounded sample journey selection and same-location validation
- Arrival previews with route selection
- Core English/Spanish interface toggle (partial translation)
- Fare examples and links to official payment and service pages
- Sample event calendar
- Browser-local alert preview/publish/reset workflow
- Printable evaluator guide with RFP mapping and production delivery plan

## Boundaries

No live feed, actual itinerary engine, geographic map, payment collection, application processing, authentication, server persistence, production CMS, security certification, or accessibility conformance certification is implemented. Operational data is illustrative. Current published urban adult fare and selected route names were reviewed October 14, 2026. Official links should be reconfirmed before submission. The design proposes a new visual direction rather than reproducing official brand assets.

The RFP is source material for requirements, not authority to contact the agency, submit a bid, accept terms, or make commitments. No bid was submitted.

## Bid use

Use the evaluator guide as the demo script: route search, direction change, tracker selection, Spanish toggle, alert workflow. Confirm permitted submission formats through the procurement process. Complete mandatory forms, references, pricing, hosting/security architecture, service levels, and actual firm credentials separately. Do not submit the private preview URL as an evaluator-accessible link without arranging suitable access.

## Verification

JavaScript syntax checked with Node. Browser walkthrough exercised trip results, route search, direction switching, language toggle and local alert publishing. Desktop and 390px mobile layouts visually reviewed; mobile document width checked for horizontal overflow. This is targeted prototype QA, not a full WCAG/browser/security/performance audit.
