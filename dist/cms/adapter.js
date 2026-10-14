/* CMS adapter: the single seam between the website and the content system.
   The site only calls window.CMS.*; swapping the provider connects the DYD CMS with no UI changes.

   Providers
   - mock : seed data (cms/content.js) + browser-local edits. Used for this proof of concept.
   - rest : maps the same calls onto the DYD CMS HTTP API (contract documented in README.md).

   Workflow modeled (RFP 26-05 §6): role-based permissions, approval workflow, version history,
   scheduling (start/end dates) and an audit log. */
(function () {
  'use strict';

  var COLLECTIONS = ['alerts', 'news', 'events', 'routes', 'fares'];
  var STORE_KEY = 'dyd-cms-v1';
  var STATUSES = ['draft', 'in_review', 'approved', 'published', 'archived'];

  // Allowed workflow moves, and which roles may perform each. Admins may do anything listed.
  var TRANSITIONS = {
    'draft>in_review':      ['editor', 'approver', 'admin'],
    'in_review>draft':      ['approver', 'admin'],
    'in_review>approved':   ['approver', 'admin'],
    'approved>published':   ['approver', 'admin'],
    'published>archived':   ['approver', 'admin'],
    'archived>draft':       ['editor', 'approver', 'admin']
  };
  var ROLES = { editor: 'Editor', approver: 'Approver', admin: 'Administrator' };

  var config = { provider: 'mock', baseUrl: '', headers: {} };
  var listeners = [];

  /* ---------- helpers ---------- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function now() { return new Date().toISOString(); }
  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function uid(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 8); }
  function emit(change) { listeners.forEach(function (fn) { try { fn(change); } catch (e) { /* listener errors never break the CMS */ } }); }

  /* ---------- mock provider ---------- */
  var memory = null; // fallback if localStorage is unavailable

  function emptyState() { return { items: {}, history: {}, audit: [], live: {} }; }

  function load() {
    if (memory) return memory;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { memory = memory || emptyState(); return memory; }
    return emptyState();
  }

  function persist(state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); memory = null; }
    catch (e) { memory = state; }
  }

  // Items = seed items overlaid with locally saved edits (by id). Removed seed items are tombstoned.
  function mockItems(collection) {
    var state = load();
    var seed = (window.DYD_SEED && window.DYD_SEED[collection]) || [];
    var local = state.items[collection] || {};
    var out = [];
    seed.forEach(function (s) { if (!(s.id in local)) out.push(clone(s)); });
    Object.keys(local).forEach(function (id) { if (local[id]) out.push(clone(local[id])); });
    return out;
  }

  var mock = {
    list: function (collection) { return Promise.resolve(mockItems(collection)); },
    save: function (collection, item, actor) {
      var state = load();
      var existing = mockItems(collection).filter(function (i) { return i.id === item.id; })[0];
      var next = clone(item);
      state.live = state.live || {};
      state.live[collection] = state.live[collection] || {};
      // Preserve the public revision while a working revision is being edited or restored.
      if (existing && existing.status === 'published' && next.status !== 'archived') {
        state.live[collection][next.id] = clone(existing);
      }
      if (next.status === 'published') state.live[collection][next.id] = clone(next);
      if (next.status === 'archived') delete state.live[collection][next.id];
      next.updated = now();
      next.updatedBy = actor.name;
      next.version = (existing && existing.version ? existing.version : 0) + 1;
      state.items[collection] = state.items[collection] || {};
      state.items[collection][next.id] = next;
      var key = collection + '/' + next.id;
      state.history[key] = state.history[key] || [];
      state.history[key].push({ version: next.version, at: next.updated, by: actor.name, role: actor.role, status: next.status, snapshot: clone(next) });
      state.audit.unshift({ at: next.updated, by: actor.name, role: actor.role, action: existing ? 'update' : 'create', target: key, status: next.status });
      persist(state);
      return Promise.resolve(clone(next));
    },
    history: function (collection, id) {
      var h = load().history[collection + '/' + id] || [];
      return Promise.resolve(clone(h).reverse());
    },
    audit: function () { return Promise.resolve(clone(load().audit).slice(0, 100)); },
    reset: function () {
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      memory = null;
      return Promise.resolve();
    }
  };

  /* ---------- rest provider (DYD CMS) ---------- */
  function http(method, path, body) {
    var headers = Object.assign({ 'Accept': 'application/json' }, config.headers);
    if (body) headers['Content-Type'] = 'application/json';
    return fetch(config.baseUrl.replace(/\/$/, '') + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, credentials: 'include' })
      .then(function (r) { if (!r.ok) throw new Error('CMS ' + method + ' ' + path + ' failed: ' + r.status); return r.json(); });
  }
  var rest = {
    list: function (c) { return http('GET', '/' + c); },
    save: function (c, item, actor) { return http(item.version ? 'PUT' : 'POST', '/' + c + (item.version ? '/' + encodeURIComponent(item.id) : ''), { item: item, actor: actor }); },
    history: function (c, id) { return http('GET', '/' + c + '/' + encodeURIComponent(id) + '/versions'); },
    audit: function () { return http('GET', '/audit'); },
    reset: function () { return Promise.reject(new Error('Reset is only available on the mock provider.')); }
  };

  function provider() { return config.provider === 'rest' ? rest : mock; }

  /* ---------- localization & visibility ---------- */
  function pick(value, lang) {
    if (value && typeof value === 'object' && ('en' in value || 'es' in value)) return value[lang] || value.en || '';
    return value;
  }
  function localize(item, lang) {
    var out = {};
    Object.keys(item).forEach(function (k) { out[k] = pick(item[k], lang); });
    return out;
  }
  function inWindow(item, on) {
    var d = on || today();
    return (!item.start || item.start <= d) && (!item.end || item.end >= d);
  }

  /* ---------- public API ---------- */
  window.CMS = {
    ROLES: ROLES,
    STATUSES: STATUSES,
    COLLECTIONS: COLLECTIONS,

    configure: function (opts) { Object.assign(config, opts || {}); },
    providerName: function () { return config.provider; },

    // Published (and, for alerts, currently scheduled) items in the visitor's language.
    published: function (collection, lang) {
      return provider().list(collection).then(function (items) {
        var live = config.provider === 'mock' ? ((load().live || {})[collection] || {}) : {};
        return items
          .map(function (i) { return i.status !== 'published' && i.status !== 'archived' && live[i.id] ? live[i.id] : i; })
          .filter(function (i) { return i.status === 'published' && inWindow(i); })
          .map(function (i) { return localize(i, lang || 'en'); });
      });
    },

    // Everything, raw bilingual objects, for the editor UI.
    all: function (collection) { return provider().list(collection); },

    save: function (collection, item, actor) {
      var next = clone(item);
      if (!next.id) next.id = uid(collection.slice(0, 5));
      next.status = 'draft';
      return provider().save(collection, next, actor).then(function (saved) { emit({ collection: collection, id: saved.id }); return saved; });
    },

    // Move an item through the approval workflow. Rejects if the actor's role may not make that move.
    transition: function (collection, item, to, actor) {
      var key = item.status + '>' + to;
      var allowed = TRANSITIONS[key];
      if (!allowed) return Promise.reject(new Error('Not a valid move: ' + item.status + ' → ' + to));
      if (allowed.indexOf(actor.role) === -1) return Promise.reject(new Error(ROLES[actor.role] + ' role cannot move an item from ' + item.status + ' to ' + to + '.'));
      var next = clone(item);
      next.status = to;
      if (to === 'approved' || to === 'published') {
        var incomplete = ['title', 'body', 'summary', 'place'].some(function (k) { return next[k] && typeof next[k] === 'object' && (!next[k].en || !next[k].en.trim() || !next[k].es || !next[k].es.trim()); });
        if (incomplete) return Promise.reject(new Error('Complete English and Spanish content before approval or publication.'));
      }
      return provider().save(collection, next, actor).then(function (saved) { emit({ collection: collection, id: saved.id }); return saved; });
    },

    allowedMoves: function (item, role) {
      return Object.keys(TRANSITIONS).filter(function (k) {
        return k.split('>')[0] === item.status && TRANSITIONS[k].indexOf(role) !== -1;
      }).map(function (k) { return k.split('>')[1]; });
    },

    history: function (collection, id) { return provider().history(collection, id); },
    audit: function () { return provider().audit(); },
    reset: function () { return provider().reset().then(function () { emit({ reset: true }); }); },

    // Notifies when content changes in this tab or (mock provider) in another tab, so the public site updates live.
    onChange: function (fn) { listeners.push(fn); },
    _pick: pick
  };

  window.addEventListener('storage', function (e) {
    if (e.key === STORE_KEY) emit({ external: true });
  });
})();
