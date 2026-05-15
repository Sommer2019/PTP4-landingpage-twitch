// Twitch-Extension Config-View: Reward-Verwaltung (CRUD) für den Broadcaster.
// Wird im Twitch-Dashboard unter "Konfigurieren" angezeigt.

// ── Build-time Konfiguration ─────────────────────────────────────────────
// Diese Sentinels werden in der CI-Pipeline (.github/workflows/pipeline.yml,
// Job release-twitchaddon, Step "Inject extension config") aus GitHub-Secrets
// durch die echten Werte ersetzt, bevor extension.zip gepackt wird.
var EBS_BASE_URL = '__EBS_BASE_URL__';
var PRIVACY_URL  = '__PRIVACY_URL__';

var broadcasterJwt = null;
var allRewards = [];
var editingId = null;   // null = neuer Reward, sonst ID des bearbeiteten Rewards

// ── Hilfsfunktionen ──────────────────────────────────────────────────────

// Wrapper für alle EBS-Calls. Setzt den ngrok-skip-browser-warning-Header,
// sonst zeigt ngrok-free die Interstitial-HTML-Seite statt unsere JSON-Antwort
// (Folge: Browser sieht keinen ACAO-Header → CORS-Fehler).
function ebsFetch(path, opts) {
  opts = opts || {};
  opts.headers = Object.assign({ 'ngrok-skip-browser-warning': '1' }, opts.headers || {});
  return window.fetch(EBS_BASE_URL.concat(path), opts);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Dekodiert den Payload-Teil eines JWT (ohne Signaturprüfung); null bei ungültigem Token. */
function decodeJwtPayload(token) {
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return null;
    var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch(e) { return null; }
}

function showToast(msg, type) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (type || '');
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.className = 'toast'; }, 3200);
}

function fmt(n) { return Number(n).toLocaleString('de-DE'); }

function setPrivacyLink(url) {
  var link = document.getElementById('privacyLink');
  if (!link) return;
  if (!url) {
    link.removeAttribute('href');
    link.style.pointerEvents = 'none';
    link.style.opacity = '0.7';
    return;
  }
  try {
    var parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('invalid protocol');
    link.href = parsed.toString();
  } catch(e) {
    link.removeAttribute('href');
    link.style.pointerEvents = 'none';
    link.style.opacity = '0.7';
    return;
  }
  link.style.pointerEvents = '';
  link.style.opacity = '';
}

// ── Typ-Mapping: intern (DB) ↔ Formular ─────────────────────────────────

/** Leitet aus den DB-Feldern eines Rewards den Formular-Typ ab (tts/video/image_text/text_only). */
function rewardToFormType(r) {
  if (r.istts) return 'tts';
  var url = (r.mediaurl || '').toLowerCase();
  if (/youtube\.com|youtu\.be/.test(url)) {
    return r.showmedia === false ? 'video_hidden' : 'video';
  }
  if (r.mediaurl || r.imageurl) return 'image_text';
  return 'text_only';
}

function typeBadge(type) {
  if (type === 'video' || type === 'video_hidden') return '<span class="badge badge-video">Video</span>';
  if (type === 'tts') return '<span class="badge badge-tts">TTS</span>';
  if (type === 'image_text') return '<span class="badge badge-image">Bild</span>';
  return '<span class="badge badge-image">Text</span>';
}

// ── API-Aufrufe ──────────────────────────────────────────────────────────

/** Ruft den /api/rewards-Endpunkt auf; sendet das Broadcaster-JWT für Schreibzugriffe mit. */
function apiRewards(method, params, body) {
  var path = '/api/rewards' + (params ? '?' + params : '');
  var opts = {
    method: method,
    headers: { 'Content-Type': 'application/json', 'x-extension-jwt': broadcasterJwt }
  };
  if (body) opts.body = JSON.stringify(body);
  return ebsFetch(path, opts).then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) throw new Error(data.error || res.status);
      return data;
    });
  });
}

function loadRewards() {
  ebsFetch('/api/rewards')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      allRewards = data.sort(function(a, b) { return a.cost - b.cost; });
      renderList();
    })
    .catch(function() {
      document.getElementById('rewardList').innerHTML = '<div class="state-msg">❌ Rewards konnten nicht geladen werden.</div>';
    });
}

// ── Reward-Liste rendern ─────────────────────────────────────────────────

function renderList() {
  var el = document.getElementById('rewardList');
  if (!allRewards.length) {
    el.innerHTML = '<div class="state-msg">Noch keine Rewards. Klicke auf "+ Neu".</div>';
    return;
  }
  el.innerHTML = '<div class="reward-list">' + allRewards.map(function(r) {
    var formType = rewardToFormType(r);
    var disabled = r.is_enabled === false ? ' disabled' : '';
    return '<div class="reward-card' + disabled + '">' +
      '<div class="reward-card-info">' +
        '<div class="reward-card-name">' + esc(r.name || 'Reward') + '</div>' +
        '<div class="reward-card-meta">' + typeBadge(formType) +
          (r.is_enabled === false ? ' <span style="color:var(--red);font-size:0.68rem;">● deaktiviert</span>' : '') +
          (r.onceperstream ? ' · <span style="font-size:0.68rem;">1×/Stream</span>' : '') +
          (r.cooldown > 0 ? ' · <span style="font-size:0.68rem;">CD ' + r.cooldown + 's</span>' : '') +
        '</div>' +
      '</div>' +
      '<span class="reward-card-cost">' + fmt(r.cost) + ' P</span>' +
      '<div class="reward-card-actions">' +
        '<button class="btn btn-ghost btn-sm" data-edit="' + esc(String(r.id)) + '">✏️</button>' +
      '</div>' +
    '</div>';
  }).join('') + '</div>';

  el.querySelectorAll('[data-edit]').forEach(function(btn) {
    btn.addEventListener('click', function() { openEdit(btn.getAttribute('data-edit')); });
  });
}

// ── Modal öffnen ─────────────────────────────────────────────────────────

function openNew() {
  editingId = null;
  resetForm();
  document.getElementById('modalTitle').textContent = '✨ Neuer Reward';
  document.getElementById('deleteBtn').style.display = 'none';
  openModal();
}

function openEdit(id) {
  var r = allRewards.find(function(x) { return String(x.id) === String(id); });
  if (!r) return;
  editingId = id;
  resetForm();
  document.getElementById('modalTitle').textContent = '✏️ Reward bearbeiten';
  document.getElementById('deleteBtn').style.display = '';

  // Felder befüllen
  document.getElementById('fName').value     = r.name || '';
  document.getElementById('fCost').value     = r.cost || '';
  document.getElementById('fDuration').value = r.duration || '';
  document.getElementById('fDesc').value     = r.description || '';
  document.getElementById('fCooldown').value = r.cooldown || 0;
  document.getElementById('fEnabled').checked       = r.is_enabled !== false;
  document.getElementById('fOncePerStream').checked = !!r.onceperstream;

  var formType = rewardToFormType(r);
  document.getElementById('fType').value = formType;

  if (formType === 'video') {
    document.getElementById('fMediaUrl').value = r.mediaurl || '';
    document.getElementById('fText').value     = r.text || '';
  } else if (formType === 'video_hidden') {
    document.getElementById('fMediaUrl').value    = r.mediaurl || '';
    document.getElementById('fImageUrl').value    = r.imageurl || '';
    document.getElementById('fTextHidden').value  = r.text || '';
  } else if (formType === 'tts') {
    document.getElementById('fTtsFixed').value = r.text || '';
  } else if (formType === 'image_text') {
    document.getElementById('fImgUrl').value  = r.mediaurl || r.imageurl || '';
    // text-Feld nur aus r.text, nicht aus r.description — Description ist
    // ein eigenständiges Feld (z.B. für Streamdeck-Trigger-Marker), das
    // nicht ins Anzeige-Text-Feld gemirrored werden darf.
    document.getElementById('fImgText').value = r.text || '';
  } else {
    // Siehe oben: kein Description-Mirror.
    document.getElementById('fOnlyText').value = r.text || '';
  }

  onTypeChange();
  openModal();
}

function resetForm() {
  ['fName','fCost','fDuration','fDesc','fCooldown',
   'fMediaUrl','fText','fImageUrl','fTextHidden','fTtsFixed',
   'fImgUrl','fImgText','fOnlyText'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('fType').value = 'video';
  document.getElementById('fEnabled').checked = true;
  document.getElementById('fOncePerStream').checked = false;
  document.getElementById('fCooldown').value = 0;
  document.getElementById('formError').textContent = '';
  onTypeChange();
}

function openModal() {
  document.getElementById('modalBackdrop').classList.add('open');
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
}

// ── Typ-Sektionen ein-/ausblenden ────────────────────────────────────────

function onTypeChange() {
  var type = document.getElementById('fType').value;
  document.getElementById('secVideo').style.display       = type === 'video'        ? '' : 'none';
  document.getElementById('secVideoHidden').style.display = type === 'video_hidden' ? '' : 'none';
  document.getElementById('secTts').style.display         = type === 'tts'          ? '' : 'none';
  document.getElementById('secImage').style.display       = type === 'image_text'   ? '' : 'none';
  document.getElementById('secTextOnly').style.display    = type === 'text_only'    ? '' : 'none';
}

// ── Formular → DB-Objekt ─────────────────────────────────────────────────

/** Liest das Formular aus und baut das DB-Payload; liefert { error } bei Validierungsfehlern. */
function buildPayload() {
  var type = document.getElementById('fType').value;
  var name = document.getElementById('fName').value.trim();
  var cost = parseInt(document.getElementById('fCost').value, 10);
  var duration = parseInt(document.getElementById('fDuration').value, 10) || 10;
  var desc = document.getElementById('fDesc').value.trim();
  var cooldown = parseInt(document.getElementById('fCooldown').value, 10) || 0;
  var enabled = document.getElementById('fEnabled').checked;
  var oncePerStream = document.getElementById('fOncePerStream').checked;

  if (!name)         return { error: 'Name darf nicht leer sein.' };
  if (!cost || cost < 1) return { error: 'Kosten müssen mindestens 1 sein.' };

  var payload = {
    name: name,
    cost: cost,
    duration: duration,
    description: desc || null,
    cooldown: cooldown || null,
    is_enabled: enabled,
    onceperstream: oncePerStream || null,
    istts: false,
    mediaurl: null,
    imageurl: null,
    text: null,
    showmedia: null
  };

  if (type === 'video') {
    var url = document.getElementById('fMediaUrl').value.trim();
    if (!url) return { error: 'YouTube-URL darf nicht leer sein.' };
    payload.mediaurl  = url;
    payload.text      = document.getElementById('fText').value.trim() || null;
    payload.showmedia = true;
  } else if (type === 'video_hidden') {
    var url2 = document.getElementById('fMediaUrl').value.trim();
    if (!url2) return { error: 'YouTube-URL darf nicht leer sein.' };
    payload.mediaurl  = url2;
    payload.imageurl  = document.getElementById('fImageUrl').value.trim() || null;
    payload.text      = document.getElementById('fTextHidden').value.trim() || null;
    payload.showmedia = false;
  } else if (type === 'tts') {
    payload.istts = true;
    payload.text  = document.getElementById('fTtsFixed').value.trim() || null;
  } else if (type === 'image_text') {
    var imgUrl = document.getElementById('fImgUrl').value.trim();
    if (!imgUrl) return { error: 'Bild-URL darf nicht leer sein.' };
    payload.mediaurl = imgUrl;
    payload.text     = document.getElementById('fImgText').value.trim() || null;
  } else {
    // text_only — Text darf leer sein, dann ist der Reward "trigger-only"
    // (z.B. für Streamdeck via description="STD_ID_<n>"); das Overlay
    // rendert dann nichts, die Description steuert die Bridge.
    var txt = document.getElementById('fOnlyText').value.trim();
    payload.text = txt || null;
  }

  return { payload: payload };
}

// ── Speichern ────────────────────────────────────────────────────────────

function handleSave() {
  var result = buildPayload();
  if (result.error) {
    document.getElementById('formError').textContent = '⚠️ ' + result.error;
    return;
  }
  document.getElementById('formError').textContent = '';

  var saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Speichern…';

  var promise;
  if (editingId === null) {
    promise = apiRewards('POST', null, result.payload);
  } else {
    promise = apiRewards('PATCH', 'id=' + encodeURIComponent(editingId), result.payload);
  }

  promise
    .then(function() {
      closeModal();
      showToast(editingId === null ? '✅ Reward erstellt!' : '✅ Reward aktualisiert!', 'ok');
      loadRewards();
    })
    .catch(function(e) {
      document.getElementById('formError').textContent = '❌ Fehler: ' + (e.message || e);
    })
    .finally(function() {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Speichern';
    });
}

// ── Löschen ──────────────────────────────────────────────────────────────

function handleDelete() {
  if (!editingId) return;
  if (!confirm('Reward wirklich löschen?')) return;

  var deleteBtn = document.getElementById('deleteBtn');
  deleteBtn.disabled = true;

  apiRewards('DELETE', 'id=' + encodeURIComponent(editingId), null)
    .then(function() {
      closeModal();
      showToast('🗑️ Reward gelöscht.', 'ok');
      loadRewards();
    })
    .catch(function(e) {
      document.getElementById('formError').textContent = '❌ Löschen fehlgeschlagen: ' + (e.message || e);
      deleteBtn.disabled = false;
    });
}

// ── Event-Listener ───────────────────────────────────────────────────────

document.getElementById('fType').addEventListener('change', onTypeChange);
document.getElementById('addBtn').addEventListener('click', openNew);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
document.getElementById('saveBtn').addEventListener('click', handleSave);
document.getElementById('deleteBtn').addEventListener('click', handleDelete);

document.getElementById('modalBackdrop').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ── Twitch-Autorisierung ─────────────────────────────────────────────────

window.Twitch.ext.onAuthorized(function(auth) {
  var payload = decodeJwtPayload(auth.token);
  var role = payload && payload.role;

  var statusEl = document.getElementById('authStatus');
  if (role !== 'broadcaster') {
    statusEl.className = 'status-bar err';
    statusEl.textContent = '🔒 Nur der Broadcaster kann die Konfiguration öffnen.';
    return;
  }

  broadcasterJwt = auth.token;
  statusEl.className = 'status-bar ok';
  statusEl.textContent = '✔ Twitch-Verbindung hergestellt (Broadcaster)';

  document.getElementById('mainPanel').classList.add('visible');

  loadRewards();
});

// Initiale Typ-Sektionen + Privacy-Link setzen
onTypeChange();
setPrivacyLink(PRIVACY_URL);
