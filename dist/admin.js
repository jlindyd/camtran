/* CMS editor demo. Uses only the public CMS adapter API, exactly as the DYD CMS integration would. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var ACTORS = {
    editor: { name: 'Sam Rivera', role: 'editor' },
    approver: { name: 'Alex Chen', role: 'approver' },
    admin: { name: 'Jordan Lee', role: 'admin' }
  };
  var HELP = {
    editor: 'Can create and edit drafts and submit them for review. Cannot publish.',
    approver: 'Can approve, send back, publish and archive.',
    admin: 'Full access, including all workflow moves.'
  };
  var MOVE_LABEL = { in_review: 'Submit for review', draft: 'Send back to draft', approved: 'Approve', published: 'Publish', archived: 'Archive' };

  // Field definitions per collection. type: i18n = { en, es }, i18nlong = textarea { en, es }.
  var SCHEMA = {
    alerts: { singular: 'alert', title: 'title', fields: [
      { k: 'severity', label: 'Type', type: 'select', options: [['info', 'Service notice'], ['detour', 'Planned detour'], ['weather', 'Weather'], ['emergency', 'Emergency (banner)']] },
      { k: 'title', label: 'Headline', type: 'i18n' },
      { k: 'body', label: 'Rider message', type: 'i18nlong' },
      { k: 'routes', label: 'Affected routes (comma separated)', type: 'list' },
      { k: 'start', label: 'Show from', type: 'date' },
      { k: 'end', label: 'Show until', type: 'date' }
    ] },
    news: { singular: 'announcement', title: 'title', fields: [
      { k: 'date', label: 'Date', type: 'date', required: true },
      { k: 'title', label: 'Headline', type: 'i18n' },
      { k: 'summary', label: 'Summary', type: 'i18nlong' }
    ] },
    events: { singular: 'event', title: 'title', fields: [
      { k: 'date', label: 'Date', type: 'date', required: true },
      { k: 'time', label: 'Time', type: 'text' },
      { k: 'title', label: 'Event name', type: 'i18n' },
      { k: 'place', label: 'Location', type: 'i18n' },
      { k: 'summary', label: 'Description', type: 'i18nlong' }
    ] }
  };

  var s = { collection: 'alerts', items: [], selected: null, actor: ACTORS.editor };
  var dirty = false;
  function leaveDraft() { return !dirty || confirm('Discard your unsaved changes?'); }
  $('#form').addEventListener('input', function () { dirty = true; });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  function say(msg, bad) { var el = $('#status'); el.textContent = msg; el.className = 'status' + (bad ? ' bad' : ''); }
  function label(item) { var t = item.title; return (t && (t.en || t)) || item.id; }

  /* ---------- list ---------- */
  function refresh(keepSelection) {
    return CMS.all(s.collection).then(function (items) {
      s.items = items.sort(function (a, b) { return (b.updated || '') < (a.updated || '') ? -1 : 1; });
      if (!keepSelection) s.selected = null;
      else if (s.selected) s.selected = s.items.filter(function (it) { return it.id === s.selected.id; })[0] || null;
      renderList(); renderForm(); renderHistory(); renderAudit();
    });
  }

  function renderList() {
    $('#items').innerHTML = s.items.length ? s.items.map(function (it) {
      var moves = CMS.allowedMoves(it, s.actor.role);
      return '<li class="item' + (s.selected && s.selected.id === it.id ? ' on' : '') + '">' +
        '<button type="button" class="item-main" data-open="' + esc(it.id) + '"><strong>' + esc(label(it)) + '</strong>' +
        '<span class="chip chip-' + esc(it.status) + '">' + esc(it.status.replace('_', ' ')) + '</span>' +
        '<small>v' + (it.version || 'seed') + (it.date ? ' · ' + esc(it.date) : '') + (it.severity ? ' · ' + esc(it.severity) : '') + '</small></button>' +
        '<span class="moves">' + moves.map(function (m) { return '<button type="button" class="mini" data-move="' + m + '" data-id="' + esc(it.id) + '">' + MOVE_LABEL[m] + '</button>'; }).join('') + '</span></li>';
    }).join('') : '<li class="muted">Nothing here yet. Choose “+ New”.</li>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (b) { b.onclick = function () { select(b.dataset.open); }; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-move]'), function (b) { b.onclick = function () { move(b.dataset.id, b.dataset.move); }; });
  }

  function select(id) { if (!leaveDraft()) return; s.selected = s.items.filter(function (i) { return i.id === id; })[0] || null; renderList(); renderForm(); renderHistory(); }

  /* ---------- form ---------- */
  function field(f, v) {
    var id = 'f-' + f.k, val = v == null ? '' : v;
    if (f.type === 'select') return '<label>' + esc(f.label) + '<select id="' + id + '" name="' + f.k + '">' + f.options.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
    if (f.type === 'i18n' || f.type === 'i18nlong') {
      var multi = f.type === 'i18nlong', en = (val && val.en) || '', es = (val && val.es) || '';
      var ctl = function (lang, text) { return multi ? '<textarea name="' + f.k + '.' + lang + '" rows="3">' + esc(text) + '</textarea>' : '<input name="' + f.k + '.' + lang + '" value="' + esc(text) + '">'; };
      return '<fieldset><legend>' + esc(f.label) + '</legend><label>English' + ctl('en', en) + '</label><label>Español' + ctl('es', es) + '</label></fieldset>';
    }
    if (f.type === 'list') return '<label>' + esc(f.label) + '<input name="' + f.k + '" value="' + esc((val || []).join(', ')) + '"></label>';
    if (f.type === 'date') return '<label>' + esc(f.label) + '<input type="date" name="' + f.k + '" value="' + esc(val) + '"></label>';
    return '<label>' + esc(f.label) + '<input name="' + f.k + '" value="' + esc(val) + '"></label>';
  }

  function renderForm() {
    var sc = SCHEMA[s.collection], it = s.selected || {};
    var editable = !s.selected || it.status === 'draft' || it.status === 'published' || s.actor.role === 'admin';
    dirty = false;
    $('#form-h').textContent = s.selected ? 'Edit ' + sc.singular + ' · ' + it.status.replace('_', ' ') : 'New ' + sc.singular;
    $('#form').innerHTML = sc.fields.map(function (f) { return field(f, it[f.k]); }).join('') +
      '<div class="form-actions"><button class="primary" type="submit"' + (editable ? '' : ' disabled') + '>Save draft</button><button type="button" class="text-link dark" id="preview-btn">Preview draft</button></div><p class="small">Saving creates a working draft. The last published revision stays visible until the replacement is approved and published.</p>' +
      (editable ? '' : '<p class="small">Only drafts can be edited. Send the item back to draft to change it.</p>');
    $('#preview').hidden = true;
    $('#preview-btn').onclick = showPreview;
  }

  function read() {
    var sc = SCHEMA[s.collection], f = $('#form'), base = s.selected ? JSON.parse(JSON.stringify(s.selected)) : {}, out = base;
    sc.fields.forEach(function (fd) {
      if (fd.type === 'i18n' || fd.type === 'i18nlong') out[fd.k] = { en: f.elements[fd.k + '.en'].value.trim(), es: f.elements[fd.k + '.es'].value.trim() };
      else if (fd.type === 'list') out[fd.k] = f.elements[fd.k].value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      else out[fd.k] = f.elements[fd.k].value.trim();
    });
    return out;
  }

  function validate(item) {
    var sc = SCHEMA[s.collection], t = item.title || {};
    if (!t.en) return 'Enter an English headline.';
    if (!t.es) return 'Enter a Spanish headline (language parity is required before publishing).';
    for (var i = 0; i < sc.fields.length; i++) { var fd = sc.fields[i]; if (fd.required && !item[fd.k]) return fd.label + ' is required.'; if ((fd.type === 'i18n' || fd.type === 'i18nlong') && (!item[fd.k].en || !item[fd.k].es)) return fd.label + ' needs both English and Spanish content.'; }
    if (item.start && item.end && item.end < item.start) return '“Show until” must not be before “Show from”.';
    return '';
  }

  $('#form').addEventListener('submit', function (e) {
    e.preventDefault();
    var item = read(), err = validate(item);
    if (err) { say(err, true); return; }
    if (!s.selected) item.status = 'draft';
    dirty = false;
    CMS.save(s.collection, item, s.actor).then(function (saved) {
      say('Saved “' + label(saved) + '” as version ' + saved.version + '.');
      return refresh(true).then(function () { select(saved.id); });
    }).catch(function (x) { say(x.message, true); });
  });

  function showPreview() {
    var item = read(), p = $('#preview'), lang = ['en', 'es'];
    p.hidden = false;
    var t = SCHEMA[s.collection].title;
    p.innerHTML = lang.map(function (l) {
      var title = (item[t] && item[t][l]) || '', body = (item.body || item.summary || {})[l] || '';
      return '<div class="pv ' + (item.severity === 'emergency' ? 'pv-emergency' : '') + '"><p class="eyebrow">' + l.toUpperCase() + (item.severity ? ' · ' + esc(item.severity.toUpperCase()) : '') + '</p><strong>' + esc(title) + '</strong><p>' + esc(body) + '</p></div>';
    }).join('');
  }

  /* ---------- workflow ---------- */
  function move(id, to) {
    if (!leaveDraft()) return;
    dirty = false;
    var it = s.items.filter(function (i) { return i.id === id; })[0];
    CMS.transition(s.collection, it, to, s.actor)
      .then(function (saved) { say('“' + label(saved) + '” is now ' + saved.status.replace('_', ' ') + '.'); return refresh(true).then(function () { select(saved.id); }); })
      .catch(function (x) { say(x.message, true); });
  }

  /* ---------- history & audit ---------- */
  function renderHistory() {
    var ol = $('#history');
    if (!s.selected) { ol.innerHTML = '<li class="muted">Select an item to see its versions.</li>'; return; }
    CMS.history(s.collection, s.selected.id).then(function (h) {
      ol.innerHTML = h.length ? h.map(function (v) {
        return '<li><strong>v' + v.version + '</strong> · ' + esc(v.status.replace('_', ' ')) + ' · ' + esc(v.by) + '<br><small>' + esc(new Date(v.at).toLocaleString()) + '</small> <button type="button" class="mini" data-restore="' + v.version + '">Restore as draft</button><details><summary>Compare with working revision</summary><pre class="revision-diff">' + esc(JSON.stringify(v.snapshot, null, 2)) + '</pre><p>Current working revision</p><pre class="revision-diff">' + esc(JSON.stringify(s.selected, null, 2)) + '</pre></details></li>';
      }).join('') : '<li class="muted">No saved versions yet. Seed content has no edits.</li>';
      Array.prototype.forEach.call(ol.querySelectorAll('[data-restore]'), function (b) {
        b.onclick = function () {
          if (!leaveDraft()) return;
          dirty = false;
          var v = h.filter(function (x) { return String(x.version) === b.dataset.restore; })[0], snap = v.snapshot;
          snap.status = 'draft';
          CMS.save(s.collection, snap, s.actor).then(function (saved) { say('Restored v' + v.version + ' as new draft v' + saved.version + '.'); return refresh(true).then(function () { select(saved.id); }); });
        };
      });
    });
  }
  function renderAudit() {
    CMS.audit().then(function (a) {
      $('#audit').innerHTML = a.length ? a.slice(0, 15).map(function (r) { return '<li>' + esc(new Date(r.at).toLocaleTimeString()) + ' · <strong>' + esc(r.by) + '</strong> (' + esc(r.role) + ') ' + esc(r.action) + ' ' + esc(r.target) + ' → ' + esc(r.status.replace('_', ' ')) + '</li>'; }).join('') : '<li class="muted">No activity yet.</li>';
    });
  }

  /* ---------- chrome ---------- */
  $('#role').onchange = function () { if (!leaveDraft()) { this.value = s.actor.role; return; } s.actor = ACTORS[this.value]; $('#role-help').textContent = HELP[this.value]; renderList(); renderForm(); };
  $('#role-help').textContent = HELP.editor;
  $('#new').onclick = function () { if (!leaveDraft()) return; s.selected = null; renderList(); renderForm(); var f = $('#form').querySelector('input,select,textarea'); if (f) f.focus(); };
  $('#reset').onclick = function () { if (confirm('Discard all edits made in this browser and restore the original sample content?')) CMS.reset().then(function () { say('Demo data reset.'); refresh(); }); };

  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-collection]'));
  function pickTab(b) {
    if (!leaveDraft()) return;
    dirty = false;
    tabs.forEach(function (x) { x.setAttribute('aria-selected', x === b); x.tabIndex = x === b ? 0 : -1; });
    s.collection = b.dataset.collection; refresh();
  }
  tabs.forEach(function (b, i) {
    b.onclick = function () { pickTab(b); };
    b.onkeydown = function (e) {
      var n = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : null;
      if (n) { e.preventDefault(); pickTab(n); n.focus(); }
    };
  });

  CMS.onChange(function () { if (!dirty) refresh(true); else say('Content changed in another tab. Save or discard your draft before refreshing.'); });
  refresh();
})();
