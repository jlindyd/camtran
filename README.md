# CamTran RFP 26-05 proof of concept (DYD)

Independent design sample for bidder review. Not an official CamTran website. No bid has been submitted.

## Run

No build or install. Serve `dist` and open the pages:

```bash
cd dist && python -m http.server 4173
```

- http://localhost:4173/index.html: rider site
- http://localhost:4173/admin.html: CMS editor demo
- http://localhost:4173/guide.html: evaluator guide / demo script

Opening the files directly (`file://`) also works. Fonts load from Google Fonts online; system fonts are used offline.

## Architecture

```
dist/
  index.html, app.js, style.css   Public site. Reads content ONLY through window.CMS.
  admin.html, admin.js, admin.css  Editor UI. Also uses ONLY the public CMS API.
  cms/adapter.js                   The seam: providers, workflow rules, history, audit.
  cms/content.js                   Seed content for the mock provider (sample data).
```

`CMS.configure({ provider: 'mock' | 'rest', baseUrl, headers })` selects the provider. The mock provider overlays browser-local edits on the seed content. The `rest` provider maps the same calls to the DYD CMS HTTP API, so connecting the real CMS changes no site or editor code.

### REST contract the `rest` provider expects

All bodies are JSON. Translatable fields are `{ "en": "...", "es": "..." }`.

| Call | Request | Response |
|---|---|---|
| list a collection | `GET {base}/{collection}` (alerts, news, events, routes, fares) | array of items |
| create | `POST {base}/{collection}` body `{ item, actor }` | saved item |
| update / workflow move | `PUT {base}/{collection}/{id}` body `{ item, actor }` | saved item (version incremented) |
| versions | `GET {base}/{collection}/{id}/versions` | `[{version, at, by, role, status, snapshot}]` newest first |
| audit | `GET {base}/audit` | `[{at, by, role, action, target, status}]` |

Item `status` is one of `draft`, `in_review`, `approved`, `published`, `archived`. In production the server must enforce role permissions and return only published items to anonymous visitors; the client checks are for demo UX, not security.

## Demonstrated

- Responsive rider homepage with original transit schematic (not a geographic map)
- Dynamic service alerts and an emergency banner, severity ordering, scheduled start/end windows, multi-alert detail dialog
- News and announcements, event calendar, fares, routes: all CMS-driven
- Complete English/Spanish switching, including CMS content (parity required by the editor before saving)
- Route search, urban/rural filter, route detail with direction switching, sample trip result, arrival preview
- CMS editor: roles (editor, approver, administrator), draft → review → approve → publish, version history with restore, audit log, preview, live update of the public site across tabs
- Keyboard-operable tabs (arrow/Home/End), skip link, dialog focus return, labelled controls, `aria-live` results

## Boundaries

No live GTFS/GTFS-Realtime feed, itinerary engine, geographic map, payment collection, authentication, server persistence, production hosting, security certification or accessibility conformance certification is implemented. Operational data is illustrative. Fare amounts and route names were reviewed against the current public site on October 14, 2026 and must be reconfirmed before submission. The design is a new visual direction and does not reproduce official brand assets.

The RFP is source material for requirements. Mandatory forms, bonds, references, pricing, hosting/security architecture and service levels must be completed separately. Do not share a private preview URL with evaluators without arranging suitable access.

## Verification

JavaScript syntax checked with Node. Exercised in a browser: CMS publish/transition rules, role enforcement, live banner update, Spanish switch including CMS content, editor validation, version history and audit log; no console errors; no horizontal overflow at 375px. This is targeted prototype QA, not a full WCAG, browser, security or performance audit.

## Refined demonstration

Published revisions remain visible while drafts are edited or restored. Publication replaces the live revision only after review and approval. The REST backend must implement the same revision semantics and anonymous published-content projection; the adapter does not provide production authorization. Alerts use America/New_York date windows and refresh every 30 seconds in visible tabs. The route detail includes an illustrative stop schematic, route notices, sample weekday/Saturday times and a labeled CSV download. No geographic or operating data is implied by these examples.
