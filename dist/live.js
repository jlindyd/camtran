/* Full-screen live tracker page: route picker, map, departures, buses and stops for one route.
   Operational data comes ONLY through window.TRANSIT; editorial alerts through window.CMS. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var VEHICLE_MS = 15000, DEPART_MS = 20000, ALERT_MS = 60000, STALE_MS = 10 * 60000;
  var depRequest = 0, vehicleRequest = 0;

  var STR = {
    en: {
      back: 'CamTran', title: 'Live bus tracker', skip: 'Skip to route details', official: 'Official tracker ↗', langBtn: 'Español', langLabel: 'Cambiar a español',
      pickRoute: function (n) { return 'Routes (' + n + ')'; }, changeRoute: 'Change route', searchRoutes: 'Search routes by number or name', allBuses: 'Show all buses', allBusesOn: 'Showing all buses',
      routeCount: function (n) { return n + ' route' + (n === 1 ? '' : 's'); }, noRoutes: 'No routes match your search.', urban: 'Urban', rural: 'CamTran+',
      choose: 'Choose a route', chooseText: 'Pick a route to see its map, stops and next departures. The map shows every bus until you do.',
      notices: 'Service notices', noNotices: 'No notices for this route.', clearRoute: '← All routes', direction: 'Direction', outbound: 'Outbound', inbound: 'Inbound',
      departures: 'Next departures', atStop: 'At stop', noDeps: 'No upcoming departures reported for this route at this stop.', noSampleDeps: 'The recorded sample has no departures for this stop.',
      due: 'Due', min: 'min', onTime: 'On time', late: function (n) { return n + ' min late'; }, early: function (n) { return n + ' min early'; },
      buses: 'Buses on this route', busesNow: function (n) { return n + ' bus' + (n === 1 ? '' : 'es') + ' reporting now'; }, noBuses: 'No buses on this route are reporting right now.',
      toward: 'To', lastStop: 'Last stop', noSignal: 'No recent signal', seen: function (s) { return s + ' seconds ago'; }, recordedSample: 'Recorded sample',
      stops: 'Stops, in order', mainStop: 'Main stop', stopHint: 'Select a stop to see its departures and find it on the map.', accessible: 'Official accessibility information ↗', schedules: 'Official schedules and PDFs ↗',
      live: 'LIVE', sample: 'SAMPLE', vehicles: 'Buses', updated: 'Updated', recorded: 'Recorded', liveNote: 'Live from CamTran’s public myStop feed. Independent prototype; confirm with CamTran before you travel.',
      sampleNote: 'Showing a recorded sample; positions and times are not current.', loading: 'Loading…', failed: 'Route data could not be loaded. Try again, or use the official tracker.',
      mapDown: 'The map could not load. Use the lists beside it.', map: 'Live bus map', fromTracker: 'CamTran myStop', pagePrefix: 'CamTran — '
    },
    es: {
      back: 'CamTran', title: 'Rastreador de autobuses en vivo', skip: 'Saltar a los detalles de la ruta', official: 'Rastreador oficial ↗', langBtn: 'English', langLabel: 'Switch to English',
      pickRoute: function (n) { return 'Rutas (' + n + ')'; }, changeRoute: 'Cambiar de ruta', searchRoutes: 'Buscar rutas por número o nombre', allBuses: 'Mostrar todos los autobuses', allBusesOn: 'Mostrando todos los autobuses',
      routeCount: function (n) { return n + ' ruta' + (n === 1 ? '' : 's'); }, noRoutes: 'Ninguna ruta coincide con tu búsqueda.', urban: 'Urbana', rural: 'CamTran+',
      choose: 'Elige una ruta', chooseText: 'Elige una ruta para ver su mapa, paradas y próximas salidas. El mapa muestra todos los autobuses hasta que lo hagas.',
      notices: 'Avisos de servicio', noNotices: 'No hay avisos para esta ruta.', clearRoute: '← Todas las rutas', direction: 'Dirección', outbound: 'Ida', inbound: 'Regreso',
      departures: 'Próximas salidas', atStop: 'En la parada', noDeps: 'No hay salidas próximas de esta ruta en esta parada.', noSampleDeps: 'La muestra grabada no tiene salidas para esta parada.',
      due: 'Llegando', min: 'min', onTime: 'A tiempo', late: function (n) { return n + ' min de retraso'; }, early: function (n) { return n + ' min antes'; },
      buses: 'Autobuses en esta ruta', busesNow: function (n) { return n + ' autobús' + (n === 1 ? '' : 'es') + ' reportando ahora'; }, noBuses: 'Ningún autobús de esta ruta está reportando ahora.',
      toward: 'Hacia', lastStop: 'Última parada', noSignal: 'Sin señal reciente', seen: function (s) { return 'hace ' + s + ' s'; }, recordedSample: 'Muestra grabada',
      stops: 'Paradas, en orden', mainStop: 'Parada principal', stopHint: 'Elige una parada para ver sus salidas y ubicarla en el mapa.', accessible: 'Información oficial de accesibilidad ↗', schedules: 'Horarios oficiales y PDF ↗',
      live: 'EN VIVO', sample: 'MUESTRA', vehicles: 'Autobuses', updated: 'Actualizado', recorded: 'Grabado', liveNote: 'En vivo desde el sistema público myStop de CamTran. Prototipo independiente; confirma con CamTran antes de viajar.',
      sampleNote: 'Se muestra una muestra grabada; las posiciones y horas no son actuales.', loading: 'Cargando…', failed: 'No se pudieron cargar los datos de la ruta. Inténtalo de nuevo o usa el rastreador oficial.',
      mapDown: 'No se pudo cargar el mapa. Usa las listas a su lado.', map: 'Mapa de autobuses en vivo', fromTracker: 'CamTran myStop', pagePrefix: 'CamTran — '
    }
  };

  var st = { lang: 'en', routes: [], route: null, detail: null, trace: [], dir: 0, stop: null, vehicles: [], deps: [], alerts: [], q: '', map: null, layers: {}, markers: {}, timers: [], token: 0 };
  var L10 = function () { return STR[st.lang]; };
  var locale = function () { return st.lang === 'es' ? 'es-US' : 'en-US'; };
  var fmtTime = function (ms) { return ms ? new Date(ms).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York' }) : ''; };
  function ink(hex) { var n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#102d39' : '#fff'; }
  function chip(r, extra) { return '<span class="chip-num" style="background:' + r.color + ';color:' + ink(r.color) + '">' + esc(r.id) + '</span>'; }
  function routeByRouteId(id) { return st.routes.filter(function (r) { return r.routeId === id; })[0]; }

  /* ---------- URL state ---------- */
  function readUrl() {
    var p = new URLSearchParams(location.search);
    return { route: p.get('route'), dir: p.get('dir'), stop: p.get('stop') };
  }
  function writeUrl() {
    var p = new URLSearchParams();
    if (st.route) { p.set('route', st.route.id); if (st.detail && st.detail.directions[st.dir]) p.set('dir', st.detail.directions[st.dir].code); if (st.stop != null) p.set('stop', st.stop); }
    try { history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p.toString() : '')); } catch (e) { /* URL sync is optional */ }
  }

  /* ---------- map ---------- */
  function initMap() {
    if (!window.L) { $('#map').innerHTML = '<p class="map-down"></p>'; $('.map-down').textContent = L10().mapDown; $('.map-down').style.padding = '20px'; return; }
    var L = window.L;
    st.map = L.map('map', { center: [40.32, -78.92], zoom: 11, scrollWheelZoom: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(st.map);
    if (window.ResizeObserver) new ResizeObserver(function () { st.map.invalidateSize(); }).observe($('#map'));
    st.layers.trace = L.layerGroup().addTo(st.map); st.layers.stops = L.layerGroup().addTo(st.map); st.layers.vehicles = L.layerGroup().addTo(st.map);
  }
  function drawTrace() {
    if (!st.map) return; st.layers.trace.clearLayers();
    if (!st.route) return;
    st.trace.forEach(function (pts) {
      window.L.polyline(pts, { color: '#102d39', weight: 8, opacity: .55, interactive: false }).addTo(st.layers.trace);
      window.L.polyline(pts, { color: st.route.color, weight: 5, interactive: false }).addTo(st.layers.trace);
    });
  }
  function currentStops() { var d = st.detail && st.detail.directions[st.dir]; return d ? d.stops : []; }
  function drawStops() {
    if (!st.map) return; st.layers.stops.clearLayers();
    currentStops().forEach(function (s) {
      if (s.lat == null) return;
      var on = s.id === st.stop;
      var m = window.L.circleMarker([s.lat, s.lng], { radius: on ? 10 : (s.timepoint ? 7 : 5), color: '#102d39', weight: on ? 3 : 1.5, fillColor: on ? '#d4ed62' : '#fff', fillOpacity: 1 });
      m.bindTooltip(s.name);
      m.on('click', function () { selectStop(s.id, false); });
      m.addTo(st.layers.stops);
    });
  }
  function isStale(v) { return v.dataSource === 'live' && (!v.updated || Date.now() - v.updated > STALE_MS); }
  function shownVehicles() {
    return st.vehicles.filter(function (v) { return (!st.route || v.routeId === st.route.routeId) && !isStale(v); });
  }
  function vehStatus(v) { var t = L10(); return isStale(v) ? t.noSignal : v.deviation >= 2 ? t.late(v.deviation) : v.deviation <= -2 ? t.early(-v.deviation) : t.onTime; }
  function drawVehicles() {
    if (!st.map) return; st.layers.vehicles.clearLayers(); st.markers = {};
    var t = L10();
    shownVehicles().forEach(function (v) {
      var r = routeByRouteId(v.routeId) || { id: '?', color: '#27424b' };
      var icon = window.L.divIcon({ className: 'bus-pin', html: '<span style="background:' + r.color + ';color:' + ink(r.color) + '">' + esc(r.id) + '</span>', iconSize: [34, 24], iconAnchor: [17, 12] });
      var m = window.L.marker([v.lat, v.lng], { icon: icon, title: 'Route ' + r.id + ' · ' + v.destination, alt: 'Bus on route ' + r.id, keyboard: true });
      m.bindPopup('<strong>' + esc(t.toward) + ' ' + esc(v.destination) + '</strong><br>' + esc(vehStatus(v)) + '<br>' + esc(t.lastStop) + ': ' + esc(v.lastStop));
      m.addTo(st.layers.vehicles); st.markers[v.id] = m;
    });
  }
  function fitView() {
    if (!st.map) return;
    var pts = [];
    if (st.route) {
      st.trace.forEach(function (l) { l.forEach(function (p) { pts.push(p); }); });
      if (!pts.length) currentStops().forEach(function (s) { if (s.lat != null) pts.push([s.lat, s.lng]); });
    }
    if (!pts.length) shownVehicles().forEach(function (v) { pts.push([v.lat, v.lng]); });
    if (pts.length) st.map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
  }

  /* ---------- provenance / header badge ---------- */
  function srcOf(dataset) { return TRANSIT.info(dataset); }
  function srcChip(info) { var t = L10(); return '<span class="src' + (info.mode === 'live' ? '' : ' is-sample') + '">' + esc(info.mode === 'live' ? t.live : t.sample) + '</span>'; }
  function renderBadge() {
    var t = L10(), s = srcOf(st.vehicles), el = $('#live-badge');
    if (s.mode === 'loading') { el.className = 'live-badge is-sample'; el.textContent = t.loading; return; }
    el.className = 'live-badge' + (s.mode === 'live' ? '' : ' is-sample');
    var when = s.mode === 'live' ? t.updated + ' ' + fmtTime(s.updated) : t.recorded + ' ' + (s.updated ? new Date(s.updated).toLocaleString(locale(), { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) : '');
    el.innerHTML = '<strong>' + esc(t.vehicles) + ' · ' + (s.mode === 'live' ? '● ' + t.live : '◌ ' + t.sample) + '</strong> · ' + esc(when) + '<br><span>' + esc(s.mode === 'live' ? t.liveNote : t.sampleNote) + '</span>';
  }

  /* ---------- sidebar ---------- */
  function renderStatic() {
    var t = L10();
    document.documentElement.lang = st.lang;
    $('#back-text').textContent = t.back; $('#live-title').textContent = t.title; $('#skip').textContent = t.skip; $('#official-link').textContent = t.official;
    var b = $('#language'); b.textContent = t.langBtn; b.setAttribute('aria-label', t.langLabel); b.lang = st.lang === 'es' ? 'en' : 'es';
    $('#search-label').textContent = t.searchRoutes; $('#map').setAttribute('aria-label', t.map);
    var ab = $('#all-buses'); ab.textContent = st.route ? t.allBuses : t.allBusesOn; ab.setAttribute('aria-pressed', String(!st.route)); ab.disabled = !st.route;
    document.title = t.pagePrefix + t.title + (st.route ? ' · ' + st.route.id : '');
  }

  function renderRouteList() {
    var t = L10(), q = st.q.trim().toLowerCase();
    var list = st.routes.filter(function (r) { return (r.id + ' ' + r.name).toLowerCase().indexOf(q) !== -1; });
    $('#picker-summary').textContent = st.route ? t.changeRoute + ' (' + st.routes.length + ')' : t.pickRoute(st.routes.length);
    $('#route-status').textContent = list.length ? t.routeCount(list.length) : t.noRoutes;
    $('#route-list').innerHTML = list.map(function (r) {
      return '<li><button type="button" data-route="' + esc(r.id) + '"' + (st.route && st.route.id === r.id ? ' aria-current="true"' : '') + '>' + chip(r) + '<span>' + esc(r.name) + '<small>' + esc(r.area === 'urban' ? t.urban : t.rural) + '</small></span></button></li>';
    }).join('');
  }

  function routeNotices() {
    return st.alerts.filter(function (a) { return st.route ? (!a.routes || !a.routes.length || a.routes.indexOf(st.route.id) !== -1) : true; });
  }
  function noticesHtml() {
    var t = L10(), n = routeNotices();
    return '<div id="p-notices">' + '<h3>' + esc(t.notices) + '</h3>' + (n.length ? n.map(function (a) { return '<p class="notice"><strong>' + (!a.source ? (st.lang === 'es' ? 'AVISO DE EJEMPLO · ' : 'DEMO NOTICE · ') : '') + esc(a.title) + (a.source ? ' · ' + esc(t.fromTracker) : '') + '</strong>' + esc(a.body) + '</p>'; }).join('') : '<p class="no-results">' + esc(t.noNotices) + '</p>') + '</div>';
  }

  function renderPanel() {
    var t = L10(), body = $('#panel-body');
    if (!st.route) {
      body.innerHTML = '<h2>' + esc(t.choose) + '</h2><p>' + esc(t.chooseText) + '</p><div id="p-buses"></div>' + noticesHtml();
      renderBuses(); return;
    }
    var r = st.route, dirs = st.detail ? st.detail.directions : [];
    var offHref = r.area === 'rural' ? 'https://www.camtranbus.com/schedules/camtran-plus-rural-routes/' : 'https://www.camtranbus.com/schedules/camtran-urban-routes/';
    body.innerHTML =
      '<button type="button" class="back-btn" id="clear-route">' + esc(t.clearRoute) + '</button>' +
      '<div class="route-head">' + chip(r) + '<div><h2>' + esc(r.name) + '</h2><small>' + esc(r.area === 'urban' ? t.urban : t.rural) + '</small></div></div>' +
      (dirs.length > 1 ? '<div class="seg" role="group" aria-label="' + esc(t.direction) + '">' + dirs.map(function (d, i) { return '<button type="button" data-dir="' + i + '" aria-pressed="' + (i === st.dir) + '">' + esc(d.code === 'O' ? t.outbound : d.code === 'I' ? t.inbound : d.name) + '</button>'; }).join('') + '</div>' : '') +
      '<h3>' + esc(t.departures) + ' <span id="dep-src"></span></h3><label class="field"><span>' + esc(t.atStop) + '</span><select id="stop-select"></select></label><div id="p-deps" aria-live="polite"></div>' +
      '<h3>' + esc(t.buses) + ' <span id="bus-src"></span></h3><div id="p-buses" aria-live="polite"></div>' +
      '<h3>' + esc(t.stops) + '</h3><p class="small">' + esc(t.stopHint) + '</p><ol class="stops" id="p-stops"></ol>' +
      noticesHtml() +
      '<div class="panel-links"><a href="https://www.camtranbus.com/disability-services/">' + esc(t.accessible) + '</a><a href="' + offHref + '">' + esc(t.schedules) + '</a></div>';
    renderStopControls(); renderDeps(); renderBuses();
  }

  function renderStopControls() {
    var t = L10(), stops = currentStops(), main = stops.filter(function (s) { return s.timepoint; });
    var pickable = stops;
    if (st.stop != null && !pickable.some(function (s) { return s.id === st.stop; }) && stops.some(function (s) { return s.id === st.stop; })) pickable = pickable.concat(stops.filter(function (s) { return s.id === st.stop; }));
    var sel = $('#stop-select'); if (!sel) return;
    sel.innerHTML = pickable.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('');
    if (st.stop != null) sel.value = String(st.stop);
    $('#p-stops').innerHTML = stops.map(function (s) {
      return '<li><button type="button" class="stop-row" data-stop="' + s.id + '"' + (s.id === st.stop ? ' aria-current="true"' : '') + '>' + esc(s.name) + (s.timepoint ? '<small>' + esc(t.mainStop) + '</small>' : '') + '</button></li>';
    }).join('');
  }

  function renderDeps() {
    var t = L10(), el = $('#p-deps'); if (!el || !st.route) return;
    var info = srcOf(st.deps); $('#dep-src').innerHTML = info.mode === 'loading' ? '' : srcChip(info);
    if (info.mode === 'loading') { el.textContent = t.loading; return; }
    var dir = st.detail && st.detail.directions[st.dir];
    var mine = st.deps.filter(function (d) { var direction = String(d.direction).toLowerCase(); return d.routeId === st.route.routeId && (!dir || direction === String(dir.code).toLowerCase() || direction === String(dir.name).toLowerCase()); }).slice(0, 5);
    el.innerHTML = mine.length ? mine.map(function (d) {
      var label = d.delayMin >= 2 ? t.late(d.delayMin) : d.delayMin <= -2 ? t.early(-d.delayMin) : t.onTime;
      if (d.prediction !== 'estimated') label = st.lang === 'es' ? 'Horario programado' : 'Scheduled time';
      return '<div class="dep">' + chip(st.route) + '<div><strong>' + esc(d.destination || d.direction) + '</strong><small>' + esc(d.direction) + ' · ' + esc(label) + '</small></div><div class="eta">' + (d.minutes <= 1 ? esc(t.due) : d.minutes + '<small> ' + esc(t.min) + '</small>') + '</div></div>';
    }).join('') : '<p class="no-results">' + esc(info.mode === 'sample' ? t.noSampleDeps : t.noDeps) + '</p>';
  }

  function renderBuses() {
    var t = L10(), el = $('#p-buses'); if (!el) return;
    var list = st.vehicles.filter(function (v) { return !st.route || v.routeId === st.route.routeId; }), info = srcOf(st.vehicles), bs = $('#bus-src'); if (bs) bs.innerHTML = info.mode === 'loading' ? '' : srcChip(info);
    var age = function (v) { return v.dataSource !== 'live' ? t.recordedSample : (v.updated ? t.seen(Math.max(0, Math.floor((Date.now() - v.updated) / 1000))) : t.noSignal); };
    var head = st.route ? '' : '<h3>' + esc(t.buses) + ' <span>' + (info.mode === 'loading' ? '' : srcChip(info)) + '</span></h3>';
    var activeCount = list.filter(function (v) { return !isStale(v); }).length;
    el.innerHTML = head + (list.length ? '<p>' + esc(t.busesNow(activeCount)) + '</p>' + list.map(function (v) {
      var r = routeByRouteId(v.routeId);
      return '<button type="button" class="bus-row" data-bus="' + v.id + '"' + (isStale(v) ? ' disabled' : '') + '>' + (r && !st.route ? '<strong>' + esc(r.id) + ' · </strong>' : '') + '<strong>' + esc(t.toward) + ' ' + esc(v.destination) + '</strong> · ' + esc(vehStatus(v)) + '<small>' + esc(t.lastStop) + ': ' + esc(v.lastStop) + ' · ' + esc(age(v)) + '</small></button>';
    }).join('') : '<p class="no-results">' + esc(t.noBuses) + '</p>');
  }

  /* ---------- data flow ---------- */
  function loadAlerts() {
    var lang = st.lang;
    return Promise.all([CMS.published('alerts', lang), TRANSIT.messages().catch(function () { return []; })]).then(function (r) {
      var live = srcOf(r[1]).mode === 'live';
      var msgs = live ? r[1].map(function (m) { return { id: m.id, source: m.source, severity: m.severity, title: m.title[lang] || m.title.en, body: m.text, routes: m.routes }; }) : [];
      st.alerts = r[0].concat(msgs);
      renderPanelNotices();
    }, function () { /* notices are optional */ });
  }
  function renderPanelNotices() { var el = $('#p-notices'); if (el) el.outerHTML = noticesHtml(); }

  function refreshVehicles() {
    var request = ++vehicleRequest;
    return TRANSIT.vehicles().then(function (v) { if (request !== vehicleRequest) return; st.vehicles = v; drawVehicles(); renderBuses(); renderBadge(); }, function () { /* adapter falls back */ });
  }
  function refreshDeps() {
    if (!st.route || st.stop == null) { st.deps = []; return Promise.resolve(); }
    var token = st.token, stop = st.stop, request = ++depRequest;
    return TRANSIT.departures(stop).then(function (d) { if (request !== depRequest || token !== st.token || stop !== st.stop) return; st.deps = d; renderDeps(); }, function () { /* keep last */ });
  }

  function selectStop(id, pan) {
    st.token++; depRequest++;
    st.stop = id; writeUrl();
    var sel = $('#stop-select'); if (sel && !Array.prototype.some.call(sel.options, function (o) { return o.value === String(id); })) renderStopControls();
    else if (sel) sel.value = String(id);
    $$('#p-stops [data-stop]').forEach(function (b) { if (Number(b.dataset.stop) === id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    drawStops();
    if (pan && st.map) { var s = currentStops().filter(function (x) { return x.id === id; })[0]; if (s && s.lat != null) st.map.setView([s.lat, s.lng], Math.max(st.map.getZoom(), 15)); }
    st.deps = []; renderDeps(); return refreshDeps();
  }

  function selectDir(i) {
    st.dir = i;
    var stops = currentStops(), main = stops.filter(function (s) { return s.timepoint; });
    st.stop = (main[0] || stops[0] || {}).id; if (st.stop === undefined) st.stop = null;
    st.token++; writeUrl();
    $$('.seg [data-dir]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.dir) === i)); });
    renderStopControls(); drawStops(); st.deps = []; renderDeps(); refreshDeps();
  }

  // route === null shows every bus
  function selectRoute(id, wanted) {
    var token = ++st.token;
    st.route = id ? (st.routes.filter(function (r) { return r.id === id; })[0] || null) : null;
    st.detail = null; st.trace = []; st.dir = 0; st.stop = null; st.deps = [];
    renderStatic(); renderRouteList(); drawTrace(); drawStops();
    $('#picker').open = !st.route;
    if (!st.route) { writeUrl(); renderPanel(); drawVehicles(); fitView(); return Promise.resolve(); }
    $('#panel-body').innerHTML = '<p>' + esc(L10().loading) + '</p>';
    return Promise.all([TRANSIT.routeDetail(st.route.routeId), TRANSIT.trace(st.route)]).then(function (res) {
      if (token !== st.token) return;
      st.detail = res[0]; st.trace = res[1];
      var dirIdx = 0;
      if (wanted && wanted.dir) { st.detail.directions.forEach(function (d, i) { if (d.code === wanted.dir) dirIdx = i; }); }
      st.dir = dirIdx;
      var stops = currentStops(), pick = null;
      if (wanted && wanted.stop) pick = stops.filter(function (s) { return String(s.id) === String(wanted.stop); })[0];
      if (!pick) pick = stops.filter(function (s) { return s.id === 271; })[0] || stops.filter(function (s) { return s.timepoint; })[0] || stops[0];
      st.stop = pick ? pick.id : null;
      writeUrl(); renderPanel(); drawTrace(); drawStops(); drawVehicles(); fitView();
      return refreshDeps();
    }).catch(function () { if (token === st.token) $('#panel-body').innerHTML = '<p class="notice">' + esc(L10().failed) + '</p>'; });
  }

  function startTimers() {
    st.timers.forEach(clearInterval);
    st.timers = [
      setInterval(function () { if (!document.hidden) refreshVehicles(); }, VEHICLE_MS),
      setInterval(function () { if (!document.hidden) refreshDeps(); }, DEPART_MS),
      setInterval(function () { if (!document.hidden) loadAlerts(); }, ALERT_MS)
    ];
  }

  /* ---------- events ---------- */
  $('#route-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-route]'); if (!b) return;
    selectRoute(b.dataset.route).then(function () { var h = $('#panel-body h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } });
  });
  $('#route-search').addEventListener('input', function () { st.q = this.value; renderRouteList(); });
  $('#all-buses').addEventListener('click', function () { selectRoute(null); });
  $('#panel-body').addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('#clear-route'))) { selectRoute(null); return; }
    if ((t = e.target.closest('[data-dir]'))) { selectDir(Number(t.dataset.dir)); return; }
    if ((t = e.target.closest('[data-stop]'))) { selectStop(Number(t.dataset.stop), true); return; }
    if ((t = e.target.closest('[data-bus]'))) {
      var m = st.markers[t.dataset.bus], v = st.vehicles.filter(function (x) { return String(x.id) === t.dataset.bus; })[0];
      if (m && st.map && v) { st.map.setView([v.lat, v.lng], Math.max(st.map.getZoom(), 15)); m.openPopup(); if (window.matchMedia('(max-width:820px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
  });
  $('#panel-body').addEventListener('change', function (e) { if (e.target.id === 'stop-select') selectStop(Number(e.target.value), true); });
  $('#language').addEventListener('click', function () {
    st.lang = st.lang === 'en' ? 'es' : 'en';
    try { localStorage.setItem('camtran-lang', st.lang); } catch (e) { /* optional */ }
    renderStatic(); renderRouteList(); renderPanel(); renderBadge(); drawVehicles(); loadAlerts();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { refreshVehicles(); refreshDeps(); } });
  TRANSIT.onStatus(renderBadge);

  /* ---------- boot ---------- */
  try { if (localStorage.getItem('camtran-lang') === 'es') st.lang = 'es'; } catch (e) { /* default English */ }
  var wanted = readUrl();
  initMap(); renderStatic(); renderBadge();
  Promise.all([TRANSIT.routes(), CMS.published('routes', 'en').catch(function () { return []; })]).then(function (r) {
    var cms = {}; r[1].forEach(function (c) { cms[c.id] = c; });
    st.routes = r[0].map(function (t) { var c = cms[t.id]; return { id: t.id, routeId: t.routeId, name: c ? c.name : t.name, area: c ? c.area : (Number(t.id) >= 30 ? 'rural' : 'urban'), color: t.color, trace: t.trace }; })
      .sort(function (a, b) { return Number(a.id) - Number(b.id); });
    renderRouteList();
    return refreshVehicles();
  }).then(function () {
    return selectRoute(wanted.route, wanted);
  }).then(function () { loadAlerts(); startTimers(); if (!st.route) { renderPanel(); } }).catch(function (e) { $('#panel-body').innerHTML = '<p class="notice"></p>'; $('#panel-body .notice').textContent = L10().failed + ' ' + (e && e.message || ''); });
})();
