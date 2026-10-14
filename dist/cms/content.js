/* Seed content for the mock CMS provider.
   Everything here is ILLUSTRATIVE sample data for the RFP 26-05 proof of concept.
   Each translatable field is { en, es }. In production this content is served by the DYD CMS. */
window.DYD_SEED = {
  alerts: [
    {
      id: 'alert-stop-move',
      severity: 'detour',
      title: { en: 'Downtown stop relocation', es: 'Parada reubicada en el centro' },
      body: {
        en: 'Sample: A downtown stop has temporarily moved. Production notices list affected routes, accessible boarding directions, and start and end dates.',
        es: 'Ejemplo: una parada del centro se mudó temporalmente. Los avisos reales indican rutas afectadas, indicaciones de abordaje accesible y fechas de inicio y fin.'
      },
      routes: ['18'],
      start: '2026-10-01',
      end: '2026-12-31',
      status: 'published'
    }
  ],
  news: [
    {
      id: 'news-listening',
      date: '2026-10-20',
      title: { en: 'Community listening session', es: 'Sesión comunitaria de escucha' },
      summary: {
        en: 'Sample announcement: share what would make your ride easier at the Transit Center.',
        es: 'Anuncio de ejemplo: cuéntanos qué haría tu viaje más fácil en el Centro de Tránsito.'
      },
      status: 'published'
    },
    {
      id: 'news-orientation',
      date: '2026-11-05',
      title: { en: 'New rider orientation', es: 'Orientación para nuevos pasajeros' },
      summary: {
        en: 'Sample announcement: learn how to read schedules, plan a trip and pay fares.',
        es: 'Anuncio de ejemplo: aprende a leer horarios, planificar un viaje y pagar tu pasaje.'
      },
      status: 'published'
    },
    {
      id: 'news-winter',
      date: '2026-11-15',
      title: { en: 'Winter weather service guide', es: 'Guía de servicio en clima invernal' },
      summary: {
        en: 'Sample announcement: how weather notices will appear on the website, by text and at the stop.',
        es: 'Anuncio de ejemplo: cómo aparecerán los avisos del clima en el sitio web, por mensaje y en la parada.'
      },
      status: 'published'
    }
  ],
  events: [
    {
      id: 'event-listening',
      date: '2026-10-20', time: '1:30 PM',
      place: { en: 'Transit Center', es: 'Centro de Tránsito' },
      title: { en: 'Community listening session', es: 'Sesión comunitaria de escucha' },
      summary: { en: 'Discussion of rider needs and connections.', es: 'Conversación sobre las necesidades y conexiones de los pasajeros.' },
      status: 'published'
    },
    {
      id: 'event-orientation',
      date: '2026-11-05', time: '10:00 AM',
      place: { en: 'Transit Center', es: 'Centro de Tránsito' },
      title: { en: 'New rider orientation', es: 'Orientación para nuevos pasajeros' },
      summary: { en: 'Learn how to read schedules and pay fares.', es: 'Aprende a leer horarios y pagar tu pasaje.' },
      status: 'published'
    },
    {
      id: 'event-board',
      date: '2026-11-12', time: '6:00 PM',
      place: { en: 'CamTran Boardroom', es: 'Sala de la junta de CamTran' },
      title: { en: 'Public board meeting', es: 'Reunión pública de la junta' },
      summary: { en: 'Open to the public. Agenda posted in advance.', es: 'Abierta al público. La agenda se publica con anticipación.' },
      status: 'published'
    }
  ],
  routes: [
    { id: '9', gtfsId: 'DEMO-9', area: 'urban', name: { en: 'Walmart – Galleria', es: 'Walmart – Galleria' }, places: { en: 'Shopping · Greater Johnstown', es: 'Compras · Gran Johnstown' }, stops: ['Johnstown Transit Center', 'Illustrative neighborhood stop', 'Walmart', 'Galleria'], status: 'published' },
    { id: '12', gtfsId: 'DEMO-12', area: 'urban', name: { en: 'Hystone – Westwood', es: 'Hystone – Westwood' }, places: { en: 'Neighborhood connections · Greater Johnstown', es: 'Conexiones de barrio · Gran Johnstown' }, stops: ['Johnstown Transit Center', 'Illustrative neighborhood stop', 'Hystone', 'Westwood'], status: 'published' },
    { id: '18', gtfsId: 'DEMO-18', area: 'urban', name: { en: 'Downtown Shuttle', es: 'Lanzadera del centro' }, places: { en: 'Downtown connections · Johnstown', es: 'Conexiones del centro · Johnstown' }, stops: ['Johnstown Transit Center', 'Illustrative downtown stop', 'Illustrative civic stop', 'Johnstown Transit Center'], status: 'published' },
    { id: '21', gtfsId: 'DEMO-21', area: 'urban', name: { en: 'Windber', es: 'Windber' }, places: { en: 'Community connections · Windber', es: 'Conexiones comunitarias · Windber' }, stops: ['Johnstown Transit Center', 'Illustrative connecting stop', 'Windber'], status: 'published' },
    { id: '+', gtfsId: null, area: 'rural', name: { en: 'Northern Cambria County', es: 'Norte del condado de Cambria' }, places: { en: 'CamTran+ · Explore rural service', es: 'CamTran+ · Servicio rural' }, stops: [], status: 'published' }
  ],
  fares: [
    { id: 'fare-single', label: { en: 'SINGLE RIDE', es: 'VIAJE SENCILLO' }, price: '$1.75', unit: { en: '/ ride', es: '/ viaje' }, desc: { en: 'A simple way to get where you’re going.', es: 'Una forma sencilla de llegar a donde vas.' }, link: { en: 'View fare details', es: 'Ver detalles de tarifas' }, href: 'https://www.camtranbus.com/fares/camtran-fares/', featured: false, status: 'published' },
    { id: 'fare-day', label: { en: 'DAY PASS', es: 'PASE DIARIO' }, price: '$4.50', unit: { en: '/ adult day pass', es: '/ pase diario adulto' }, desc: { en: 'Explore the day with a pass that fits.', es: 'Aprovecha el día con un pase a tu medida.' }, link: { en: 'Go to CamTran PAY', es: 'Ir a CamTran PAY' }, href: 'https://pay.camtranbus.com/', featured: true, status: 'published' },
    { id: 'fare-31', label: { en: '31-DAY PASS', es: 'PASE DE 31 DÍAS' }, price: '$60', unit: { en: '/ adult pass', es: '/ pase adulto' }, desc: { en: 'For all the places life takes you.', es: 'Para todos los lugares a los que te lleva la vida.' }, link: { en: 'Go to CamTran PAY', es: 'Ir a CamTran PAY' }, href: 'https://pay.camtranbus.com/', featured: false, status: 'published' }
  ]
};
