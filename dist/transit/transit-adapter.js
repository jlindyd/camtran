/* Transit adapter: the seam between the website and operational transit data (routes, vehicles, stops,
   arrivals, service messages). Separate from the CMS adapter on purpose: editorial content has revisions
   and approvals; operational data is read-only and machine-generated.

   Providers (config.provider)
   - 'auto'   (default) try the live feed, fall back to the recorded sample snapshot if it is unreachable
   - 'live'   live feed only (errors surface)
   - 'sample' recorded snapshot only (transit/sample.js), used for offline demos and tests

   The live feed is CamTran's public myStop (Avail InfoPoint) JSON service. In production this adapter
   points at the agency's GTFS-Realtime / AVL integration; the site code does not change.

   Privacy: every record is rebuilt from an allow-list of fields. Driver names/IDs and other operator
   data in the vendor responses are never copied, rendered or stored. */
(function (root) {
  'use strict';

  var config = { provider: 'auto', baseUrl: 'https://live.camtranbus.com/InfoPoint', timeoutMs: 8000 };
  var status = { mode: 'sample', updated: null, error: null };
  var statusListeners = [];
  var sources = {};
  function provenance(res, name, args, mode, error) {
    var meta = { mode: mode, updated: mode === 'live' ? Date.now() : snap().takenAt, error: error || null };
    // Metadata belongs to the returned dataset, never to whichever request completed last.
    res = JSON.parse(JSON.stringify(res));
    Object.defineProperty(res, '_source', { value: meta });
    sources[name + ':' + (args[0] && args[0].id || args[0] || '')] = meta;
    if (Array.isArray(res)) res.forEach(function (x) { if (x && typeof x === 'object') x.dataSource = mode; });
    var all = Object.keys(sources).map(function (k) { return sources[k]; });
    setStatus(all.some(function (m) { return m.mode !== 'live'; }) ? { mode: 'sample', updated: snap().takenAt, error: error || 'Some datasets are recorded samples; see panel source labels.' } : meta);
    return res;
  }
  var cache = { routes: null, stops: {}, details: {} };

  /* ---------- pure normalizers (unit-tested) ---------- */

  // "/Date(1791990038000-0400)/" -> epoch ms. Returns null for anything else.
  function parseMsDate(v) {
    var m = /\/Date\((-?\d+)/.exec(String(v == null ? '' : v));
    return m ? Number(m[1]) : null;
  }
  function str(v) { return v == null ? '' : String(v); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function hex(c) { return /^[0-9a-f]{6}$/i.test(c || '') ? '#' + c.toLowerCase() : '#27424b'; }

  function normalizeRoute(r) {
    return {
      id: str(r.ShortName || r.RouteAbbreviation || r.RouteId),
      routeId: r.RouteId,
      name: str(r.LongName || r.IvrDescription),
      color: hex(r.Color),
      textColor: hex(r.TextColor || 'ffffff'),
      trace: str(r.RouteTraceFilename)
    };
  }

  function normalizeStop(s) {
    return { id: s.StopId, name: str(s.Name || s.Description), lat: num(s.Latitude), lng: num(s.Longitude), timepoint: !!s.IsTimePoint };
  }

  var DIRECTION = { O: 'Outbound', I: 'Inbound' };

  // RouteDetails/Get response -> ordered stops per direction. Operator data on nested vehicles is ignored.
  function normalizeRouteDetail(raw) {
    var byId = {};
    (raw.Stops || []).forEach(function (s) { byId[s.StopId] = normalizeStop(s); });
    var groups = {};
    (raw.RouteStops || []).forEach(function (rs) { (groups[rs.Direction] = groups[rs.Direction] || []).push(rs); });
    var codes = (raw.Directions || []).map(function (d) { return d.Dir; });
    Object.keys(groups).forEach(function (c) { if (codes.indexOf(c) === -1) codes.push(c); });
    return {
      routeId: raw.RouteId,
      directions: codes.map(function (c) {
        var ordered = (groups[c] || []).slice().sort(function (a, b) { return a.SortOrder - b.SortOrder; });
        return { code: c, name: DIRECTION[c] || c, stops: ordered.map(function (rs) { return byId[rs.StopId]; }).filter(Boolean) };
      }).filter(function (d) { return d.stops.length; })
    };
  }

  // Allow-list only. DriverName / DriverFirstName / DriverLastName / DriverFareboxId are intentionally absent.
  function normalizeVehicle(v) {
    var lat = num(v.Latitude), lng = num(v.Longitude);
    if (lat == null || lng == null || (lat === 0 && lng === 0)) return null;
    return {
      id: v.VehicleId,
      name: str(v.Name),
      routeId: v.RouteId,
      lat: lat, lng: lng,
      heading: num(v.Heading) || 0,
      speed: num(v.Speed) || 0,
      destination: str(v.Destination),
      direction: str(v.DirectionLong || v.Direction),
      status: str(v.DisplayStatus),
      deviation: num(v.Deviation) || 0,
      lastStop: str(v.LastStop),
      occupancy: str(v.OccupancyStatusReportLabel),
      updated: parseMsDate(v.LastUpdated)
    };
  }

  // Flatten StopDepartures/Get response into upcoming departures, soonest first.
  function normalizeDepartures(raw, nowMs) {
    var out = [];
    (raw || []).forEach(function (stop) {
      (stop.RouteDirections || []).forEach(function (rd) {
        (rd.Departures || []).forEach(function (d) {
          if (d.IsCompleted) return;
          var predicted = parseMsDate(d.ETA) || parseMsDate(d.EDT);
          var eta = predicted || parseMsDate(d.STA) || parseMsDate(d.SDT);
          var sta = parseMsDate(d.STA) || parseMsDate(d.SDT) || eta;
          if (eta == null) return;
          out.push({
            routeId: rd.RouteId,
            direction: str(rd.Direction),
            destination: str(d.Trip && (d.Trip.InternetServiceDesc || d.Trip.InternalSignDesc)),
            etaMs: eta, staMs: sta,
            prediction: predicted != null ? 'estimated' : 'scheduled',
            minutes: Math.max(0, Math.round((eta - nowMs) / 60000)),
            delayMin: Math.round((eta - sta) / 60000)
          });
        });
      });
    });
    return out.filter(function (d) { return d.etaMs >= nowMs - 60000; }).sort(function (a, b) { return a.etaMs - b.etaMs; });
  }

  var EFFECT = { 1: 'info', 2: 'info', 3: 'info', 4: 'detour', 6: 'detour', 9: 'detour' }; // GTFS-RT effect codes

  // Public service messages -> alert-shaped objects, active "now" only.
  function normalizeMessages(raw, routes, nowMs) {
    var byRouteId = {};
    (routes || []).forEach(function (r) { byRouteId[r.routeId] = r.id; });
    return (raw || []).filter(function (m) {
      var from = parseMsDate(m.FromDate), to = parseMsDate(m.ToDate);
      return m.Published !== false && (from == null || from <= nowMs) && (to == null || to + 86400000 >= nowMs);
    }).map(function (m) {
      var ids = (m.Routes || []).map(function (id) { return byRouteId[id] || String(id); });
      var text = str(m.Message || m.Header).trim();
      var to = parseMsDate(m.ToDate);
      return {
        id: 'myStop-' + m.MessageId,
        source: 'myStop',
        severity: EFFECT[m.Effect] || 'info',
        routes: ids,
        end: to ? new Date(to).toISOString().slice(0, 10) : '',
        text: text,
        title: ids.length ? { en: 'Route ' + ids.join(', ') + ' notice', es: 'Aviso de la ruta ' + ids.join(', ') } : { en: 'Service notice', es: 'Aviso de servicio' }
      };
    });
  }

  // KML -> array of polylines, each [[lat,lng],...]
  function parseKmlLines(kml) {
    var lines = [], re = /<coordinates>([\s\S]*?)<\/coordinates>/g, m;
    while ((m = re.exec(String(kml || '')))) {
      var pts = m[1].trim().split(/\s+/).map(function (t) { var p = t.split(','); return [Number(p[1]), Number(p[0])]; })
        .filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
      if (pts.length > 1) lines.push(pts);
    }
    return lines;
  }

  /* ---------- providers ---------- */

  function fetchJson(path) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, config.timeoutMs) : null;
    return fetch(config.baseUrl + path, { signal: ctl ? ctl.signal : undefined, headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(timer); return j; }, function (e) { clearTimeout(timer); throw e; });
  }
  function fetchText(path) {
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, config.timeoutMs);
    return fetch(config.baseUrl + path, { signal: ctl.signal }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (text) { clearTimeout(timer); return text; }, function (e) { clearTimeout(timer); throw e; });
  }

  var live = {
    routes: function () { return fetchJson('/rest/Routes/GetVisibleRoutes').then(function (a) { return a.map(normalizeRoute); }); },
    routeDetail: function (routeId) { return fetchJson('/rest/RouteDetails/Get/' + encodeURIComponent(routeId)).then(normalizeRouteDetail); },
    stops: function (routeId) { return fetchJson('/rest/Stops/GetAllStopsForRoutes?routeIDs=' + encodeURIComponent(routeId)).then(function (a) { return a.map(normalizeStop); }); },
    vehicles: function () { return fetchJson('/rest/Vehicles/GetAllVehicles').then(function (a) { return a.map(normalizeVehicle).filter(Boolean); }); },
    departures: function (stopId) { return fetchJson('/rest/StopDepartures/Get/' + encodeURIComponent(stopId)).then(function (a) { return normalizeDepartures(a, Date.now()); }); },
    messages: function (routes) { return fetchJson('/rest/PublicMessages/GetCurrentMessages').then(function (a) { return normalizeMessages(a, routes, Date.now()); }); },
    trace: function (route) { return route.trace ? fetchText('/Resources/Traces/' + route.trace).then(parseKmlLines) : Promise.resolve([]); }
  };

  function snap() { return root.TRANSIT_SAMPLE || { routes: [], stops: {}, vehicles: [], departures: {}, messages: [], traces: {}, takenAt: null }; }
  var sample = {
    routes: function () { return Promise.resolve(snap().routes); },
    stops: function (routeId) { return Promise.resolve((snap().stops[routeId] || []).map(function (a) { return { id: a[0], name: a[1], lat: a[2], lng: a[3], timepoint: !!a[4] }; })); },
    routeDetail: function (routeId) {
      var s = snap(), pool = s.stops[routeId] || [], byId = {}, det = (s.details || {})[routeId] || {};
      pool.forEach(function (a) { byId[a[0]] = { id: a[0], name: a[1], lat: a[2], lng: a[3], timepoint: !!a[4] }; });
      return Promise.resolve({ routeId: Number(routeId), directions: Object.keys(det).map(function (c) {
        return { code: c, name: DIRECTION[c] || c, stops: det[c].map(function (id) { return byId[id]; }).filter(Boolean) };
      }).filter(function (d) { return d.stops.length; }) });
    },
    vehicles: function () { return Promise.resolve(snap().vehicles); },
    departures: function (stopId) {
      var d = snap().departures[stopId] || [], t = Date.now();
      return Promise.resolve(d.map(function (x) { return Object.assign({}, x, { etaMs: t + x.minutes * 60000, staMs: t + (x.minutes - x.delayMin) * 60000 }); }));
    },
    messages: function () { return Promise.resolve(snap().messages); },
    trace: function (route) { return Promise.resolve(snap().traces[route.id] || []); }
  };

  /* ---------- public API ---------- */

  function setStatus(next) {
    status = { mode: next.mode, updated: next.updated || status.updated, error: next.error || null };
    statusListeners.forEach(function (fn) { try { fn(status); } catch (e) { /* listener errors never break data flow */ } });
  }

  // Run a call against the preferred provider; in 'auto' mode, fall back to the snapshot on any failure.
  function run(name, args) {
    var useSample = config.provider === 'sample';
    if (useSample) return sample[name].apply(null, args).then(function (r) { return provenance(r, name, args, 'sample'); });
    return live[name].apply(null, args).then(function (res) {
      return provenance(res, name, args, 'live');
    }, function (err) {
      if (config.provider === 'live') throw err;
      return sample[name].apply(null, args).then(function (r) { return provenance(r, name, args, 'sample', err && err.message ? err.message : String(err)); });
    });
  }

  root.TRANSIT = {
    configure: function (o) { Object.assign(config, o || {}); sources = {}; cache = { routes: null, stops: {}, details: {} }; },
    info: function (data) { return data && data._source || { mode: 'loading', updated: null }; },
    status: function () { return status; },
    onStatus: function (fn) { statusListeners.push(fn); },
    takenAt: function () { return snap().takenAt; },

    routes: function () {
      if (cache.routes) return Promise.resolve(cache.routes);
      return run('routes', []).then(function (r) { if (r._source.mode === 'live') cache.routes = r; return r; });
    },
    stops: function (routeId) {
      if (cache.stops[routeId]) return Promise.resolve(cache.stops[routeId]);
      return run('stops', [routeId]).then(function (s) { if (s._source.mode === 'live') cache.stops[routeId] = s; return s; });
    },
    routeDetail: function (routeId) {
      if (cache.details[routeId]) return Promise.resolve(cache.details[routeId]);
      return run('routeDetail', [routeId]).then(function (d) { if (d._source.mode === 'live') cache.details[routeId] = d; return d; });
    },
    vehicles: function () { return run('vehicles', []); },
    departures: function (stopId) { return run('departures', [stopId]); },
    messages: function () { return knownRoutes().then(function (routes) { return run('messages', [routes]); }); },
    trace: function (route) { return run('trace', [route]); },

    _internals: { parseMsDate: parseMsDate, normalizeRoute: normalizeRoute, normalizeStop: normalizeStop, normalizeRouteDetail: normalizeRouteDetail, normalizeVehicle: normalizeVehicle, normalizeDepartures: normalizeDepartures, normalizeMessages: normalizeMessages, parseKmlLines: parseKmlLines }
  };

  function knownRoutes() { return root.TRANSIT.routes().catch(function () { return []; }); }
})(typeof window !== 'undefined' ? window : globalThis);
