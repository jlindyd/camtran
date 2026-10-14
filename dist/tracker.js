/* Live tracker section: route/stop pickers, map, arrivals board and an accessible vehicle table.
   Reads operational data ONLY through window.TRANSIT (see transit/transit-adapter.js). */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var routeRequest = 0, arrivalRequest = 0, vehicleRequest = 0;
  var VEHICLE_MS = 15000, ARRIVAL_MS = 20000, STALE_MS = 10 * 60000;

  var STR = {
    en: {
      loading: 'Loading routes…', allRoutes: 'All routes', pickRoute: 'Choose a route to see its stops and arrivals.', mainStops: 'Main stops', allStops: 'All stops',
      live: 'LIVE', sample: 'SAMPLE DATA', updated: 'Updated', recorded: 'Recorded',
      liveBadge: 'Live from CamTran’s public myStop feed. Independent prototype; not an official source for travel decisions.',
      sampleBadge: function (why) { return 'Live feed unavailable' + (why ? ' (' + why + ')' : '') + '. Showing a recorded sample; positions and times are not current.'; },
      sampleForced: 'Showing a recorded sample; positions and times are not current.',
      stop: 'Stop', due: 'Due', min: 'min', onTime: 'On time', late: function (n) { return n + ' min late'; }, early: function (n) { return n + ' min early'; },
      noArrivals: 'No upcoming departures reported for this stop.', noSampleStop: 'The recorded sample has no departures for this stop. Try a main stop on routes 9, 12 or 18.',
      selectedRoute: 'This route', arrivalsFoot: 'Estimates change as buses move. Confirm with CamTran before you travel.',
      mapDown: 'The map could not load. Use the vehicle table below.', vehicles: function (n) { return 'Vehicle list (' + n + ' on the map)'; },
      cap: 'Vehicles currently reported', cols: ['Bus', 'Route', 'Going to', 'Status', 'Last stop', 'Last reported'], noSignal: 'No recent signal', hidden: function (n) { return n + ' vehicle(s) with no recent signal are not shown on the map.'; },
      noVehicles: 'No vehicles are reporting right now.', direction: 'Direction', lastStop: 'Last stop', toward: 'To'
    },
    es: {
      loading: 'Cargando rutas…', allRoutes: 'Todas las rutas', pickRoute: 'Elige una ruta para ver sus paradas y llegadas.', mainStops: 'Paradas principales', allStops: 'Todas las paradas',
      live: 'EN VIVO', sample: 'DATOS DE EJEMPLO', updated: 'Actualizado', recorded: 'Grabado',
      liveBadge: 'En vivo desde el sistema público myStop de CamTran. Prototipo independiente; no es una fuente oficial para decidir tu viaje.',
      sampleBadge: function (why) { return 'El sistema en vivo no está disponible' + (why ? ' (' + why + ')' : '') + '. Se muestra una muestra grabada; las posiciones y horas no son actuales.'; },
      sampleForced: 'Se muestra una muestra grabada; las posiciones y horas no son actuales.',
      stop: 'Parada', due: 'Llegando', min: 'min', onTime: 'A tiempo', late: function (n) { return n + ' min de retraso'; }, early: function (n) { return n + ' min antes'; },
      noArrivals: 'No hay salidas próximas para esta parada.', noSampleStop: 'La muestra grabada no tiene salidas para esta parada. Prueba una parada principal de las rutas 9, 12 o 18.',
      selectedRoute: 'Esta ruta', arrivalsFoot: 'Las estimaciones cambian a medida que se mueven los autobuses. Confirma con CamTran antes de viajar.',
      mapDown: 'No se pudo cargar el mapa. Usa la tabla de vehículos.', vehicles: function (n) { return 'Lista de vehículos (' + n + ' en el mapa)'; },
      cap: 'Vehículos reportados actualmente', cols: ['Bus', 'Ruta', 'Destino', 'Estado', 'Última parada', 'Último reporte'], noSignal: 'Sin señal reciente', hidden: function (n) { return n + ' vehículo(s) sin señal reciente no se muestran en el mapa.'; },
      noVehicles: 'Ningún vehículo está reportando en este momento.', direction: 'Dirección', lastStop: 'Última parada', toward: 'Hacia'
    }
  };
  var S = function () { return STR[document.documentElement.lang === 'es' ? 'es' : 'en']; };
  var locale = function () { return document.documentElement.lang === 'es' ? 'es-US' : 'en-US'; };
  var fmtTime = function (ms) { return ms ? new Date(ms).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York' }) : ''; };

  var st = { routes: [], route: null, stops: [], stop: null, vehicles: [], deps: [], map: null, layers: {}, markers: {}, timers: [], started: false };

  /* ---------- map ---------- */
  function initMap() {
    if (!window.L) { $('#live-map').innerHTML = '<p class="map-fallback"></p>'; $('.map-fallback').textContent = S().mapDown; return; }
    var L = window.L;
    st.map = L.map('live-map', { center: [40.32, -78.92], zoom: 11, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(st.map);
    st.layers.trace = L.layerGroup().addTo(st.map);
    st.layers.stops = L.layerGroup().addTo(st.map);
    st.layers.vehicles = L.layerGroup().addTo(st.map);
  }

  function drawTrace(lines, color) {
    var shape = TRANSIT.info(lines), stops = TRANSIT.info(st.stops);
    $('#map-source').textContent = (document.documentElement.lang === 'es' ? 'Mapa y paradas · ' : 'Map and stops · ') + (shape.mode === 'live' && stops.mode === 'live' ? S().live : S().sample);
    if (!st.map) return;
    st.layers.trace.clearLayers();
    lines.forEach(function (pts) {
      window.L.polyline(pts, { color: '#102d39', weight: 7, opacity: .55, interactive: false }).addTo(st.layers.trace);
      window.L.polyline(pts, { color: color, weight: 4, opacity: 1, interactive: false }).addTo(st.layers.trace);
    });
  }

  function drawStops() {
    if (!st.map) return;
    st.layers.stops.clearLayers();
    st.stops.forEach(function (s) {
      if (s.lat == null || s.lng == null) return;
      var on = st.stop && s.id === st.stop.id;
      var m = window.L.circleMarker([s.lat, s.lng], { radius: on ? 9 : (s.timepoint ? 6 : 4), color: '#102d39', weight: on ? 3 : 1.5, fillColor: on ? '#d4ed62' : '#fff', fillOpacity: 1 });
      m.bindTooltip(s.name);
      m.on('click', function () { selectStop(s.id); });
      m.addTo(st.layers.stops);
    });
  }

  function drawVehicles(fit) {
    if (!st.map) return;
    st.layers.vehicles.clearLayers();
    var routeById = {}; st.routes.forEach(function (r) { routeById[r.routeId] = r; });
    var pts = [];
    visibleVehicles().shown.forEach(function (v) {
      var r = routeById[v.routeId] || { id: '?', color: '#27424b', textColor: '#fff' };
      var icon = window.L.divIcon({ className: 'bus-pin', html: '<span style="background:' + r.color + ';color:' + (isLight(r.color) ? '#102d39' : '#fff') + '">' + esc(r.id) + '</span>', iconSize: [34, 24], iconAnchor: [17, 12] });
      var m = window.L.marker([v.lat, v.lng], { icon: icon, title: 'Route ' + r.id + ' · ' + v.destination, alt: 'Bus ' + v.name + ' on route ' + r.id, keyboard: true });
      m.bindPopup('<strong>' + esc(S().toward) + ' ' + esc(v.destination) + '</strong><br>' + esc(v.direction) + ' · ' + esc(statusText(v)) + '<br>' + esc(S().lastStop) + ': ' + esc(v.lastStop) + '<br>' + esc(reportAge(v)));
      m.addTo(st.layers.vehicles);
      pts.push([v.lat, v.lng]);
    });
    if (fit && pts.length) st.map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  }

  function isLight(hex) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150; }

  /* ---------- data helpers ---------- */
  function isStale(v) { return v.dataSource === 'live' && (!v.updated || Date.now() - v.updated > STALE_MS); }
  function visibleVehicles() {
    var list = st.vehicles.filter(function (v) { return !st.route || v.routeId === st.route.routeId; });
    return { all: list, shown: list.filter(function (v) { return !isStale(v); }), stale: list.filter(isStale) };
  }
  function reportAge(v) { var es = document.documentElement.lang === 'es'; if (v.dataSource !== 'live') return es ? 'Muestra grabada' : 'Recorded sample'; if (!v.updated) return S().noSignal; var age = Math.max(0, Math.floor((Date.now() - v.updated) / 1000)); return es ? 'Hace ' + age + ' s' : age + ' seconds ago'; }
  function statusText(v) {
    if (isStale(v)) return S().noSignal;
    if (v.deviation >= 2) return S().late(v.deviation);
    if (v.deviation <= -2) return S().early(-v.deviation);
    return S().onTime;
  }

  /* ---------- rendering ---------- */
  function renderBadge() {
    var s = TRANSIT.info(st.vehicles), t = S(), el = $('#data-badge');
    el.className = 'data-badge ' + (s.mode === 'live' ? 'is-live' : 'is-sample');
    var why = !s.error ? '' : /abort/i.test(s.error) ? 'timeout' : /failed to fetch|network/i.test(s.error) ? 'network' : s.error;
    var when = s.mode === 'live' ? t.updated + ' ' + fmtTime(s.updated) : t.recorded + ' ' + (s.updated ? new Date(s.updated).toLocaleString(locale(), { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) : '');
    el.innerHTML = '<strong>' + (document.documentElement.lang === 'es' ? 'Vehículos · ' : 'Vehicles · ') + (s.mode === 'live' ? '● ' + t.live : '◌ ' + t.sample) + '</strong> · ' + esc(when) + '<br><span>' + esc(s.mode === 'live' ? t.liveBadge : (s.error ? t.sampleBadge(why) : t.sampleForced)) + '</span>';
    var arrivalSource = TRANSIT.info(st.deps); s = arrivalSource; when = s.mode === 'live' ? t.updated + ' ' + fmtTime(s.updated) : t.sample;
    $('#board-status').innerHTML = '<span class="status-dot' + (s.mode === 'live' ? '' : ' is-sample') + '"></span> ' + esc(s.mode === 'live' ? t.live : t.sample);
    $('#board-updated').textContent = when;
  }

  function renderRouteOptions() {
    var sel = $('#tracker-route'), t = S(), keep = st.route ? st.route.routeId : '';
    sel.innerHTML = '<option value="">' + esc(t.allRoutes) + '</option>' + st.routes.map(function (r) { return '<option value="' + r.routeId + '">' + esc(r.id) + ' · ' + esc(r.name) + '</option>'; }).join('');
    sel.value = keep;
  }

  function renderStopOptions() {
    var sel = $('#tracker-stop'), t = S();
    if (!st.route) { sel.innerHTML = '<option>' + esc(t.pickRoute) + '</option>'; sel.disabled = true; return; }
    var main = st.stops.filter(function (s) { return s.timepoint; }), rest = st.stops.filter(function (s) { return !s.timepoint; });
    var opt = function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; };
    sel.innerHTML = (main.length ? '<optgroup label="' + esc(t.mainStops) + '">' + main.map(opt).join('') + '</optgroup>' : '') + (rest.length ? '<optgroup label="' + esc(t.allStops) + '">' + rest.map(opt).join('') + '</optgroup>' : '');
    sel.disabled = !st.stops.length;
    if (st.stop) sel.value = String(st.stop.id);
  }

  function arrivalLabel(d) {
    var t = S();
    if (d.prediction !== 'estimated') return document.documentElement.lang === 'es' ? 'Horario programado' : 'Scheduled time';
    if (d.delayMin >= 2) return t.late(d.delayMin);
    if (d.delayMin <= -2) return t.early(-d.delayMin);
    return t.onTime;
  }

  function renderArrivals() {
    var t = S(), el = $('#arrivals'), routeByRouteId = {};
    st.routes.forEach(function (r) { routeByRouteId[r.routeId] = r; });
    $('#board-stop').textContent = st.stop ? st.stop.name : (t.stop || '');
    $('#board-sub').textContent = st.route ? '' : t.pickRoute;
    $('#board-foot').textContent = '◷ ' + t.arrivalsFoot;
    if (!st.stop) { el.innerHTML = ''; return; }
    if (!st.deps.length) { el.innerHTML = '<p class="no-results">' + esc(TRANSIT.info(st.deps).mode !== 'live' ? t.noSampleStop : t.noArrivals) + '</p>'; return; }
    el.innerHTML = st.deps.slice(0, 5).map(function (d) {
      var r = routeByRouteId[d.routeId] || { id: String(d.routeId), color: '#27424b', textColor: '#fff' };
      var mine = st.route && d.routeId === st.route.routeId;
      return '<div class="arrival' + (mine ? ' is-mine' : '') + '"><span class="route-number" style="background:' + r.color + ';color:' + (isLight(r.color) ? '#102d39' : '#fff') + '">' + esc(r.id) + '</span><div><strong>' + esc(d.destination || d.direction) + '</strong><small>' + esc(d.direction) + ' · ' + esc(arrivalLabel(d)) + (mine ? ' · ' + esc(t.selectedRoute) : '') + '</small></div><div class="arrival-time">' + (d.minutes <= 1 ? esc(t.due) : d.minutes) + (d.minutes <= 1 ? '' : '<small>' + esc(t.min) + '</small>') + '</div></div>';
    }).join('');
  }

  function renderVehicleTable() {
    var t = S(), v = visibleVehicles(), routeById = {};
    st.routes.forEach(function (r) { routeById[r.routeId] = r; });
    $('#veh-summary').textContent = t.vehicles(v.shown.length);
    $('#veh-caption').textContent = t.cap + (v.stale.length ? ' · ' + t.hidden(v.stale.length) : '');
    $('#veh-head').innerHTML = '<tr>' + t.cols.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr>';
    $('#veh-body').innerHTML = v.all.length ? v.all.map(function (x) {
      var r = routeById[x.routeId];
      return '<tr><td>' + esc(x.name) + '</td><td>' + esc(r ? r.id : x.routeId) + '</td><td>' + esc(x.destination) + '</td><td>' + esc(statusText(x)) + '</td><td>' + esc(x.lastStop) + '</td><td>' + esc(reportAge(x)) + '</td></tr>';
    }).join('') : '<tr><td colspan="6">' + esc(t.noVehicles) + '</td></tr>';
  }

  /* ---------- data flow ---------- */
  function refreshVehicles(fit) {
    var request = ++vehicleRequest; return TRANSIT.vehicles().then(function (v) { if (request !== vehicleRequest) return; st.vehicles = v; drawVehicles(fit); renderVehicleTable(); renderBadge(); });
  }
  function refreshArrivals() {
    if (!st.stop) { st.deps = []; renderArrivals(); return Promise.resolve(); }
    var request = ++arrivalRequest, stopId = st.stop.id; $('#arrivals').textContent = S().loading; return TRANSIT.departures(stopId).then(function (d) { if (request !== arrivalRequest || !st.stop || st.stop.id !== stopId) return; st.deps = d; renderArrivals(); renderBadge(); });
  }

  function selectStop(id) {
    ++arrivalRequest; st.deps = []; st.stop = st.stops.filter(function (s) { return s.id === Number(id); })[0] || null;
    if (st.stop) $('#tracker-stop').value = String(st.stop.id);
    drawStops();
    return refreshArrivals();
  }

  function selectRoute(routeId, stopId) {
    var request = ++routeRequest; ++arrivalRequest;
    st.route = st.routes.filter(function (r) { return r.routeId === Number(routeId); })[0] || null;
    st.stop = null; st.stops = []; st.deps = []; renderStopOptions(); renderArrivals(); if (st.map) { st.layers.trace.clearLayers(); st.layers.stops.clearLayers(); } 
    if (!st.route) {
      if (st.map) { st.layers.trace.clearLayers(); st.layers.stops.clearLayers(); }
      renderStopOptions(); renderArrivals();
      return refreshVehicles(true);
    }
    return Promise.all([TRANSIT.stops(st.route.routeId), TRANSIT.trace(st.route)]).then(function (r) {
      if (request !== routeRequest) return; st.stops = r[0];
      drawTrace(r[1], st.route.color);
      var pick = st.stops.filter(function (s) { return s.id === 271; })[0] || st.stops.filter(function (s) { return s.timepoint; })[0] || st.stops[0];
      st.stop = st.stops.filter(function (x) { return x.id === Number(stopId); })[0] || pick || null;
      renderStopOptions(); drawStops();
      return Promise.all([refreshVehicles(true), refreshArrivals()]);
    });
  }

  function startTimers() {
    st.timers.forEach(clearInterval); st.timers = [];
    st.timers.push(setInterval(function () { if (!document.hidden) refreshVehicles(false).catch(noop); }, VEHICLE_MS));
    st.timers.push(setInterval(function () { if (!document.hidden) refreshArrivals().catch(noop); }, ARRIVAL_MS));
  }
  function noop() { /* the adapter already fell back to the sample; nothing more to do */ }

  /* ---------- events ---------- */
  $('#tracker-route').onchange = function () { selectRoute(this.value).catch(noop); };
  $('#tracker-stop').onchange = function () { selectStop(this.value).catch(noop); };
  document.addEventListener('visibilitychange', function () { if (!document.hidden && st.started) { refreshVehicles(false).catch(noop); refreshArrivals().catch(noop); } });
  document.addEventListener('camtran:lang', function () { renderBadge(); renderRouteOptions(); renderStopOptions(); renderArrivals(); renderVehicleTable(); });
  TRANSIT.onStatus(renderBadge);
  document.addEventListener('camtran:track', function (e) { var d = e.detail || {}; $('#tracker-route').value = String(d.routeId); selectRoute(d.routeId, d.stopId).then(function () { document.querySelector('#tracker').scrollIntoView({ behavior: 'smooth' }); $('#tracker-stop').focus(); }).catch(noop); });
  $('#tracker-stop-search').oninput = function () { var q = this.value.toLowerCase(), count = 0; renderStopOptions(); Array.prototype.forEach.call($('#tracker-stop').options, function (o) { o.hidden = !!q && o.textContent.toLowerCase().indexOf(q) === -1; if (!o.hidden) count++; }); $('#stop-search-status').textContent = document.documentElement.lang === 'es' ? count + ' paradas coinciden' : count + ' matching stops'; };
  document.querySelector('#tracker-map-toggle').addEventListener('toggle', function () { if (this.open && st.map) { st.map.invalidateSize(); drawVehicles(true); } });

  /* ---------- boot ---------- */
  initMap();
  $('#board-foot').textContent = '◷ ' + S().arrivalsFoot;
  TRANSIT.routes().then(function (routes) {
    st.routes = routes; renderRouteOptions();
    var first = routes.filter(function (r) { return r.id === '9'; })[0] || routes[0];
    $('#tracker-route').value = first ? first.routeId : '';
    return selectRoute(first ? first.routeId : '');
  }).then(function () { st.started = true; startTimers(); renderBadge(); }).catch(function (e) { $('#data-badge').textContent = String(e && e.message || e); });
})();
