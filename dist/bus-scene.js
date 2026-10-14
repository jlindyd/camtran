(function () {
  'use strict';
  var scene = document.querySelector('.city-scene');
  if (!scene) return;
  var button = scene.querySelector('.motion-toggle');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var paused = reduced.matches;
  function render() {
    var es = document.documentElement.lang === 'es';
    scene.dataset.paused = String(paused);
    button.textContent = paused ? (es ? '▶ Reproducir animación' : '▶ Play animation') : (es ? 'Ⅱ Pausar animación' : 'Ⅱ Pause animation');
    button.setAttribute('aria-pressed', String(paused));
    scene.querySelector('svg').setAttribute('aria-label', es ? 'Ilustración de un autobús azul y blanco viajando por una ciudad con colinas verdes' : 'Illustrated blue and white bus traveling through a city with green hills');
    scene.querySelector('figcaption').textContent = es ? 'Escena urbana ilustrativa' : 'Illustrative city scene';
  }
  button.addEventListener('click', function () { paused = !paused; render(); });
  document.addEventListener('camtran:lang', render);
  reduced.addEventListener('change', function () { paused = reduced.matches; render(); });
  render();
})();
