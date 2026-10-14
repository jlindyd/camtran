/* Home-page hero: live bus map teaser.
   Progressive enhancement: the illustrated city scene is always in the page and stays visible unless the
   live feed answers AND the map library loads. Data comes only through window.TRANSIT. */
(function () {
  'use strict';

  var hero = document.querySelector('.rider-intro .hero');
  var box = document.getElementById('hero-map');
  if (!hero || !box || !window.TRANSIT) return;

  var POLL_MS = 15000, GLIDE_MS = 14000, STALE_MS = 10 * 60000;
  var LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';

  var STR = {
    en: {
      region: 'Live bus map', live: 'LIVE', running: function (n) { return n + (n === 1 ? ' bus' : ' buses') + ' running now'; }, late: function (n) { return n + ' running late'; },
      updated: function (s) { return 'Updated ' + s + ' s ago'; }, open: 'Open the live tracker →', pause: 'Ⅱ Pause updates', play: '▶ Resume updates', paused: 'Updates paused',
      interrupted: 'Live feed interrupted. Showing last known positions.', toward: 'To', track: function (r) { return 'Track route ' + r + ' →'; },
      note: 'Independent prototype using CamTran’s public myStop feed. Not for travel decisions.'
    },
    es: {
      region: 'Mapa de autobuses en vivo', live: 'EN VIVO', running: function (n) { return n + (n === 1 ? ' autobús' : ' autobuses') + ' en servicio'; }, late: function (n) { return n + ' con retraso'; },
      updated: function (s) { return 'Actualizado hace ' + s + ' s'; }, open: 'Abrir el rastreador en vivo →', pause: 'Ⅱ Pausar actualizaciones', play: '▶ Reanudar actualizaciones', paused: 'Actualizaciones en pausa',
      interrupted: 'Se interrumpió el sistema en vivo. Se muestran las últimas posiciones conocidas.', toward: 'Hacia', track: function (r) { return 'Rastrear ruta ' + r + ' →'; },
      note: 'Prototipo independiente con el sistema público myStop de CamTran. No es para decidir viajes.'
    }
  };
  var S = function () { return STR[document.documentElement.lang === 'es' ? 'es' : 'en']; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function ink(hex) { var n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#102d39' : '#fff'; }

  var st = { map: null, routes: {}, markers: {}, vehicles: [], updatedAt: 0, paused: false, interrupted: false, timer: null, tick: null, raf: 0, ready: false, bounded: false };
  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ---------- lazy-load the map library ---------- */
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET_CSS; document.head.appendChild(css);
      var js = document.createElement('script'); js.src = LEAFLET_JS; js.async = true;
      js.onload = resolve; js.onerror = function () { reject(new Error('map library unavailable')); };
      document.head.appendChild(js);
    });
  }

  /* ---------- data ---------- */
  function fresh(v) { return v.dataSource !== 'live' || (v.updated && Date.now() - v.updated <= STALE_MS); }
  function fetchVehicles() {
    return TRANSIT.vehicles().then(function (list) {
      var live = TRANSIT.info(list).mode === 'live';
      return { live: live, list: live ? list.filter(fresh) : [] };
    });
  }

  /* ---------- map ---------- */
  function build() {
    box.innerHTML =
      '<div class="hm-canvas" id="hero-map-canvas"></div>' +
      '<div class="hm-overlay"><p class="hm-status" role="status" id="hm-status"></p><p class="hm-sub" id="hm-sub"></p></div>' +
      '<div class="hm-actions"><a class="hm-open" id="hm-open" href="live.html"></a><button type="button" class="hm-pause" id="hm-pause" aria-pressed="false"></button></div>';
    var L = window.L;
    st.map = L.map('hero-map-canvas', { center: [40.32, -78.92], zoom: 10, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false, zoomControl: false, attributionControl: true });
    L.control.zoom({ position: 'topright' }).addTo(st.map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 16, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(st.map);
    $('#hm-pause').addEventListener('click', function () { st.paused = !st.paused; st.paused ? stopTimers() : (poll(), startTimers()); renderOverlay(); });
  }
  function $(s) { return box.querySelector(s); }

  function pinIcon(route) {
    var r = st.routes[route] || { id: '?', color: '#27424b' };
    return window.L.divIcon({ className: 'bus-pin hm-pin', html: '<span style="background:' + r.color + ';color:' + ink(r.color) + '">' + esc(r.id) + '</span>', iconSize: [28, 20], iconAnchor: [14, 10] });
  }
  function popup(v) {
    var r = st.routes[v.routeId] || { id: '?' };
    return '<strong>' + esc(S().toward) + ' ' + esc(v.destination) + '</strong><br><a href="live.html?route=' + encodeURIComponent(r.id) + '">' + esc(S().track(r.id)) + '</a>';
  }

  // Create, move (gliding) or remove one marker per vehicle.
  function apply(list) {
    var seen = {}, now = performance.now(), glide = !reduced.matches && !st.paused;
    list.forEach(function (v) {
      seen[v.id] = true;
      var m = st.markers[v.id], to = [v.lat, v.lng];
      if (!m) {
        var marker = window.L.marker(to, { icon: pinIcon(v.routeId), keyboard: false, riseOnHover: true, alt: '' }).addTo(st.map);
        marker.bindPopup(popup(v));
        st.markers[v.id] = { marker: marker, from: to, to: to, start: now, routeId: v.routeId };
      } else {
        var cur = m.marker.getLatLng();
        m.from = [cur.lat, cur.lng]; m.to = to; m.start = now; m.glide = glide;
        if (!glide) m.marker.setLatLng(to);
        m.marker.setPopupContent(popup(v));
      }
    });
    Object.keys(st.markers).forEach(function (id) { if (!seen[id]) { st.map.removeLayer(st.markers[id].marker); delete st.markers[id]; } });
    if (glide) animate();
    if (!st.bounded && list.length) {
      st.bounded = true;
      // Open on the Johnstown-area (urban) buses so movement is visible; rural CamTran+ routes are a pan away.
      var urban = list.filter(function (v) { var r = st.routes[v.routeId]; return r && Number(r.id) < 30; });
      var focus = urban.length >= 3 ? urban : list;
      st.map.fitBounds(focus.map(function (v) { return [v.lat, v.lng]; }), { padding: [40, 40], maxZoom: 13 });
    }
  }

  function animate() {
    if (st.raf) return;
    var step = function (t) {
      var moving = false;
      Object.keys(st.markers).forEach(function (id) {
        var m = st.markers[id]; if (!m.glide) return;
        var k = Math.min(1, (t - m.start) / GLIDE_MS);
        m.marker.setLatLng([m.from[0] + (m.to[0] - m.from[0]) * k, m.from[1] + (m.to[1] - m.from[1]) * k]);
        if (k < 1) moving = true; else m.glide = false;
      });
      st.raf = moving && !document.hidden ? requestAnimationFrame(step) : 0;
    };
    st.raf = requestAnimationFrame(step);
  }

  /* ---------- overlay text ---------- */
  function renderOverlay() {
    if (!st.ready) return;
    var t = S(), n = st.vehicles.length, late = st.vehicles.filter(function (v) { return v.deviation >= 2; }).length;
    var secs = Math.max(0, Math.round((Date.now() - st.updatedAt) / 1000));
    $('#hm-status').innerHTML = (st.interrupted ? '◌ ' : '<span class="hm-dot" aria-hidden="true"></span> <strong>' + esc(t.live) + '</strong> · ') + esc(st.interrupted ? t.interrupted : t.running(n) + (late ? ' · ' + t.late(late) : ''));
    $('#hm-sub').textContent = (st.paused ? t.paused + ' · ' : '') + t.updated(secs);
    $('#hm-open').textContent = t.open;
    var p = $('#hm-pause'); p.textContent = st.paused ? t.play : t.pause; p.setAttribute('aria-pressed', String(st.paused));
    box.setAttribute('aria-label', t.region);
  }

  /* ---------- polling ---------- */
  function poll() {
    return fetchVehicles().then(function (res) {
      if (!res.live) { st.interrupted = st.ready; renderOverlay(); return; }
      st.interrupted = false; st.vehicles = res.list; st.updatedAt = Date.now();
      if (st.ready) { apply(res.list); renderOverlay(); }
      return res;
    }, function () { st.interrupted = st.ready; renderOverlay(); });
  }
  function startTimers() {
    stopTimers();
    st.timer = setInterval(function () { if (!document.hidden && !st.paused) poll(); }, POLL_MS);
    st.tick = setInterval(function () { if (!document.hidden) renderOverlay(); }, 1000);
  }
  function stopTimers() { clearInterval(st.timer); clearInterval(st.tick); }

  /* ---------- boot ---------- */
  function boot() {
    if (navigator.connection && navigator.connection.saveData) return; // data saver: keep the light illustration
    Promise.all([TRANSIT.routes(), fetchVehicles()]).then(function (r) {
      r[0].forEach(function (x) { st.routes[x.routeId] = x; });
      if (!r[1].live || !r[1].list.length) return; // feed down or no buses: keep the illustration
      st.vehicles = r[1].list; st.updatedAt = Date.now();
      return loadLeaflet().then(function () {
        build(); st.ready = true;
        hero.setAttribute('data-live', 'true');
        st.map.invalidateSize();
        apply(st.vehicles); renderOverlay(); startTimers();
      });
    }).catch(function () { /* illustration stays */ });
  }

  document.addEventListener('camtran:lang', renderOverlay);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && st.ready && !st.paused) poll(); });

  if (document.readyState === 'complete') setTimeout(boot, 0);
  else window.addEventListener('load', function () { if (window.requestIdleCallback) window.requestIdleCallback(boot, { timeout: 2000 }); else setTimeout(boot, 200); });
})();
