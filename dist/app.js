/* CamTran public site (RFP 26-05 proof of concept).
   All dynamic content (alerts, routes, fares, news, events) is read through window.CMS. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var state = { lang: 'en', filter: 'all', routes: [], alerts: [], news: [], events: [], fares: [] };
  var returnFocus, modalCleanup = null;

  /* ---------- interface strings ---------- */
  var ES = {
    skip: 'Saltar al contenido', navRoutes: 'Rutas y horarios', navFares: 'Tarifas y pases', navRide: 'Servicios', navNews: 'Noticias y eventos', navAbout: 'Comunidad',
    track: 'Rastrear autobús ↗', eyebrow: 'CONECTAMOS EL CONDADO DE CAMBRIA.',
    headline: 'Tu día.<br>Tu destino.<br><em>Tu viaje.</em>',
    description: 'Desde tu viaje diario hasta tu próxima aventura. Te ayudamos a encontrar una mejor manera de llegar.',
    heroFoot: 'Conectamos a nuestros vecinos.<br>Unimos a nuestras comunidades.', busCard: 'Lo bueno está en camino.', busSub: 'Vamos a tu destino.',
    plan: '↗ Planificar viaje', trackTab: '◉ Rastrear autobús', findTab: '≡ Buscar ruta', sample: 'DEMOSTRACIÓN · DATOS DE EJEMPLO',
    from: 'Origen', to: 'Destino', when: 'Cuándo', leaveNow: 'Salir ahora (demo)', tomorrow: 'Mañana por la mañana (demo)', findTrip: 'Buscar mi viaje →',
    trackHint: 'Selecciona una ruta en la vista de llegadas.', trackLink: 'Explorar el rastreo →', findHint: 'Busca por número de ruta o destino.', findLink: 'Ver rutas de ejemplo →',
    routesEye: 'UNA RUTA PARA TU DÍA', routesTitle: '¿A dónde vas?', routesIntro: 'Encuentra tu conexión en Johnstown<br>y el norte del condado de Cambria.',
    searchPh: 'Buscar número de ruta o destino', fAll: 'Todas las rutas', fUrban: 'Urbanas', fRural: 'Rurales / CamTran+',
    routesNote: 'Rutas y paradas del sistema público de rastreo de CamTran. Los horarios no se reproducen aquí; usa las salidas en vivo o los horarios oficiales.',
    trackerEye: 'MENOS ADIVINAR. MÁS VIAJAR.', trackerTitle: 'Tu próximo autobús,<br>de un vistazo.', trackerText: 'Mira dónde están los autobuses ahora y cuándo llega el próximo a tu parada.',
    route: 'Ruta', stopLabel: 'Parada', liveLink: 'Abrir el rastreador en vivo de CamTran ↗', arrPrev: 'VISTA DE LLEGADAS', demoData: 'DATOS DE EJEMPLO',
    illStop: 'Parada ilustrativa · no es información de salidas en vivo', boardFoot: '◷ Solo horarios de ejemplo. Usa el rastreador en vivo para viajar.',
    faresEye: 'UN POCO DE PLANIFICACIÓN. MUCHAS POSIBILIDADES.', faresTitle: 'Tu viaje. Tu forma de pagar.', confirmFares: 'Confirmar tarifas vigentes ↗',
    faresNote: 'Ejemplos de tarifas urbanas para adultos de la página oficial de CamTran. Confirma la elegibilidad y los precios vigentes antes de comprar.',
    discounts: 'Opciones para estudiantes, mayores y tarifa reducida →',
    servicesEye: 'MÁS FORMAS DE ESTAR CONECTADO', servicesTitle: 'Cada pasajero cuenta.', servicesText: 'Encuentra el servicio que se ajusta a tus necesidades, con orientación clara en cada paso.',
    accessLink: 'Transporte accesible ↗', svcAdaT: 'ADA y paratránsito', svcAdaD: 'Elegibilidad, solicitudes y ayuda para organizar tu viaje.',
    svcRarD: 'Una conexión más allá de la ruta fija.', svcMatpT: 'Transporte médico', svcMatpD: 'Conoce el Programa de Transporte de Asistencia Médica.',
    newsEye: 'NOTICIAS Y EVENTOS · DEMO', newsTitle: 'Lo que está pasando.', calendarBtn: 'Abrir el calendario comunitario →',
    commEye: 'ARRAIGADOS AQUÍ. AVANZANDO.', commTitle: 'Más que un viaje.', commText: 'Las personas, los lugares y las posibilidades<br>que forman nuestra comunidad.',
    careers: 'EMPLEOS', careersT: 'Impulsa tu carrera.', careersD: 'Conoce las oportunidades en CamTran. ↗', biz: 'HAZ NEGOCIOS CON NOSOTROS', bizT: 'Mejor, juntos.', bizD: 'Oportunidades de compras y alianzas. ↗',
    helpEye: 'UNA PERSONA REAL. UNA MANO AMIGA.', helpTitle: 'Te ayudamos a llegar.', helpLink: 'Contactar al servicio al pasajero ↗'
  };
  var UI = { // dynamic strings used by scripts
    en: {
      alertLabel: { info: 'SERVICE NOTICE', detour: 'DETOUR', weather: 'WEATHER NOTICE', emergency: 'EMERGENCY' },
      details: 'View details →', more: function (n) { return '+' + n + ' more'; }, allAlerts: 'Service alerts', fromTracker: 'From CamTran’s live tracker system',
      before: 'Before you travel', beforeText: 'Check the official website or live tracker for current operating information.', official: 'Visit the official CamTran website ↗',
      affects: 'Affects routes', until: 'Through', noAlerts: 'No active alerts.',
      sampleNotice: 'This is a sample notice, not an active service alert.',
      sameLoc: 'Please choose different starting and ending locations.',
      journey: 'Sample journey', conn: 'Illustrative connection only. Not a calculated itinerary.', exploreRoute: 'Explore route',
      noRoutes: 'No matching routes. Try “Galleria”, “18”, or clear your search.', shown: function (n) { return n + ' routes · from CamTran’s tracker system'; },
      urban: 'URBAN', rural: 'CAMTRAN+', outbound: 'Outbound', inbound: 'Inbound',
      ruralTitle: 'Explore CamTran+', ruralText: 'Rural service connects northern Cambria County. This prototype links to the official directory instead of inventing route numbers or service times.', ruralLink: 'View official rural schedules ↗',
      demoOnly: 'Demonstration only. The stop sequence and times below are illustrative and must not be used for travel.',
      sampleTT: 'Sample weekday timetable', ttCaption: 'Illustrative departures, not an operating schedule', trip: 'Trip', firstStop: 'First stop', lastStop: 'Last stop',
      officialSched: 'Official schedules and downloadable PDFs ↗', sampleDep: 'Sample departure', demoMin: 'DEMO MIN',
      discTitle: 'A fare that fits.', discText1: 'CamTran publishes fare options for students, seniors, children, and riders eligible for reduced fares. Requirements and documentation vary by program.', discText2: 'Confirm eligibility and current prices directly with CamTran before travel.', discLink: 'Explore official fares and discounts ↗',
      svcSteps: ['Review the service and eligibility information.', 'Contact CamTran for help choosing the right program.', 'Complete the official application, if required.'],
      svcNote: 'This demonstration does not determine eligibility or collect applications.', svcLink: 'Continue to official program information ↗',
      calTitle: 'Community calendar', calNote: 'Sample events for demonstrating the calendar interface. Managed in the CMS.', noEvents: 'No upcoming events.',
      newsNone: 'No announcements right now.', lang: 'ES', langLabel: 'Cambiar a español'
    },
    es: {
      alertLabel: { info: 'AVISO DE SERVICIO', detour: 'DESVÍO', weather: 'AVISO DEL CLIMA', emergency: 'EMERGENCIA' },
      details: 'Ver detalles →', more: function (n) { return '+' + n + ' más'; }, allAlerts: 'Alertas de servicio', fromTracker: 'Del sistema de rastreo en vivo de CamTran',
      before: 'Antes de viajar', beforeText: 'Consulta el sitio oficial o el rastreador en vivo para obtener información operativa actual.', official: 'Visitar el sitio oficial de CamTran ↗',
      affects: 'Rutas afectadas', until: 'Hasta', noAlerts: 'No hay alertas activas.',
      sampleNotice: 'Este es un aviso de ejemplo, no una alerta de servicio activa.',
      sameLoc: 'Elige un origen y un destino diferentes.',
      journey: 'Viaje de ejemplo', conn: 'Solo una conexión ilustrativa. No es un itinerario calculado.', exploreRoute: 'Explorar ruta',
      noRoutes: 'No hay rutas que coincidan. Prueba “Galleria”, “18” o borra la búsqueda.', shown: function (n) { return n + ' rutas · del sistema de rastreo de CamTran'; },
      urban: 'URBANA', rural: 'CAMTRAN+', outbound: 'Ida', inbound: 'Regreso',
      ruralTitle: 'Conoce CamTran+', ruralText: 'El servicio rural conecta el norte del condado de Cambria. Este prototipo enlaza al directorio oficial en lugar de inventar números de ruta u horarios.', ruralLink: 'Ver horarios rurales oficiales ↗',
      demoOnly: 'Solo demostración. La secuencia de paradas y los horarios son ilustrativos y no deben usarse para viajar.',
      sampleTT: 'Horario de ejemplo entre semana', ttCaption: 'Salidas ilustrativas, no un horario operativo', trip: 'Viaje', firstStop: 'Primera parada', lastStop: 'Última parada',
      officialSched: 'Horarios oficiales y PDF descargables ↗', sampleDep: 'Salida de ejemplo', demoMin: 'MIN DEMO',
      discTitle: 'Una tarifa a tu medida.', discText1: 'CamTran publica tarifas para estudiantes, mayores, niños y pasajeros elegibles para tarifa reducida. Los requisitos varían según el programa.', discText2: 'Confirma la elegibilidad y los precios vigentes directamente con CamTran antes de viajar.', discLink: 'Ver tarifas y descuentos oficiales ↗',
      svcSteps: ['Revisa la información del servicio y la elegibilidad.', 'Comunícate con CamTran para elegir el programa adecuado.', 'Completa la solicitud oficial, si se requiere.'],
      svcNote: 'Esta demostración no determina la elegibilidad ni recibe solicitudes.', svcLink: 'Continuar a la información oficial del programa ↗',
      calTitle: 'Calendario comunitario', calNote: 'Eventos de ejemplo para demostrar el calendario. Administrados en el CMS.', noEvents: 'No hay eventos próximos.',
      newsNone: 'No hay anuncios por ahora.', lang: 'EN', langLabel: 'Switch to English'
    }
  };
  var SERVICES = {
    paratransit: { t: { en: 'ADA & paratransit', es: 'ADA y paratránsito' }, d: { en: 'Explore eligibility, application requirements, service boundaries, and reservations with CamTran.', es: 'Conoce la elegibilidad, los requisitos de solicitud, las zonas de servicio y las reservas con CamTran.' }, href: 'https://www.camtranbus.com/disability-services/' },
    shared: { t: { en: 'Reserve-A-Ride', es: 'Reserve-A-Ride' }, d: { en: 'Learn about shared ride service, eligibility, reservations, and applicable fares.', es: 'Conoce el servicio de viaje compartido, la elegibilidad, las reservas y las tarifas.' }, href: 'https://www.camtranbus.com/services/reserve-a-ride/' },
    medical: { t: { en: 'Medical transportation', es: 'Transporte médico' }, d: { en: 'Explore the Medical Assistance Transportation Program and its application process.', es: 'Conoce el Programa de Transporte de Asistencia Médica y su proceso de solicitud.' }, href: 'https://www.camtranbus.com/matp-2/' }
  };

  var EN = {};
  Object.assign(ES, { stopSearch: 'Buscar paradas', showMap: 'Explorar el mapa', footerTag: 'Conectamos el condado de Cambria.<br>Un viaje a la vez.', publicInfo: 'Información pública ↗', footerAda: 'Accesibilidad y ADA ↗', footerGuide: 'Prototipo y guía de evaluación ↗', independent: 'Prototipo independiente · No es el sitio oficial de CamTran.', boundary: 'Datos ilustrativos. No se reciben pagos ni solicitudes.', editorLink: 'Probar el editor CMS ↗', guideLink: 'Guía de demostración ↗' });
  $$('[data-i]').forEach(function (el) { EN[el.dataset.i] = el.innerHTML; });
  var T = function () { return UI[state.lang]; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmtDate = function (iso, opts) { return new Date(iso + 'T12:00:00').toLocaleDateString(state.lang === 'es' ? 'es-US' : 'en-US', opts || { month: 'long', day: 'numeric' }); };

  /* ---------- dialog ---------- */
  var modal = $('#modal');
  function openModal(html) {
    if (modalCleanup) { modalCleanup(); modalCleanup = null; }
    returnFocus = document.activeElement;
    $('#modal-body').innerHTML = html;
    var h = $('#modal-body h2'); if (h) h.id = 'modal-title';
    modal.showModal();
    $('#close-modal').focus();
  }
  $('#close-modal').onclick = function () { modal.close(); };
  modal.addEventListener('close', function () { if (modalCleanup) { modalCleanup(); modalCleanup = null; } if (returnFocus) returnFocus.focus(); });
  modal.addEventListener('click', function (e) {
    if (e.target !== modal) return;
    var r = modal.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) modal.close();
  });

  /* ---------- CMS-backed rendering ---------- */
  function loadContent() {
    var l = state.lang;
    return Promise.all([CMS.published('alerts', l), CMS.published('routes', l), CMS.published('fares', l), CMS.published('news', l), CMS.published('events', l), liveMessages(l), TRANSIT.routes().catch(function () { return []; })])
      .then(function (r) {
        var rank = { emergency: 0, weather: 1, detour: 2, info: 3 };
        state.alerts = r[0].concat(r[5]).sort(function (a, b) { return (Number(!a.source) - Number(!b.source)) || (rank[a.severity] - rank[b.severity]) || 0; });
        state.routes = mergeRoutes(r[1], r[6]); state.fares = r[2];
        state.news = r[3].sort(function (a, b) { return a.date < b.date ? -1 : 1; });
        state.events = r[4].sort(function (a, b) { return a.date < b.date ? -1 : 1; });
        renderAll();
      })
      .catch(function (err) {
        $('#alert-region').innerHTML = '';
        $('#route-count').textContent = 'Content could not be loaded: ' + err.message;
      });
  }
  // Operational routes (live feed) are the directory; the CMS adds editorial text, such as areas served and translations.
  function mergeRoutes(cms, live) {
    if (!live.length) return cms;
    var byId = {}; cms.forEach(function (r) { byId[r.id] = r; });
    return live.map(function (t) {
      var c = byId[t.id];
      return { id: t.id, routeId: t.routeId, name: c ? c.name : t.name, places: c ? c.places : '', area: c ? c.area : (Number(t.id) >= 30 ? 'rural' : 'urban'), color: t.color, trace: t.trace, live: true };
    }).sort(function (a, b) { return Number(a.id) - Number(b.id); });
  }

  // Active notices from the agency's live tracker system, shown next to CMS alerts. Only while the feed is live:
  // a recorded sample must never surface as a current service notice.
  var msgCache = { at: 0, items: [] };
  function liveMessages(lang) {
    var shape = function (items) { return items.map(function (m) { return { id: m.id, source: m.source, severity: m.severity, title: m.title[lang] || m.title.en, body: m.text, routes: m.routes, end: m.end }; }); };
    if (Date.now() - msgCache.at < 60000 && (TRANSIT.info(msgCache.items).mode === 'live' || !msgCache.items.length)) return Promise.resolve(shape(msgCache.items));
    return TRANSIT.messages().then(function (items) {
      msgCache = { at: Date.now(), items: TRANSIT.info(items).mode === 'live' ? items : [] };
      return shape(msgCache.items);
    }, function () { return []; });
  }

  // Date windows are evaluated in Pennsylvania time; refresh an already-open page too.
  setInterval(function () { if (!document.hidden) loadContent(); }, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loadContent(); });

  function renderAll() { renderAlerts(); renderRoutes(); renderFares(); renderNews(); }

  function renderAlerts() {
    var region = $('#alert-region');
    if (!state.alerts.length) { region.innerHTML = ''; return; }
    var a = state.alerts[0], t = T(), emergency = a.severity === 'emergency';
    region.innerHTML =
      '<div class="alert alert-' + esc(a.severity) + (emergency ? ' alert-emergency' : '') + '" role="' + (emergency ? 'alert' : 'status') + '">' +
      '<div><span class="alert-symbol" aria-hidden="true">!</span><strong>' + esc((!a.source ? (state.lang === 'es' ? 'DEMO · ' : 'DEMO NOTICE · ') : '') + (t.alertLabel[a.severity] || t.alertLabel.info)) + '</strong>' +
      '<span id="alert-text">' + esc(a.title) + (a.body ? ' — ' + esc(a.body) : '') + '</span></div>' +
      '<button id="alert-details" type="button">' + (state.alerts.length > 1 ? esc(t.more(state.alerts.length - 1)) + ' · ' : '') + esc(t.details) + '</button></div>';
    $('#alert-details').onclick = showAlerts;
  }

  function showAlerts() {
    var t = T();
    openModal('<h2>' + esc(t.allAlerts) + '</h2>' + (state.alerts.some(function (a) { return !a.source; }) ? '<p class="preview-notice">' + esc(t.sampleNotice) + '</p>' : '') +
      state.alerts.map(function (a) {
        return '<article class="alert-item"><p class="eyebrow">' + esc(t.alertLabel[a.severity]) + (a.source ? ' · ' + esc(t.fromTracker) : ' · DEMO') + '</p><h3>' + esc(a.title) + '</h3><p>' + esc(a.body) + '</p>' +
          ((a.routes && a.routes.length) ? '<p><strong>' + esc(t.affects) + ':</strong> ' + a.routes.map(esc).join(', ') + '</p>' : '') +
          (a.end ? '<p><strong>' + esc(t.until) + ':</strong> ' + esc(fmtDate(a.end, { month: 'long', day: 'numeric', year: 'numeric' })) + '</p>' : '') + '</article>';
      }).join('') +
      '<h3>' + esc(t.before) + '</h3><p>' + esc(t.beforeText) + '</p><a href="https://www.camtranbus.com/">' + esc(t.official) + '</a>');
  }

  function renderRoutes() {
    var t = T(), q = $('#route-search').value.trim().toLowerCase();
    var shown = state.routes.filter(function (r) { return (state.filter === 'all' || r.area === state.filter) && (r.id + ' ' + r.name + ' ' + r.places).toLowerCase().indexOf(q) !== -1; });
    $('#route-list').innerHTML = shown.length ? shown.map(function (r) {
      return '<button class="route-row" type="button" data-route="' + esc(r.id) + '"><span class="route-number"' + (r.color ? ' style="background:' + r.color + ';color:' + contrastInk(r.color) + '"' : '') + '>' + esc(r.id) + '</span><div><h3>' + esc(r.name) + '</h3>' + (r.places ? '<p>' + esc(r.places) + '</p>' : '') + '</div><span class="route-type">' + (r.area === 'urban' ? t.urban : t.rural) + '</span><b aria-hidden="true">↗</b></button>';
    }).join('') : '<p class="no-results">' + esc(t.noRoutes) + '</p>';
    $('#route-count').textContent = t.shown(shown.length);
    $$('[data-route]').forEach(function (b) { b.onclick = function () { routeDetail(b.dataset.route); }; });
  }

  /* ---------- route detail (live route data) ---------- */
  var RD = {
    en: {
      stopsH: 'Stops, in order', mainStop: 'Main stop', departH: 'Next departures', from: 'At stop', due: 'Due', min: 'min', onTime: 'On time',
      late: function (n) { return n + ' min late'; }, early: function (n) { return n + ' min early'; },
      noDeps: 'No upcoming departures reported for this route at this stop.', noSampleDeps: 'The recorded sample has no departures for this stop.',
      busesH: 'Buses on this route', busesNow: function (n) { return n + ' bus' + (n === 1 ? '' : 'es') + ' reporting now'; }, noBuses: 'No buses on this route are reporting right now.',
      toward: 'To', lastStop: 'Last stop', noSignal: 'No recent signal', noticesH: 'Notices for this route', noNotices: 'No notices for this route.',
      live: 'LIVE', sample: 'SAMPLE DATA', updated: 'Updated', recorded: 'Recorded', liveNote: 'Live from CamTran’s public myStop feed. Independent prototype; confirm with CamTran before you travel.',
      sampleNote: 'Live feed unavailable or not selected. Showing a recorded sample; positions and times are not current.',
      mapDown: 'The map could not load. Use the stop list below.', mapLabel: 'Route map', dirLabel: 'Direction', loading: 'Loading live route data…', failed: 'Route data could not be loaded.',
      nodetail: 'Detailed stop data is not available for this route in this prototype.', boardH: 'Boarding assistance',
      boardText: 'Contact CamTran to confirm stop access, ramp boarding, and any accommodations you need.', a11yLink: 'Official accessibility information ↗',
      sched: 'Official schedules and downloadable PDFs ↗', tt: 'Timetables are not reproduced here. Use the departures above or the official schedules.'
    },
    es: {
      stopsH: 'Paradas, en orden', mainStop: 'Parada principal', departH: 'Próximas salidas', from: 'En la parada', due: 'Llegando', min: 'min', onTime: 'A tiempo',
      late: function (n) { return n + ' min de retraso'; }, early: function (n) { return n + ' min antes'; },
      noDeps: 'No hay salidas próximas de esta ruta en esta parada.', noSampleDeps: 'La muestra grabada no tiene salidas para esta parada.',
      busesH: 'Autobuses en esta ruta', busesNow: function (n) { return n + ' autobús' + (n === 1 ? '' : 'es') + ' reportando ahora'; }, noBuses: 'Ningún autobús de esta ruta está reportando ahora.',
      toward: 'Hacia', lastStop: 'Última parada', noSignal: 'Sin señal reciente', noticesH: 'Avisos para esta ruta', noNotices: 'No hay avisos para esta ruta.',
      live: 'EN VIVO', sample: 'DATOS DE EJEMPLO', updated: 'Actualizado', recorded: 'Grabado', liveNote: 'En vivo desde el sistema público myStop de CamTran. Prototipo independiente; confirma con CamTran antes de viajar.',
      sampleNote: 'El sistema en vivo no está disponible o no está seleccionado. Se muestra una muestra grabada; las posiciones y horas no son actuales.',
      mapDown: 'No se pudo cargar el mapa. Usa la lista de paradas.', mapLabel: 'Mapa de la ruta', dirLabel: 'Dirección', loading: 'Cargando datos de la ruta en vivo…', failed: 'No se pudieron cargar los datos de la ruta.',
      nodetail: 'En este prototipo no hay datos detallados de paradas para esta ruta.', boardH: 'Ayuda para abordar',
      boardText: 'Consulta a CamTran para confirmar el acceso a la parada, el uso de rampas y las adaptaciones que necesitas.', a11yLink: 'Información oficial de accesibilidad ↗',
      sched: 'Horarios oficiales y PDF descargables ↗', tt: 'Los horarios no se reproducen aquí. Usa las salidas de arriba o los horarios oficiales.'
    }
  };
  var rdState = null;
  function contrastInk(hex) { var n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#102d39' : '#fff'; }
  function rdClose() {
    if (!rdState) return;
    clearInterval(rdState.timer);
    if (rdState.map) rdState.map.remove();
    rdState = null;
  }

  function routeDetail(id) {
    var r = state.routes.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var d = RD[state.lang], t = T();
    var official = r.area === 'rural' ? 'https://www.camtranbus.com/schedules/camtran-plus-rural-routes/' : 'https://www.camtranbus.com/schedules/camtran-urban-routes/';
    var head = '<p class="eyebrow">' + esc(r.area === 'urban' ? t.urban : t.rural) + ' / ' + esc(r.id) + '</p><h2>' + esc(r.name) + '</h2>';
    if (!r.live) { // CMS-only fallback when the transit adapter returns no routes at all
      openModal(head + '<p>' + esc(d.nodetail) + '</p><a href="' + official + '">' + esc(d.sched) + '</a>');
      return;
    }
    openModal(head + '<p id="rd-badge" class="data-badge is-sample" role="status"></p><p id="rd-loading" aria-live="polite">' + esc(d.loading) + '</p><div id="rd-body" hidden></div>');
    modalCleanup = rdClose;
    var token = rdState = { route: r, map: null, timer: null, dir: 0, detail: null, trace: [], vehicles: [], stop: null, layers: {} };
    Promise.all([TRANSIT.routeDetail(r.routeId), TRANSIT.trace(r), TRANSIT.vehicles()]).then(function (res) {
      if (rdState !== token) return; // dialog was closed meanwhile
      token.mapSource = [TRANSIT.info(res[0]), TRANSIT.info(res[1])]; token.detail = res[0]; token.trace = res[1]; token.vehicles = res[2];
      buildRouteDetail(official);
    }).catch(function () { if (rdState === token) $('#rd-loading').textContent = d.failed; });
  }

  function rdBadge() {
    var d = RD[state.lang], s = TRANSIT.info(rdState.vehicles), el = $('#rd-badge'); if (!el) return;
    var locale = state.lang === 'es' ? 'es-US' : 'en-US';
    var when = s.mode === 'live' ? d.updated + ' ' + new Date(s.updated).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York' })
      : d.recorded + ' ' + (s.updated ? new Date(s.updated).toLocaleString(locale, { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) : '');
    el.className = 'data-badge ' + (s.mode === 'live' ? 'is-live' : 'is-sample');
    el.innerHTML = '<strong>' + (state.lang === 'es' ? 'Vehículos · ' : 'Vehicles · ') + (s.mode === 'live' ? '● ' + d.live : '◌ ' + d.sample) + '</strong> · ' + esc(when) + '<br><span>' + esc(s.mode === 'live' ? d.liveNote : d.sampleNote) + '</span><br>' + (state.lang === 'es' ? 'Mapa y paradas: ' : 'Map and stops: ') + ((rdState.mapSource || []).every(function (m) { return m.mode === 'live'; }) ? d.live : d.sample);
  }

  function buildRouteDetail(officialHref) {
    var s = rdState, r = s.route, d = RD[state.lang], t = T();
    var dirs = s.detail.directions;
    $('#rd-loading').hidden = true;
    var notices = state.alerts.filter(function (a) { return !a.routes || !a.routes.length || a.routes.indexOf(r.id) !== -1; });
    var body = $('#rd-body'); body.hidden = false;
    body.innerHTML =
      '<div id="rd-map" class="rd-map" role="region" aria-label="' + esc(d.mapLabel) + '"></div>' +
      (dirs.length > 1 ? '<div class="filters" role="group" aria-label="' + esc(d.dirLabel) + '" id="rd-dirs">' + dirs.map(function (x, i) { return '<button type="button" data-dir="' + i + '" class="' + (i === 0 ? 'selected' : '') + '" aria-pressed="' + (i === 0) + '">' + esc(x.code === 'O' ? t.outbound : x.code === 'I' ? t.inbound : x.name) + '</button>'; }).join('') + '</div>' : '') +
      '<p><button class="primary" id="rd-track">' + (state.lang === 'es' ? 'Rastrear esta ruta →' : 'Track this route →') + '</button></p><h3>' + esc(d.departH) + '</h3><label class="route-day">' + esc(d.from) + '<select id="rd-stop"></select></label><div id="rd-deps" aria-live="polite"></div>' +
      '<h3>' + esc(d.busesH) + '</h3><div id="rd-vehicles" aria-live="polite"></div>' +
      '<h3>' + esc(d.stopsH) + '</h3><ol class="stop-list" id="rd-stops"></ol>' +
      '<h3>' + esc(d.noticesH) + '</h3>' + (notices.map(function (a) { return '<p class="preview-notice"><strong>' + (!a.source ? 'DEMO · ' : '') + esc(a.title) + '</strong><br>' + esc(a.body) + '</p>'; }).join('') || '<p>' + esc(d.noNotices) + '</p>') +
      '<h3>' + esc(d.boardH) + '</h3><p>' + esc(d.boardText) + '</p><a href="https://www.camtranbus.com/disability-services/">' + esc(d.a11yLink) + '</a>' +
      '<p class="small">' + esc(d.tt) + '</p><p><a href="' + officialHref + '">' + esc(d.sched) + '</a></p>';
    rdBadge();
    initRouteMap();
    $$('#rd-dirs [data-dir]').forEach(function (b) {
      b.onclick = function () {
        s.dir = Number(b.dataset.dir);
        $$('#rd-dirs [data-dir]').forEach(function (x) { var on = x === b; x.classList.toggle('selected', on); x.setAttribute('aria-pressed', on); });
        renderRdDirection(true);
      };
    });
    $('#rd-track').onclick = function () { var target = { routeId: s.route.routeId, stopId: s.stop }; modal.close(); document.dispatchEvent(new CustomEvent('camtran:track', { detail: target })); };
    $('#rd-stop').onchange = function () { s.stop = Number(this.value); drawRdStops(); refreshRdDepartures(); };
    renderRdDirection(true);
    renderRdVehicles();
    s.timer = setInterval(function () { if (!document.hidden) { refreshRdVehicles(); refreshRdDepartures(); } }, 20000);
  }

  function initRouteMap() {
    var s = rdState, r = s.route, holder = $('#rd-map');
    if (!window.L) { holder.textContent = RD[state.lang].mapDown; holder.className = 'rd-map map-fallback'; return; }
    var L = window.L;
    s.map = L.map(holder, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(s.map);
    s.layers.stops = L.layerGroup().addTo(s.map); s.layers.vehicles = L.layerGroup().addTo(s.map);
    (s.trace || []).forEach(function (pts) {
      L.polyline(pts, { color: '#102d39', weight: 7, opacity: .55, interactive: false }).addTo(s.map);
      L.polyline(pts, { color: r.color, weight: 4, interactive: false }).addTo(s.map);
    });
    s.map.setView([40.32, -78.92], 11);
    setTimeout(function () { if (rdState === s && s.map) { s.map.invalidateSize(); fitRouteMap(); } }, 60);
  }
  function fitRouteMap() {
    var s = rdState, pts = [];
    (s.trace || []).forEach(function (l) { l.forEach(function (p) { pts.push(p); }); });
    if (!pts.length) s.detail.directions.forEach(function (dir) { dir.stops.forEach(function (x) { if (x.lat != null) pts.push([x.lat, x.lng]); }); });
    if (pts.length) s.map.fitBounds(pts, { padding: [24, 24] });
  }

  function renderRdDirection(resetStop) {
    var s = rdState, d = RD[state.lang], dir = s.detail.directions[s.dir] || { stops: [] };
    $('#rd-stops').innerHTML = dir.stops.length ? dir.stops.map(function (x) { return '<li' + (x.timepoint ? ' class="tp"' : '') + '>' + esc(x.name) + (x.timepoint ? ' <small>(' + esc(d.mainStop) + ')</small>' : '') + '</li>'; }).join('') : '<li>' + esc(d.nodetail) + '</li>';
    var pickable = dir.stops;
    $('#rd-stop').innerHTML = pickable.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('');
    if (resetStop) { s.stop = pickable.length ? pickable[0].id : null; if (s.stop != null) $('#rd-stop').value = String(s.stop); }
    drawRdStops();
    refreshRdDepartures();
  }
  function drawRdStops() {
    var s = rdState; if (!s || !s.map) return;
    s.layers.stops.clearLayers();
    var dir = s.detail.directions[s.dir] || { stops: [] };
    dir.stops.forEach(function (x) {
      if (x.lat == null) return;
      var on = x.id === s.stop;
      var m = window.L.circleMarker([x.lat, x.lng], { radius: on ? 9 : (x.timepoint ? 6 : 4), color: '#102d39', weight: on ? 3 : 1.5, fillColor: on ? '#d4ed62' : '#fff', fillOpacity: 1 });
      m.bindTooltip(x.name);
      m.on('click', function () { s.stop = x.id; var sel = $('#rd-stop'); if (sel && Array.prototype.some.call(sel.options, function (o) { return o.value === String(x.id); })) sel.value = String(x.id); drawRdStops(); refreshRdDepartures(); });
      m.addTo(s.layers.stops);
    });
  }

  function rdStatus(deviation, stale) { var d = RD[state.lang]; return stale ? d.noSignal : deviation >= 2 ? d.late(deviation) : deviation <= -2 ? d.early(-deviation) : d.onTime; }
  function refreshRdDepartures() {
    var s = rdState; if (!s || s.stop == null) return;
    var request = s.depRequest = (s.depRequest || 0) + 1, stopId = s.stop, direction = s.detail.directions[s.dir]; var token = s, d = RD[state.lang], el = $('#rd-deps');
    el.textContent = d.loading; TRANSIT.departures(stopId).then(function (list) {
      if (rdState !== token || request !== s.depRequest || s.stop !== stopId) return;
      var source = TRANSIT.info(list); var mine = list.filter(function (x) { return x.routeId === s.route.routeId && (!direction || !direction.code || String(x.direction).toLowerCase() === String(direction.name).toLowerCase() || String(x.direction).toLowerCase() === String(direction.code).toLowerCase()); }).slice(0, 4);
      el.innerHTML = mine.length ? mine.map(function (x) {
        var label = x.delayMin >= 2 ? d.late(x.delayMin) : x.delayMin <= -2 ? d.early(-x.delayMin) : d.onTime;
        label = x.prediction === 'estimated' ? label : (state.lang === 'es' ? 'Horario programado' : 'Scheduled time'); label = (source.mode === 'live' ? 'LIVE' : 'SAMPLE DATA') + ' · ' + label;
        return '<div class="arrival"><span class="route-number" style="background:' + s.route.color + ';color:' + contrastInk(s.route.color) + '">' + esc(s.route.id) + '</span><div><strong>' + esc(x.destination || x.direction) + '</strong><small>' + esc(x.direction) + ' · ' + esc(label) + '</small></div><div class="arrival-time">' + (x.minutes <= 1 ? esc(d.due) : x.minutes + '<small>' + esc(d.min) + '</small>') + '</div></div>';
      }).join('') : '<p class="no-results">' + esc(source.mode !== 'live' ? d.noSampleDeps : d.noDeps) + '</p>';
      rdBadge();
    }, function () { /* adapter already falls back to the sample */ });
  }
  function rdVehicles() {
    var s = rdState, live = TRANSIT.info(rdState.vehicles).mode === 'live';
    return s.vehicles.filter(function (v) { return v.routeId === s.route.routeId; }).map(function (v) { return Object.assign({ stale: !!(live && (!v.updated || Date.now() - v.updated > 600000)) }, v); });
  }
  function renderRdVehicles() {
    var s = rdState, d = RD[state.lang], list = rdVehicles(), shown = list.filter(function (v) { return !v.stale; });
    $('#rd-vehicles').innerHTML = list.length ? '<p>' + esc(d.busesNow(shown.length)) + '</p><ul class="rd-bus-list">' + list.map(function (v) {
      return '<li><strong>' + esc(d.toward) + ' ' + esc(v.destination) + '</strong> · ' + esc(rdStatus(v.deviation, v.stale)) + '<br><small>' + esc(d.lastStop) + ': ' + esc(v.lastStop) + ' · ' + (v.dataSource === 'live' && v.updated ? esc(new Date(v.updated).toLocaleTimeString(state.lang === 'es' ? 'es-US' : 'en-US', {timeZone:'America/New_York'})) : 'SAMPLE DATA') + '</small></li>';
    }).join('') + '</ul>' : '<p>' + esc(d.noBuses) + '</p>';
    if (!s.map) return;
    s.layers.vehicles.clearLayers();
    shown.forEach(function (v) {
      var icon = window.L.divIcon({ className: 'bus-pin', html: '<span style="background:' + s.route.color + ';color:' + contrastInk(s.route.color) + '">' + esc(s.route.id) + '</span>', iconSize: [34, 24], iconAnchor: [17, 12] });
      window.L.marker([v.lat, v.lng], { icon: icon, title: d.toward + ' ' + v.destination, alt: 'Bus on route ' + s.route.id }).bindPopup('<strong>' + esc(d.toward) + ' ' + esc(v.destination) + '</strong><br>' + esc(rdStatus(v.deviation, false))).addTo(s.layers.vehicles);
    });
  }
  function refreshRdVehicles() {
    var token = rdState; if (!token) return;
    TRANSIT.vehicles().then(function (v) { if (rdState !== token) return; token.vehicles = v; renderRdVehicles(); rdBadge(); }, function () { /* keep last */ });
  }

  function renderFares() {
    $('#fare-grid').innerHTML = state.fares.map(function (f) {
      return '<article' + (f.featured ? ' class="featured"' : '') + '>' +
        (f.featured ? '<div class="fare-top"><span class="eyebrow">' + esc(f.label) + '</span></div>' : '<span class="eyebrow">' + esc(f.label) + '</span>') +
        '<h3>' + esc(f.price) + '<span>' + esc(f.unit) + '</span></h3><p>' + esc(f.desc) + '</p><a href="' + esc(f.href) + '">' + esc(f.link) + ' ↗</a></article>';
    }).join('');
  }

  function renderNews() {
    var t = T(), items = state.news.slice(0, 3);
    $('#news-list').innerHTML = items.length ? items.map(function (n) {
      return '<article class="news-card"><time datetime="' + esc(n.date) + '" class="news-date">' + esc(fmtDate(n.date)) + '</time><h3>' + esc(n.title) + '</h3><p>' + esc(n.summary) + '</p></article>';
    }).join('') : '<p class="no-results">' + esc(t.newsNone) + '</p>';
  }

  /* ---------- static-ish interactions ---------- */
  $('#route-search').oninput = renderRoutes;
  $$('[data-filter]').forEach(function (b) {
    b.onclick = function () {
      state.filter = b.dataset.filter;
      $$('[data-filter]').forEach(function (x) { x.classList.toggle('selected', x === b); x.setAttribute('aria-pressed', x === b); });
      renderRoutes();
    };
  });

  // Tabs: roving tabindex + arrow-key navigation, real tabpanels.
  var tabs = $$('[data-tab]');
  function selectTab(b, focus) {
    tabs.forEach(function (x) {
      var on = x === b;
      x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
      $('#' + x.getAttribute('aria-controls')).hidden = !on;
    });
    $('#tool-result').innerHTML = '';
    if (focus) b.focus();
  }
  tabs.forEach(function (b, i) {
    b.onclick = function () { selectTab(b); if (b.dataset.tab === 'track') { $('#tracker').scrollIntoView({ behavior: 'smooth' }); $('#tracker-route').focus(); } };
    b.onkeydown = function (e) {
      var k = e.key, n = null;
      if (k === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
      else if (k === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (k === 'Home') n = tabs[0];
      else if (k === 'End') n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); selectTab(n, true); }
    };
  });

  $('#swap').onclick = function () { var a = $('#origin').value; $('#origin').value = $('#destination').value; $('#destination').value = a; };
  $('#trip-form').onsubmit = function (e) {
    e.preventDefault();
    var t = T(), a = $('#origin').value, b = $('#destination').value, out = $('#tool-result');
    if (a === b) { out.innerHTML = '<p>' + esc(t.sameLoc) + '</p>'; return; }
    var id = (a === 'Westwood' || b === 'Westwood') ? '12' : '9';
    out.innerHTML = '<p><strong>' + esc(t.journey) + ': ' + esc(a) + ' → ' + esc(b) + '</strong><br>' + (state.lang === 'es' ? 'Ruta ' : 'Route ') + id + ' · ' + esc(t.conn) + ' <button class="text-link dark" type="button" id="trip-route">' + esc(t.exploreRoute) + ' ' + id + ' →</button></p>';
    var timing = document.createElement('p'); timing.textContent = state.lang === 'es' ? ($('#departure').value === 'morning' ? 'Mañana: salida de ejemplo a las 8:00 AM; llegada a las 8:35 AM.' : 'Ahora: salida de ejemplo en 6 minutos; duración de 35 minutos.') : ($('#departure').value === 'morning' ? 'Tomorrow: sample departure 8:00 AM; arrival 8:35 AM.' : 'Now: sample departure in 6 minutes; 35-minute journey.'); out.appendChild(timing);
    $('#trip-route').onclick = function () { routeDetail(id); };
  };

  $('#discounts').onclick = function () {
    var t = T();
    openModal('<h2>' + esc(t.discTitle) + '</h2><p>' + esc(t.discText1) + '</p><p>' + esc(t.discText2) + '</p><a href="https://www.camtranbus.com/fares/camtran-fares/">' + esc(t.discLink) + '</a>');
  };
  $$('[data-service]').forEach(function (b) {
    b.onclick = function () {
      var t = T(), s = SERVICES[b.dataset.service], l = state.lang;
      openModal('<h2>' + esc(s.t[l]) + '</h2><p>' + esc(s.d[l]) + '</p><ol>' + t.svcSteps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol><p>' + esc(t.svcNote) + '</p><a href="' + s.href + '">' + esc(t.svcLink) + '</a>');
    };
  });
  $('#calendar').onclick = function () {
    var t = T();
    openModal('<h2>' + esc(t.calTitle) + '</h2><p class="preview-notice">' + esc(t.calNote) + '</p>' + (state.events.length ? state.events.map(function (ev, i) {
      return '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(fmtDate(ev.date)) + ' · ' + esc(ev.title) + '</summary><p>' + esc(ev.time) + ' · ' + esc(ev.place) + '<br>' + esc(ev.summary) + '</p></details>';
    }).join('') : '<p>' + esc(t.noEvents) + '</p>'));
  };

  /* ---------- language ---------- */
  function applyLanguage() {
    var l = state.lang, t = T();
    document.documentElement.lang = l;
    var names = { '#route-search': ['Search routes','Buscar rutas'], '#swap': ['Swap origin and destination','Intercambiar origen y destino'], '#close-modal': ['Close dialog','Cerrar diálogo'], 'nav': ['Main navigation','Navegación principal'], '.filters': ['Filter routes','Filtrar rutas'], '.journey': ['Rider tools','Herramientas para pasajeros'], '.tool-tabs': ['Journey tools','Herramientas de viaje'], '.hero-art': ['Stylized transit network illustration, not a geographic route map','Ilustración de red de transporte, no es un mapa geográfico'] };
    Object.keys(names).forEach(function (s) { if ($(s)) $(s).setAttribute('aria-label', names[s][l === 'es' ? 1 : 0]); });
    $$('[data-i]').forEach(function (el) { var v = l === 'es' ? ES[el.dataset.i] : EN[el.dataset.i]; if (v != null) el.innerHTML = v; });
    $$('[data-i-ph]').forEach(function (el) { el.placeholder = l === 'es' ? ES[el.dataset.iPh] : 'Search route number or destination'; });
    var btn = $('#language'); btn.textContent = t.lang; btn.setAttribute('aria-label', t.langLabel); btn.lang = l === 'es' ? 'en' : 'es';
    document.dispatchEvent(new CustomEvent('camtran:lang', { detail: l }));
    try { localStorage.setItem('camtran-lang', l); } catch (e) { /* preference is optional */ }
  }
  $('#language').onclick = function () { state.lang = state.lang === 'en' ? 'es' : 'en'; applyLanguage(); loadContent(); };

  /* ---------- boot ---------- */
  try { if (localStorage.getItem('camtran-lang') === 'es') state.lang = 'es'; } catch (e) { /* default to English */ }
  applyLanguage();
  loadContent();
  CMS.onChange(loadContent); // updates live when an editor publishes in the CMS tab
})();
