// Werte werden beim GitHub-Build per sed ersetzt (siehe build.yml)
var EBS_BASE_URL  = '__EBS_BASE_URL__';
var SUPABASE_URL  = '__SUPABASE_URL__';
var SUPABASE_ANON = '__SUPABASE_ANON_KEY__';

var viewerUserId  = null;
var userPoints    = 0;
var allRewards    = [];
var selectedId    = null;
var redeemBusy    = false;
var cooldownTimer = null;

function fmt(n) { return Number(n).toLocaleString('de-DE'); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function setRedeemStatus(msg, type) {
  type = type || 'success';
  var el = document.getElementById('redeemStatus');
  el.innerHTML = msg ? '<div class="' + type + '-msg">' + msg + '</div>' : '';
  if (msg) setTimeout(function() { el.innerHTML = ''; }, 4000);
}

// Supabase REST helpers
function sbRpc(fn, params) {
  return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON },
    body: JSON.stringify(params),
  }).then(function(res) {
    if (!res.ok) throw new Error('RPC ' + res.status);
    return res.json();
  });
}

function sbGet(table, qs) {
  return fetch(SUPABASE_URL + '/rest/v1/' + table + qs, {
    headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON, 'Accept': 'application/json' },
  }).then(function(res) {
    if (!res.ok) throw new Error('GET ' + res.status);
    return res.json();
  });
}

// Loaders
function loadMyPoints(uid) {
  var el = document.getElementById('myPoints');
  fetch(EBS_BASE_URL + '/api/points?user_id=' + encodeURIComponent(uid))
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.registered) {
        userPoints = 0;
        el.innerHTML = '<div class="not-registered">Du bist noch nicht in der Datenbank.<br>Schau beim naechsten Stream vorbei!</div>';
      } else {
        userPoints = data.points || 0;
        el.innerHTML = '<div class="points-card"><div class="points-label">Deine Punkte</div><div class="points-value" id="pointsDisplay">' + fmt(userPoints) + '</div><div class="points-sub">Kanalpunkte (PTP)</div></div>';
      }
    })
    .catch(function() { el.innerHTML = '<div class="error-msg">Punkte konnten nicht geladen werden.</div>'; });
}

function loadLeaderboard() {
  var el = document.getElementById('leaderboardList');
  fetch(EBS_BASE_URL + '/api/leaderboard?limit=10')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.length) { el.innerHTML = '<div class="status-msg">Noch keine Eintraege.</div>'; return; }
      var medals = ['\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49'];
      el.innerHTML = data.map(function(e, i) {
        return '<div class="leaderboard-row">' +
          '<span class="leaderboard-rank ' + (i < 3 ? 'top' + (i+1) : '') + '">' + (medals[i] || i+1) + '</span>' +
          '<span class="leaderboard-name">' + esc(e.display_name || e.twitch_user_id) + '</span>' +
          '<span class="leaderboard-pts">' + fmt(e.points) + '</span>' +
          '</div>';
      }).join('');
    })
    .catch(function() { el.innerHTML = '<div class="error-msg">Rangliste konnte nicht geladen werden.</div>'; });
}

function loadRewards() {
  fetch(EBS_BASE_URL + '/api/rewards')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      allRewards = data.filter(function(r) { return r.is_enabled !== false; }).sort(function(a,b) { return a.cost - b.cost; });
      if (!selectedId) renderGrid();
    })
    .catch(function() { document.getElementById('rewardsArea').innerHTML = '<div class="error-msg">Rewards konnten nicht geladen werden.</div>'; });
}

function renderGrid() {
  var el = document.getElementById('rewardsArea');
  if (!allRewards.length) { el.innerHTML = '<div class="status-msg">Keine Rewards verfuegbar.</div>'; return; }
  el.innerHTML = '<div class="reward-grid">' + allRewards.map(function(r) {
    return '<button class="reward-card" data-id="' + esc(String(r.id)) + '">' +
      '<div class="reward-card-title">' + esc(r.name || r.description || 'Reward') + '</div>' +
      '<div class="reward-card-cost">' + fmt(r.cost) + ' P</div>' +
      '</button>';
  }).join('') + '</div>';

  el.querySelectorAll('.reward-card').forEach(function(btn) {
    btn.addEventListener('click', function() { openReward(btn.getAttribute('data-id')); });
  });
}

function openReward(id) {
  selectedId = id;
  setRedeemStatus('');
  if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
  var r = allRewards.find(function(x) { return String(x.id) === String(id); });
  if (!r) return;

  var el = document.getElementById('rewardsArea');
  el.innerHTML =
    '<div class="reward-detail">' +
    '<button class="back-btn" id="backBtn">\u2190 Zurueck</button>' +
    '<div class="detail-name">' + esc(r.name || 'Reward') + '</div>' +
    '<div class="detail-cost">' + fmt(r.cost) + ' Punkte</div>' +
    (r.istts && !r.text ? '<textarea class="tts-input" id="ttsInput" placeholder="Deine Nachricht..." rows="3" maxlength="200"></textarea>' : '') +
    '<button class="redeem-btn" id="redeemBtn">Jetzt einloesen</button>' +
    '</div>';

  document.getElementById('backBtn').addEventListener('click', backToGrid);
  document.getElementById('redeemBtn').addEventListener('click', handleRedeem);

  if (userPoints < r.cost) {
    var btn = document.getElementById('redeemBtn');
    btn.disabled = true;
    btn.textContent = 'Zu wenig Punkte (' + fmt(userPoints) + ' / ' + fmt(r.cost) + ')';
    return;
  }

  if (viewerUserId) checkCooldown(r);
}

function backToGrid() {
  selectedId = null;
  if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
  setRedeemStatus('');
  renderGrid();
}

function checkCooldown(reward) {
  var btn = document.getElementById('redeemBtn');
  if (!btn) return;

  sbGet('redeemed_global', '?reward_id=eq.' + reward.id + '&is_active=eq.true&limit=1')
    .then(function(rows) {
      if (rows && rows.length > 0) {
        var g = rows[0];
        if (g.expires_at) {
          var rem = new Date(g.expires_at).getTime() - Date.now();
          if (rem > 0) { btn.disabled = true; btn.textContent = 'Cooldown: ' + Math.ceil(rem/1000) + 's'; return; }
        } else {
          btn.disabled = true; btn.textContent = 'Bereits eingeloest (Stream)'; return;
        }
      }
      if (!reward.cooldown) return;
      sbGet('redeemed_rewards',
        '?twitch_user_id=eq.' + encodeURIComponent(viewerUserId) + '&reward_id=eq.' + reward.id + '&order=timestamp.desc&limit=1')
        .then(function(rows2) {
          if (rows2 && rows2.length > 0 && rows2[0].timestamp) {
            var last = new Date(rows2[0].timestamp).getTime();
            var rem2 = last + reward.cooldown * 1000 - Date.now();
            if (rem2 > 0) {
              btn.disabled = true;
              btn.textContent = 'Cooldown: ' + Math.ceil(rem2/1000) + 's';
              cooldownTimer = setInterval(function() {
                var r2 = last + reward.cooldown * 1000 - Date.now();
                var b = document.getElementById('redeemBtn');
                if (!b) { clearInterval(cooldownTimer); return; }
                if (r2 > 0) { b.textContent = 'Cooldown: ' + Math.ceil(r2/1000) + 's'; }
                else { clearInterval(cooldownTimer); b.disabled = false; b.textContent = 'Jetzt einloesen'; }
              }, 1000);
            }
          }
        }).catch(function() {});
    }).catch(function() {});
}

function handleRedeem() {
  if (!selectedId || redeemBusy) return;
  var r = allRewards.find(function(x) { return String(x.id) === String(selectedId); });
  if (!r || !viewerUserId) return;

  var ttsEl   = document.getElementById('ttsInput');
  var ttsText = ttsEl ? ttsEl.value.trim() : '';
  if (r.istts && !r.text && !ttsText) return;

  if (userPoints < r.cost) {
    setRedeemStatus('\u274C Nicht genug Punkte (' + fmt(userPoints) + ' / ' + fmt(r.cost) + ' P).', 'error');
    return;
  }

  redeemBusy = true;
  var btn = document.getElementById('redeemBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Laedt...'; }

  sbGet('stream_sessions', '?is_active=eq.true&order=started_at.desc&limit=1&select=id')
    .catch(function() { return []; })
    .then(function(sessions) {
      var streamId = (sessions && sessions.length) ? (sessions[0].id || null) : null;

      function replace(s) { return (s || '').replace(/%name%/g, viewerUserId); }
      var description = null, ttsToSend = null;
      if (r.istts) {
        if (r.text) {
          description = replace(r.text);
        } else {
          var combined = r.description && ttsText ? r.description + ' ' + ttsText : (r.description || ttsText);
          description = replace(combined);
          ttsToSend = ttsText || null;
        }
      } else {
        description = replace(r.description);
      }

      return sbRpc('redeem_reward', {
        p_twitch_user_id: viewerUserId,
        p_reward_id:      String(r.id),
        p_description:    description,
        p_cost:           r.cost,
        p_ttstext:        ttsToSend,
        p_stream_id:      streamId,
      });
    })
    .then(function(data) {
      if (data && data.success) {
        setRedeemStatus('\u2705 "' + esc(r.name) + '" eingeloest!', 'success');
        userPoints -= r.cost;
        var pd = document.getElementById('pointsDisplay');
        if (pd) pd.textContent = fmt(userPoints);
        setTimeout(backToGrid, 2000);
      } else if (data && data.error) {
        var msgs = {
          cooldown_active:        'Cooldown aktiv - noch ' + (data.remaining || '?') + 's.',
          once_per_stream_active: 'Einmalig pro Stream - bereits eingeloest.',
          reward_disabled:        'Reward gerade deaktiviert.',
          not_enough_points:      'Nicht genug Punkte.',
          user_not_found:         'Account nicht gefunden.',
        };
        setRedeemStatus('\u274C ' + (msgs[data.error] || data.error), 'error');
        var b = document.getElementById('redeemBtn');
        if (b) { b.disabled = false; b.textContent = 'Jetzt einloesen'; }
      } else {
        setRedeemStatus('\u274C Unbekannte Antwort.', 'error');
        var b2 = document.getElementById('redeemBtn');
        if (b2) { b2.disabled = false; b2.textContent = 'Jetzt einloesen'; }
      }
      redeemBusy = false;
    })
    .catch(function(e) {
      setRedeemStatus('\u274C Fehler: ' + esc(e.message), 'error');
      var b = document.getElementById('redeemBtn');
      if (b) { b.disabled = false; b.textContent = 'Jetzt einloesen'; }
      redeemBusy = false;
    });
}

// Twitch Auth
window.Twitch.ext.onAuthorized(function(auth) {
  viewerUserId = (auth.userId && auth.userId !== '0') ? auth.userId : null;

  if (!viewerUserId) {
    // Identitaetslink anfordern damit wir die echte Twitch-User-ID bekommen
    window.Twitch.ext.actions.requestIdShare();
    document.getElementById('myPoints').innerHTML =
      '<div class="not-registered">Bitte erteile der Extension Zugriff auf deine Twitch-ID um deine Punkte zu sehen.</div>';
  } else {
    loadMyPoints(viewerUserId);
  }

  if (allRewards.length && !selectedId) renderGrid();
});

loadLeaderboard();
loadRewards();

setInterval(function() {
  loadLeaderboard();
  if (!selectedId) loadRewards();
  if (viewerUserId) loadMyPoints(viewerUserId);
}, 60000);
