/* Unit tests for the transit adapter: normalizers, privacy allow-list, and live/sample fallback. */
const vm = require('node:vm'), fs = require('node:fs'), assert = require('node:assert/strict');

function load(fetchImpl) {
  const ctx = { console, Date, Math, Promise, setTimeout, clearTimeout, encodeURIComponent, Object, Number, String, Array, JSON, RegExp, isFinite, AbortController, fetch: fetchImpl };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('dist/transit/sample.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('dist/transit/transit-adapter.js', 'utf8'), ctx);
  return ctx.TRANSIT;
}
const ok = (json) => Promise.resolve({ ok: true, json: () => Promise.resolve(json), text: () => Promise.resolve('') });
const down = () => Promise.reject(new TypeError('Failed to fetch'));

(async () => {
  const T = load(down), I = T._internals, NOW = 1791990000000;

  assert.equal(I.parseMsDate('/Date(1791990038000-0400)/'), 1791990038000);
  assert.equal(I.parseMsDate(null), null);

  // privacy: driver fields are never copied
  const v = I.normalizeVehicle({ VehicleId: 5, Name: '720', RouteId: 9, Latitude: 40.2, Longitude: -78.8, Heading: 200, Speed: 24, Destination: 'Galleria', DirectionLong: 'Outbound', DisplayStatus: 'On Time', Deviation: 1, LastStop: 'X', LastUpdated: '/Date(1791990038000-0400)/',
    DriverName: 'SECRET', DriverFirstName: 'SECRET', DriverLastName: 'SECRET', DriverFareboxId: 99 });
  assert.ok(!JSON.stringify(v).includes('SECRET') && !('DriverFareboxId' in v) && v.name === '720' && v.updated === 1791990038000);
  assert.equal(I.normalizeVehicle({ Latitude: 0, Longitude: 0 }), null);
  assert.equal(I.normalizeVehicle({ Latitude: 'x', Longitude: 1 }), null);
  assert.ok(!/driver/i.test(fs.readFileSync('dist/transit/sample.js', 'utf8')), 'sample snapshot must not contain driver data');

  // departures: flatten, drop completed/past, sort, minutes and delay
  const dep = (eta, sta, done) => ({ IsCompleted: !!done, ETA: `/Date(${eta})/`, STA: `/Date(${sta})/`, Trip: { InternetServiceDesc: 'Galleria' } });
  const rows = I.normalizeDepartures([{ RouteDirections: [{ RouteId: 9, Direction: 'Outbound', Departures: [dep(NOW + 600000, NOW + 300000), dep(NOW + 120000, NOW + 120000), dep(NOW + 60000, NOW, true), dep(NOW - 600000, NOW - 600000)] }] }], NOW);
  assert.equal(JSON.stringify(rows.map((r) => [r.minutes, r.delayMin])), "[[2,0],[10,5]]");

  // messages: active window only, route mapping, severity
  const routes = [{ routeId: 20, id: '20' }];
  const msg = (from, to, extra) => Object.assign({ MessageId: 1, Published: true, Message: 'Hello', Routes: [20], Effect: 4, FromDate: `/Date(${from})/`, ToDate: `/Date(${to})/` }, extra);
  const m = I.normalizeMessages([msg(NOW - 1e6, NOW + 1e9), msg(NOW + 1e8, NOW + 1e9), msg(NOW - 1e9, NOW - 1e8), msg(NOW - 1e6, NOW + 1e9, { Published: false })], routes, NOW);
  assert.equal(m.length, 1); assert.equal(m[0].severity, 'detour'); assert.equal(JSON.stringify(m[0].routes), "[\"20\"]"); assert.equal(m[0].title.es, 'Aviso de la ruta 20');

  // KML
  const lines = I.parseKmlLines('<kml><coordinates>-78.9,40.3,0 -78.8,40.4,0</coordinates><coordinates>1,2,0</coordinates></kml>');
  assert.equal(JSON.stringify(lines), "[[[40.3,-78.9],[40.4,-78.8]]]");

  // routes
  assert.deepEqual(I.normalizeRoute({ ShortName: '9', RouteId: 9, LongName: 'Walmart-Galleria', Color: 'ff557f', TextColor: 'ffffff', RouteTraceFilename: 'Route9.kml' }).color, '#ff557f');

  // route detail: stops ordered per direction; operator data on nested vehicles is ignored
  const det = I.normalizeRouteDetail({ RouteId: 9, Directions: [{ Dir: 'O' }, { Dir: 'I' }],
    Stops: [{ StopId: 1, Name: 'A', Latitude: 1, Longitude: 2, IsTimePoint: true }, { StopId: 2, Name: 'B' }, { StopId: 3, Name: 'C' }],
    RouteStops: [{ Direction: 'O', SortOrder: 2, StopId: 2 }, { Direction: 'O', SortOrder: 1, StopId: 1 }, { Direction: 'I', SortOrder: 1, StopId: 3 }, { Direction: 'I', SortOrder: 2, StopId: 99 }],
    Vehicles: [{ DriverName: 'SECRET' }] });
  assert.equal(JSON.stringify(det.directions.map((d) => [d.name, d.stops.map((s) => s.name)])), '[["Outbound",["A","B"]],["Inbound",["C"]]]');
  assert.ok(!JSON.stringify(det).includes('SECRET'));

  // every route in the recorded sample has ordered directions with stops
  const all = await load(down).routes();
  const sampleT = load(down); sampleT.configure({ provider: 'sample' });
  for (const r of all) { const d = await sampleT.routeDetail(r.routeId); assert.ok(d.directions.length >= 1 && d.directions.every((x) => x.stops.length > 0), 'sample detail for route ' + r.id); }

  // fallback behavior
  let r = await T.routes();                      // auto + network down -> sample
  assert.equal(T.status().mode, 'sample'); assert.match(T.status().error, /fetch/); assert.ok(r.length >= 20);

  const live = load((url) => ok(url.includes('GetVisibleRoutes') ? [{ RouteId: 1, ShortName: '1', LongName: 'Woodvale Garage', Color: 'baa2fb' }] : []));
  r = await live.routes();
  assert.equal(live.status().mode, 'live'); assert.equal(r.length, 1);

  const strict = load(down); strict.configure({ provider: 'live' });
  await assert.rejects(strict.routes(), /fetch/);

  let called = 0; const forced = load(() => { called++; return down(); }); forced.configure({ provider: 'sample' });
  await forced.vehicles(); assert.equal(called, 0); assert.equal(forced.status().mode, 'sample');

  console.log('PASS: normalizers, driver-data allow-list, windows/sorting, KML, live and sample fallback');
  const mixed = load((url) => url.includes('Vehicles') ? down() : ok([]));
  const recorded = await mixed.vehicles();
  const current = await mixed.departures(271);
  assert.equal(mixed.info(recorded).mode, 'sample');
  assert.equal(mixed.info(current).mode, 'live');
  assert.equal(mixed.status().mode, 'sample', 'one live endpoint must not relabel recorded vehicle data');
  assert.ok(recorded.every(v => v.dataSource === 'sample'));
  const scheduled = I.normalizeDepartures([{ RouteDirections: [{ RouteId: 9, Direction: 'Outbound', Departures: [{ STA: `/Date(${NOW+600000})/` }] }] }], NOW);
  assert.equal(scheduled[0].prediction, 'scheduled');
  assert.equal(rows[0].prediction, 'estimated');
  console.log('PASS: partial outage provenance and scheduled versus estimated departures');
})().catch((e) => { console.error(e); process.exitCode = 1; });
