/* Records a sanitized snapshot of the public myStop feed into dist/transit/sample.js.
   Used as the offline/fallback data for the transit adapter ('sample' provider).
   Run from the prototype folder:  node tools/make-snapshot.cjs
   Makes ~45 small GET requests with a short pause between them. All records pass through the adapter's
   allow-list normalizers, so driver names and other operator fields are never written to disk. */
const fs = require('node:fs'), path = require('node:path');
require('../dist/transit/transit-adapter.js');
const T = globalThis.TRANSIT, I = T._internals;
T.configure({ provider: 'live', timeoutMs: 20000 });

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const FEATURED = ['9', '12', '18']; // routes that also get sample stop departures
const TRACE_BUDGET = 450; // max points of route line kept per route

function thin(line, max) {
  const step = Math.max(1, Math.ceil(line.length / max));
  const out = line.filter((_, i) => i % step === 0 || i === line.length - 1);
  return out.map((p) => [Number(p[0].toFixed(5)), Number(p[1].toFixed(5))]);
}

(async () => {
  const now = Date.now();
  const routes = await T.routes();
  const snapshot = { takenAt: now, routes, stops: {}, vehicles: [], departures: {}, messages: [], traces: {} };

  for (const r of routes) { snapshot.stops[r.routeId] = (await T.stops(r.routeId)).map((s) => [s.id, s.name, s.lat, s.lng, s.timepoint ? 1 : 0]); await pause(250); }
  snapshot.details = {};
  for (const r of routes) {
    const d = await T.routeDetail(r.routeId);
    snapshot.details[r.routeId] = Object.fromEntries(d.directions.map((x) => [x.code, x.stops.map((s) => s.id)]));
    await pause(250);
  }
  snapshot.vehicles = await T.vehicles();
  snapshot.messages = await T.messages();

  const stopIds = new Set([271]);
  for (const r of routes) {
    const lines = await T.trace(r), total = lines.reduce((a, l) => a + l.length, 0), step = Math.max(1, Math.ceil(total / TRACE_BUDGET));
    snapshot.traces[r.id] = lines.map((l) => thin(l, Math.ceil(l.length / step)));
    if (FEATURED.includes(r.id)) (snapshot.stops[r.routeId] || []).filter((s) => s[4]).slice(0, 4).forEach((s) => stopIds.add(s[0]));
    await pause(250);
  }
  for (const id of stopIds) {
    const deps = await T.departures(id);
    snapshot.departures[id] = deps.slice(0, 8).map((d) => ({ routeId: d.routeId, direction: d.direction, destination: d.destination, minutes: d.minutes, delayMin: d.delayMin }));
    await pause(250);
  }

  const out = path.join(__dirname, '..', 'dist', 'transit', 'sample.js');
  fs.writeFileSync(out, '/* Recorded ' + new Date(now).toISOString() + ' from the public myStop feed. Sanitized by transit-adapter allow-lists. Regenerate with tools/make-snapshot.cjs */\nwindow.TRANSIT_SAMPLE = ' + JSON.stringify(snapshot) + ';\n');
  console.log('wrote', out, fs.statSync(out).size, 'bytes;', routes.length, 'routes,', snapshot.vehicles.length, 'vehicles,', Object.keys(snapshot.departures).length, 'stops with departures,', snapshot.messages.length, 'messages');
})().catch((e) => { console.error(e); process.exitCode = 1; });
