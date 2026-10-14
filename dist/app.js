/* CamTran public site (RFP 26-05 proof of concept).
   All dynamic content (alerts, routes, fares, news, events) is read through window.CMS. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var state = { lang: 'en', filter: 'all', routes: [], alerts: [], news: [], events: [], fares: [] };
  var returnFocus;

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
    routesNote: 'Ejemplos de rutas del sitio actual. Los horarios y mapas de demostración son ilustrativos.',
    trackerEye: 'MENOS ADIVINAR. MÁS VIAJAR.', trackerTitle: 'Tu próximo autobús,<br>de un vistazo.', trackerText: 'Selecciona una ruta para explorar la vista de llegadas de ejemplo.',
    route: 'Ruta', liveLink: 'Abrir el rastreador en vivo de CamTran ↗', arrPrev: 'VISTA DE LLEGADAS', demoData: 'DATOS DE EJEMPLO',
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
      details: 'View details →', more: function (n) { return '+' + n + ' more'; }, allAlerts: 'Service alerts',
      before: 'Before you travel', beforeText: 'Check the official website or live tracker for current operating information.', official: 'Visit the official CamTran website ↗',
      affects: 'Affects routes', until: 'Through', noAlerts: 'No active alerts.',
      sampleNotice: 'This is a sample notice, not an active service alert.',
      sameLoc: 'Please choose different starting and ending locations.',
      journey: 'Sample journey', conn: 'Illustrative connection only. Not a calculated itinerary.', exploreRoute: 'Explore route',
      noRoutes: 'No matching routes. Try “Galleria”, “18”, or clear your search.', shown: function (n) { return n + ' route examples shown · Prototype route directory'; },
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
      details: 'Ver detalles →', more: function (n) { return '+' + n + ' más'; }, allAlerts: 'Alertas de servicio',
      before: 'Antes de viajar', beforeText: 'Consulta el sitio oficial o el rastreador en vivo para obtener información operativa actual.', official: 'Visitar el sitio oficial de CamTran ↗',
      affects: 'Rutas afectadas', until: 'Hasta', noAlerts: 'No hay alertas activas.',
      sampleNotice: 'Este es un aviso de ejemplo, no una alerta de servicio activa.',
      sameLoc: 'Elige un origen y un destino diferentes.',
      journey: 'Viaje de ejemplo', conn: 'Solo una conexión ilustrativa. No es un itinerario calculado.', exploreRoute: 'Explorar ruta',
      noRoutes: 'No hay rutas que coincidan. Prueba “Galleria”, “18” o borra la búsqueda.', shown: function (n) { return n + ' rutas de ejemplo · Directorio de rutas del prototipo'; },
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
  Object.assign(ES, { footerTag: 'Conectamos el condado de Cambria.<br>Un viaje a la vez.', publicInfo: 'Información pública ↗', footerAda: 'Accesibilidad y ADA ↗', footerGuide: 'Prototipo y guía de evaluación ↗', independent: 'Prototipo independiente · No es el sitio oficial de CamTran.', boundary: 'Datos ilustrativos. No se reciben pagos ni solicitudes.', editorLink: 'Probar el editor CMS ↗', guideLink: 'Guía de demostración ↗' });
  $$('[data-i]').forEach(function (el) { EN[el.dataset.i] = el.innerHTML; });
  var T = function () { return UI[state.lang]; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmtDate = function (iso, opts) { return new Date(iso + 'T12:00:00').toLocaleDateString(state.lang === 'es' ? 'es-US' : 'en-US', opts || { month: 'long', day: 'numeric' }); };

  /* ---------- dialog ---------- */
  var modal = $('#modal');
  function openModal(html) {
    returnFocus = document.activeElement;
    $('#modal-body').innerHTML = html;
    var h = $('#modal-body h2'); if (h) h.id = 'modal-title';
    modal.showModal();
    $('#close-modal').focus();
  }
  $('#close-modal').onclick = function () { modal.close(); };
  modal.addEventListener('close', function () { if (returnFocus) returnFocus.focus(); });
  modal.addEventListener('click', function (e) {
    if (e.target !== modal) return;
    var r = modal.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) modal.close();
  });

  /* ---------- CMS-backed rendering ---------- */
  function loadContent() {
    var l = state.lang;
    return Promise.all([CMS.published('alerts', l), CMS.published('routes', l), CMS.published('fares', l), CMS.published('news', l), CMS.published('events', l)])
      .then(function (r) {
        var rank = { emergency: 0, weather: 1, detour: 2, info: 3 };
        state.alerts = r[0].sort(function (a, b) { return (rank[a.severity] - rank[b.severity]) || 0; });
        state.routes = r[1]; state.fares = r[2];
        state.news = r[3].sort(function (a, b) { return a.date < b.date ? -1 : 1; });
        state.events = r[4].sort(function (a, b) { return a.date < b.date ? -1 : 1; });
        renderAll();
      })
      .catch(function (err) {
        $('#alert-region').innerHTML = '';
        $('#route-count').textContent = 'Content could not be loaded: ' + err.message;
      });
  }
  // Date windows are evaluated in Pennsylvania time; refresh an already-open page too.
  setInterval(function () { if (!document.hidden) loadContent(); }, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loadContent(); });

  function renderAll() { renderAlerts(); renderRoutes(); renderTrackerOptions(); renderArrivals(); renderFares(); renderNews(); }

  function renderAlerts() {
    var region = $('#alert-region');
    if (!state.alerts.length) { region.innerHTML = ''; return; }
    var a = state.alerts[0], t = T(), emergency = a.severity === 'emergency';
    region.innerHTML =
      '<div class="alert alert-' + esc(a.severity) + (emergency ? ' alert-emergency' : '') + '" role="' + (emergency ? 'alert' : 'status') + '">' +
      '<div><span class="alert-symbol" aria-hidden="true">!</span><strong>' + esc(t.alertLabel[a.severity] || t.alertLabel.info) + '</strong>' +
      '<span id="alert-text">' + esc(a.title) + (a.body ? ' — ' + esc(a.body) : '') + '</span></div>' +
      '<button id="alert-details" type="button">' + (state.alerts.length > 1 ? esc(t.more(state.alerts.length - 1)) + ' · ' : '') + esc(t.details) + '</button></div>';
    $('#alert-details').onclick = showAlerts;
  }

  function showAlerts() {
    var t = T();
    openModal('<h2>' + esc(t.allAlerts) + '</h2><p class="preview-notice">' + esc(t.sampleNotice) + '</p>' +
      state.alerts.map(function (a) {
        return '<article class="alert-item"><p class="eyebrow">' + esc(t.alertLabel[a.severity]) + '</p><h3>' + esc(a.title) + '</h3><p>' + esc(a.body) + '</p>' +
          ((a.routes && a.routes.length) ? '<p><strong>' + esc(t.affects) + ':</strong> ' + a.routes.map(esc).join(', ') + '</p>' : '') +
          (a.end ? '<p><strong>' + esc(t.until) + ':</strong> ' + esc(fmtDate(a.end, { month: 'long', day: 'numeric', year: 'numeric' })) + '</p>' : '') + '</article>';
      }).join('') +
      '<h3>' + esc(t.before) + '</h3><p>' + esc(t.beforeText) + '</p><a href="https://www.camtranbus.com/">' + esc(t.official) + '</a>');
  }

  function renderRoutes() {
    var t = T(), q = $('#route-search').value.trim().toLowerCase();
    var shown = state.routes.filter(function (r) { return (state.filter === 'all' || r.area === state.filter) && (r.id + ' ' + r.name + ' ' + r.places).toLowerCase().indexOf(q) !== -1; });
    $('#route-list').innerHTML = shown.length ? shown.map(function (r) {
      return '<button class="route-row" type="button" data-route="' + esc(r.id) + '"><span class="route-number">' + esc(r.id) + '</span><div><h3>' + esc(r.name) + '</h3><p>' + esc(r.places) + '</p></div><span class="route-type">' + (r.area === 'urban' ? t.urban : t.rural) + '</span><b aria-hidden="true">↗</b></button>';
    }).join('') : '<p class="no-results">' + esc(t.noRoutes) + '</p>';
    $('#route-count').textContent = t.shown(shown.length);
    $$('[data-route]').forEach(function (b) { b.onclick = function () { routeDetail(b.dataset.route); }; });
  }

  function routeDetail(id) {
    var t = T(), r = state.routes.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    if (r.area === 'rural') {
      openModal('<h2>' + esc(t.ruralTitle) + '</h2><p>' + esc(t.ruralText) + '</p><a href="https://www.camtranbus.com/schedules/camtran-plus-rural-routes/">' + esc(t.ruralLink) + '</a>');
      return;
    }
    var translatedStop = function (s) { return state.lang === 'es' ? s.replace('Illustrative neighborhood stop', 'Parada de barrio ilustrativa').replace('Illustrative downtown stop', 'Parada del centro ilustrativa').replace('Illustrative civic stop', 'Parada cívica ilustrativa').replace('Illustrative connecting stop', 'Parada de conexión ilustrativa') : s; };
    var stops = function (rev) { return (rev ? r.stops.slice().reverse() : r.stops).map(function (s) { return '<li>' + esc(translatedStop(s)) + '</li>'; }).join(''); };
    openModal('<p class="eyebrow">' + esc(t.urban) + ' / ' + esc(r.id) + '</p><h2>' + esc(r.name) + '</h2><p class="preview-notice">' + esc(t.demoOnly) + '</p>' +
      '<div class="filters" role="group" aria-label="Direction"><button type="button" class="selected" aria-pressed="true" id="outbound">' + esc(t.outbound) + '</button><button type="button" aria-pressed="false" id="inbound">' + esc(t.inbound) + '</button></div>' +
      '<ol class="stop-list" id="stop-sequence" aria-live="polite">' + stops(false) + '</ol><h3 id="sample-timetable-title">' + esc(t.sampleTT) + '</h3>' +
      '<table><caption>' + esc(t.ttCaption) + '</caption><thead><tr><th scope="col">' + esc(t.trip) + '</th><th scope="col">' + esc(t.firstStop) + '</th><th scope="col">' + esc(t.lastStop) + '</th></tr></thead><tbody><tr><td>1</td><td>9:00 AM</td><td>9:35 AM</td></tr><tr><td>2</td><td>10:00 AM</td><td>10:35 AM</td></tr></tbody></table>' +
      '<a href="https://www.camtranbus.com/schedules/camtran-urban-routes/">' + esc(t.officialSched) + '</a>');
    ['outbound', 'inbound'].forEach(function (dir) {
      $('#' + dir).onclick = function () {
        $('#stop-sequence').innerHTML = stops(dir === 'inbound');
        ['outbound', 'inbound'].forEach(function (d) { var b = $('#' + d); b.classList.toggle('selected', d === dir); b.setAttribute('aria-pressed', d === dir); });
      };
    });
    var es = state.lang === 'es';
    var extra = document.createElement('section'); extra.className = 'route-experience';
    extra.innerHTML = '<h3>' + (es ? 'Tu conexión, paso a paso' : 'Your connection, stop by stop') + '</h3><div class="route-schematic" role="img" aria-label="' + (es ? 'Diagrama ilustrativo de paradas, no es un mapa geográfico' : 'Illustrative stop diagram, not a geographic map') + '">' + r.stops.map(function (stop) { return '<span><b aria-hidden="true">●</b>' + esc(translatedStop(stop)) + '</span>'; }).join('') + '</div><p class="small">' + (es ? 'Diagrama de ejemplo. La ubicación y accesibilidad de cada parada deben verificarse con CamTran.' : 'Sample schematic. Stop locations and boarding accessibility must be verified with CamTran.') + '</p><label class="route-day">' + (es ? 'Día del servicio de ejemplo' : 'Sample service day') + '<select id="route-day"><option value="weekday">' + (es ? 'Entre semana' : 'Weekday') + '</option><option value="saturday">' + (es ? 'Sábado' : 'Saturday') + '</option></select></label><p id="day-note" aria-live="polite"></p><h3>' + (es ? 'Avisos para esta ruta' : 'Notices for this route') + '</h3>' + (state.alerts.filter(function (a) { return !a.routes || !a.routes.length || a.routes.indexOf(id) !== -1; }).map(function (a) { return '<p class="preview-notice"><strong>' + esc(a.title) + '</strong><br>' + esc(a.body) + '</p>'; }).join('') || '<p>' + (es ? 'No hay avisos de ejemplo para esta ruta.' : 'No sample notices for this route.') + '</p>') + '<h3>' + (es ? 'Ayuda para abordar' : 'Boarding assistance') + '</h3><p>' + (es ? 'Consulta a CamTran para confirmar el acceso a la parada, el uso de rampas y las adaptaciones que necesitas.' : 'Contact CamTran to confirm stop access, ramp boarding, and any accommodations you need.') + '</p><a href="https://www.camtranbus.com/disability-services/">' + (es ? 'Información oficial de accesibilidad ↗' : 'Official accessibility information ↗') + '</a><p><button class="primary" id="download-sample">' + (es ? 'Descargar horario de ejemplo (CSV)' : 'Download sample timetable (CSV)') + '</button></p>';
    $('#modal-body').appendChild(extra);
    function updateDay() { var sat = $('#route-day').value === 'saturday'; $('#sample-timetable-title').textContent = es ? (sat ? 'Horario de ejemplo del sábado' : 'Horario de ejemplo entre semana') : (sat ? 'Sample Saturday timetable' : 'Sample weekday timetable'); $('#sample-timetable-title').textContent = es ? (sat ? 'Horario de ejemplo del sábado' : 'Horario de ejemplo entre semana') : (sat ? 'Sample Saturday timetable' : 'Sample weekday timetable'); var times = sat ? ['10:00 AM','10:35 AM','11:00 AM','11:35 AM'] : ['9:00 AM','9:35 AM','10:00 AM','10:35 AM']; var cells = $$('#modal-body tbody td'); [1,2,4,5].forEach(function (n, i) { cells[n].textContent = times[i]; }); $('#day-note').textContent = es ? 'Solo horarios ilustrativos; no confirman servicio real en este día.' : 'Illustrative times only; these do not confirm actual service on this day.'; }
    $('#route-day').onchange = updateDay; updateDay();
    $('#download-sample').onclick = function () { var rows = $$('#modal-body table tr').map(function (row) { return Array.prototype.map.call(row.cells, function (c) { return '"' + c.textContent.replace(/"/g, '""') + '"'; }).join(','); }); var blob = new Blob(['DEMO ONLY - NOT FOR TRAVEL\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' }); var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'camtran-route-' + id + '-DEMO.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); };
  }

  function renderTrackerOptions() {
    var sel = $('#tracker-route'), keep = sel.value;
    sel.innerHTML = state.routes.filter(function (r) { return r.area === 'urban'; }).slice(0, 3).map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.id) + ' · ' + esc(r.name) + '</option>'; }).join('');
    if (keep && Array.prototype.some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
  }
  function renderArrivals() {
    var t = T(), id = $('#tracker-route').value, r = state.routes.filter(function (x) { return x.id === id; })[0];
    if (!r) { $('#arrivals').innerHTML = ''; return; }
    $('#arrivals').innerHTML = [6, 26].map(function (m, i) {
      return '<div class="arrival"><span class="route-number">' + esc(id) + '</span><div><strong>' + esc(r.name) + '</strong><small>' + esc(t.sampleDep) + ' ' + (i + 1) + '</small></div><div class="arrival-time">' + m + '<small>' + esc(t.demoMin) + '</small></div></div>';
    }).join('');
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
  $('#tracker-route').onchange = renderArrivals;

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
    b.onclick = function () { selectTab(b); };
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
    try { localStorage.setItem('camtran-lang', l); } catch (e) { /* preference is optional */ }
  }
  $('#language').onclick = function () { state.lang = state.lang === 'en' ? 'es' : 'en'; applyLanguage(); loadContent(); };

  /* ---------- boot ---------- */
  try { if (localStorage.getItem('camtran-lang') === 'es') state.lang = 'es'; } catch (e) { /* default to English */ }
  applyLanguage();
  loadContent();
  CMS.onChange(loadContent); // updates live when an editor publishes in the CMS tab
})();
