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
  live.html, live.js, live.css     Full-screen live tracker page: route picker, map, departures, buses, stops.
  transit/transit-adapter.js       Second seam: operational data (routes, vehicles, stops, arrivals, messages).
  transit/sample.js                Recorded, sanitized snapshot used as the fallback/offline provider.
tools/make-snapshot.cjs            Re-records transit/sample.js from the public feed.
verify-cms.cjs, verify-transit.cjs Node tests (no dependencies).
```

### Transit adapter and live tracker

`TRANSIT` is separate from `CMS` on purpose: editorial content has revisions and approvals; operational data is read-only and machine-generated. Providers: `auto` (default: live feed, falling back to the recorded sample if it fails), `live` (errors surface) and `sample` (offline). The live provider reads CamTran's public myStop (Avail InfoPoint) JSON service, which allows cross-origin reads. In production the same adapter would point at the agency's GTFS-Realtime/AVL integration.

- Every record is rebuilt from an allow-list of fields. The vendor vehicle feed includes driver names and IDs; these are never copied, rendered or stored (covered by `verify-transit.cjs`, which also asserts the snapshot contains none).
- The page always shows whether data is **LIVE** or **SAMPLE DATA** (with the reason and recording time). When the feed is down, a recorded service notice is never presented as a current alert.
- Polling runs only while the tab is visible: vehicles every 15 s, arrivals every 20 s, notices every 60 s. Vehicles with no signal for 10 minutes are left off the map and flagged in the vehicle table.
- The map is not the only way to read the data: the vehicle list is a real table, and the map is keyboard operable.
- Active myStop notices are shown beside CMS alerts, labelled with their source.
- **The live tracker is its own full-screen page (`live.html`).** The home page links to it from the header, the "Track a bus" tab, a short call-to-action section and every route row; deep links work (`live.html?route=9&dir=I&stop=271`). A sidebar holds a searchable route picker, direction toggle, stop picker, next departures, buses on the route (click one to find it on the map), the ordered stop list (click one to select it and pan to it) and notices from the CMS and myStop; the map fills the rest of the screen (on phones it stays pinned above the panel). "Show all buses" returns to the whole-system view. The route directory is the 22 feed routes; the CMS supplies editorial text where it has it. Real timetables are not reproduced; the page links to the official schedules.
- External dependencies: Leaflet 1.9.4 from cdnjs and OpenStreetMap tiles (attribution shown). Subresource-integrity hashes are not set; add them before production.

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
- Full-screen live tracker page: all 22 routes, route trace and stops on a map, live vehicle positions and status, next departures at a chosen stop, deep links, automatic fallback to a recorded sample (per-dataset LIVE/SAMPLE labels)
- Route search and urban/rural filter over the live directory, route pages with direction switching on the live tracker page, sample trip result
- CMS editor: roles (editor, approver, administrator), draft → review → approve → publish, version history with restore, audit log, preview, live update of the public site across tabs
- Keyboard-operable tabs (arrow/Home/End), skip link, dialog focus return, labelled controls, `aria-live` results

## Boundaries

The tracker reads CamTran's public myStop feed, an undocumented vendor service that could change or restrict access; it is not a GTFS/GTFS-Realtime integration, and its estimates are not validated. No itinerary engine, payment collection, authentication, server persistence, production hosting, security certification or accessibility conformance certification is implemented. The trip planner and CMS content remain illustrative, and timetables are not reproduced (official links only); tracker data is live or clearly labeled sample data. Fare amounts and route names were reviewed against the current public site on October 14, 2026 and must be reconfirmed before submission. The design is a new visual direction; it uses CamTran's public logo for illustration (see the brand section below).

The RFP is source material for requirements. Mandatory forms, bonds, references, pricing, hosting/security architecture and service levels must be completed separately. Do not share a private preview URL with evaluators without arranging suitable access.

## Verification

JavaScript syntax checked with Node. Exercised in a browser: CMS publish/transition rules, role enforcement, live banner update, Spanish switch including CMS content, editor validation, version history and audit log; no console errors; no horizontal overflow at 375px. Transit adapter covered by `node verify-transit.cjs` (normalizers, driver-data allow-list, notice windows, live/sample fallback); the live tracker was exercised against the real feed and with the feed blocked. This is targeted prototype QA, not a full WCAG, browser, security or performance audit.

## Refined demonstration

Published revisions remain visible while drafts are edited or restored. Publication replaces the live revision only after review and approval. The REST backend must implement the same revision semantics and anonymous published-content projection; the adapter does not provide production authorization. Alerts use America/New_York date windows and refresh every 30 seconds in visible tabs. Route detail pages now use live route data (see the transit adapter section); the earlier illustrative schematic, sample times and CSV download were removed because real stops and departures replace them.

## Tracker reliability refinement

Each returned dataset carries its own provenance. Vehicle and arrival badges are independent; recorded data cannot become live because another endpoint succeeds. Requests carry selection tokens, route details filter departures by direction, and all mapped stops are selectable. Scheduled and estimated departures are distinguished. Vehicle reports include timestamps, demo notices are explicit, the map expands on demand, and route details transfer their selection to tracking. Run `node verify-transit.cjs`, `node verify-selection.cjs` and `node verify-cms.cjs`. Production must use a supported vendor agreement, a filtering/caching server, monitoring, licensed tiles, and validated accessibility. Browser field filtering does not prevent raw vendor responses from reaching the browser.

## Full-screen tracker verification

The full-screen tracker filters departures by selected direction and labels schedule-only results. CMS sample notices are explicitly marked in English/Spanish. Stale buses remain listed as No recent signal but are excluded from map positions. Every route stop is selectable. `node verify-selection.cjs` now exercises live.js, including A-to-B-to-A delayed responses, direction filtering, scheduled labels, stale handling and notice labels.

## Hero live map

`dist/hero-map.js` + `hero-map.css` replace the hero illustration with a live bus map when, and only when, the live feed answers and the map library loads; otherwise the illustrated city scene stays (progressive enhancement, no layout shift). It loads after first paint (Leaflet is fetched lazily; skipped when the visitor has Data Saver on) and uses the same transit adapter as the tracker, so driver data is never read.

- Shows every bus in its route color with a status line ("N buses running now · M running late · Updated S s ago"), a link to the full tracker, and clickable markers whose popup links to that route on `live.html`.
- Polls every 15 s while the tab is visible; each marker glides to its new position over the next 14 s. Positions come from the vendor's GPS reports, so the motion is interpolated between updates, not continuous tracking.
- Opens on the Johnstown-area (urban) buses so motion is visible; rural CamTran+ routes are a pan away. The status line counts all buses.
- Accessibility: "Pause updates" button (stops polling and gliding), reduced-motion preference respected (markers jump instead of gliding), markers are not keyboard tab stops (the full tracker is the keyboard-friendly view), text summary in the status line, bilingual labels. On phones one-finger drag is disabled so the map doesn't trap page scrolling.
- If the feed drops after load, the markers stay with "Live feed interrupted. Showing last known positions."; it recovers on the next successful poll.
- Production note: OpenStreetMap's free tile service is for light use; a busy production page needs a paid or self-hosted tile provider.

## Page width

`dist/layout.css` keeps page content in a centered column (1180px) while section backgrounds stay full-bleed. Change `--page-max` at the top of that file to make the site narrower or wider. The live tracker page (`live.html`) is full-screen by design, and the guide and editor pages have their own widths.

## Approved CamTran brand design

The homepage uses the public CamTran logo (downloaded from camtranbus.com/wp-content/uploads/logo-header.jpg), CamTran blue rider controls, magenta accents and navy-on-orange PAY actions. Track a bus opens live.html; Find a route links to #routes and focuses the search field. Fare purchase buttons go to the official PAY ticketing page. Hero artwork at dist/assets/camtran-hero.webp is AI-generated concept imagery, not a verified CamTran vehicle or location. Generated using the built-in image tool with the approved visual mockup as reference; prompt: create the blue/white transit bus scene in a Pennsylvania-style town, without UI, logos or readable markings. Replace with approved agency photography before production. Palette contrast and keyboard/mobile behavior were checked; this is not a WCAG certification.
