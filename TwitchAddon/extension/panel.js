// Werte werden beim GitHub-Build per sed ersetzt (siehe build.yml)
const EBS_BASE_URL = '__EBS_BASE_URL__';
const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON = '__SUPABASE_ANON_KEY__';

let viewerUserId = null;
let viewerJwt = null;
let userPoints = 0;
let allRewards = [];
let selectedId = null;
let redeemBusy = false;
let cooldownTimer = null;

function fmt(n) { return Number(n).toLocaleString('de-DE'); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function setRedeemStatus(msg, type) {
  type = type || 'success';
  const el = document.getElementById('redeemStatus');
  el.innerHTML = msg ? '<div class="' + type + '-msg">' + msg + '</div>' : '';
  if (msg) setTimeout(function() { el.innerHTML = ''; }, 4000);
}

function updateFooterPoints(pts) {
  const el = document.getElementById('pointsDisplay');
  if (el) el.textContent = (pts !== null && pts !== undefined) ? fmt(pts) : '–';
}

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

function loadMyPoints(uid, jwt) {
  const headers = {};
  if (jwt) headers['x-extension-jwt'] = jwt;
  fetch(EBS_BASE_URL + '/api/points?user_id=' + encodeURIComponent(uid), { headers: headers })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data.registered) {
          userPoints = 0;
          updateFooterPoints(null);
        } else {
          userPoints = data.points || 0;
          updateFooterPoints(userPoints);
        }
      })
      .catch(function() { updateFooterPoints(null); });
}

function loadLeaderboard() {
  const el = document.getElementById('leaderboardList');
  fetch(EBS_BASE_URL + '/api/leaderboard?limit=10')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data.length) { el.innerHTML = '<div class="status-msg">Noch keine Eintraege.</div>'; return; }
        const medals = ['🥇', '🥈', '🥉'];
        const classes = ['top1', 'top2', 'top3'];
        el.innerHTML = data.map(function(e, i) {
          return '<div class="leaderboard-row">' +
              '<span class="rank ' + (classes[i] || '') + '">' + (medals[i] || i+1) + '</span>' +
              '<span class="name">' + esc(e.display_name || e.twitch_user_id) + '</span>' +
              '<span class="pts">' + fmt(e.points) + '</span>' +
              '</div>';
        }).join('');
      })
      .catch(function() { el.innerHTML = '<div class="error-msg">Fehler.</div>'; });
}

function loadRewards() {
  fetch(EBS_BASE_URL + '/api/rewards')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        allRewards = data.filter(function(r) { return r.is_enabled !== false; }).sort(function(a,b) { return a.cost - b.cost; });
        if (!selectedId) renderList();
      })
      .catch(function() { document.getElementById('rewardsArea').innerHTML = '<div class="error-msg">Rewards konnten nicht geladen werden.</div>'; });
}

function renderList() {
  const el = document.getElementById('rewardsArea');
  if (!allRewards.length) { el.innerHTML = '<div class="status-msg">Keine Rewards.</div>'; return; }
  el.innerHTML = allRewards.map(function(r) {
    return '<button class="reward-item" data-id="' + esc(String(r.id)) + '">' +
        '<span class="reward-item-name">' + esc(r.name || r.description || 'Reward') + '</span>' +
        '<span class="reward-item-cost">' + fmt(r.cost) + ' P</span>' +
        '</button>';
  }).join('');

  el.querySelectorAll('.reward-item').forEach(function(btn) {
    btn.addEventListener('click', function() { openReward(btn.getAttribute('data-id')); });
  });
}

function openReward(id) {
  selectedId = id;
  setRedeemStatus('');
  if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
  const r = allRewards.find(function (x) {
    return String(x.id) === String(id);
  });
  if (!r) return;

  const el = document.getElementById('rewardsArea');
  el.innerHTML =
      '<div class="reward-detail">' +
      '<button class="back-btn" id="backBtn">← Zurück</button>' +
      '<div class="detail-name">' + esc(r.name || 'Reward') + '</div>' +
      '<div class="detail-cost">' + fmt(r.cost) + ' Punkte</div>' +
      (r.istts && !r.text ? '<textarea class="tts-input" id="ttsInput" placeholder="Deine Nachricht..." rows="3" maxlength="200"></textarea>' : '') +
      '<button class="redeem-btn" id="redeemBtn">Jetzt einlösen</button>' +
      '</div>';

  document.getElementById('backBtn').addEventListener('click', backToList);
  document.getElementById('redeemBtn').addEventListener('click', handleRedeem);

  if (userPoints < r.cost) {
    const btn = document.getElementById('redeemBtn');
    btn.disabled = true;
    btn.textContent = 'Zu wenig Punkte (' + fmt(userPoints) + ' / ' + fmt(r.cost) + ')';
    return;
  }

  if (viewerUserId) checkCooldown(r);
}

function backToList() {
  selectedId = null;
  if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
  setRedeemStatus('');
  renderList();
}

function checkCooldown(reward) {
  const btn = document.getElementById('redeemBtn');
  if (!btn) return;

  sbGet('redeemed_global', '?reward_id=eq.' + reward.id + '&is_active=eq.true&limit=1')
      .then(function(rows) {
        if (rows && rows.length > 0) {
          const g = rows[0];
          if (g.expires_at) {
            const rem = new Date(g.expires_at).getTime() - Date.now();
            if (rem > 0) { btn.disabled = true; btn.textContent = 'Cooldown: ' + Math.ceil(rem/1000) + 's'; return; }
          } else {
            btn.disabled = true; btn.textContent = 'Bereits eingelöst (Stream)'; return;
          }
        }
        if (!reward.cooldown) return;
        sbGet('redeemed_rewards',
            '?twitch_user_id=eq.' + encodeURIComponent(viewerUserId) + '&reward_id=eq.' + reward.id + '&order=timestamp.desc&limit=1')
            .then(function(rows2) {
              if (rows2 && rows2.length > 0 && rows2[0].timestamp) {
                const last = new Date(rows2[0].timestamp).getTime();
                const rem2 = last + reward.cooldown * 1000 - Date.now();
                if (rem2 > 0) {
                  btn.disabled = true;
                  btn.textContent = 'Cooldown: ' + Math.ceil(rem2/1000) + 's';
                  cooldownTimer = setInterval(function() {
                    const r2 = last + reward.cooldown * 1000 - Date.now();
                    const b = document.getElementById('redeemBtn');
                    if (!b) { clearInterval(cooldownTimer); return; }
                    if (r2 > 0) { b.textContent = 'Cooldown: ' + Math.ceil(r2/1000) + 's'; }
                    else { clearInterval(cooldownTimer); b.disabled = false; b.textContent = 'Jetzt einlösen'; }
                  }, 1000);
                }
              }
            }).catch(function() {});
      }).catch(function() {});
}

function handleRedeem() {
  if (!selectedId || redeemBusy) return;
  const r = allRewards.find(function (x) {
    return String(x.id) === String(selectedId);
  });
  if (!r || !viewerJwt) return;

  const ttsEl = document.getElementById('ttsInput');
  const ttsText = ttsEl ? ttsEl.value.trim() : '';
  if (r.istts && !r.text && !ttsText) return;

  if (userPoints < r.cost) {
    setRedeemStatus('❌ Nicht genug Punkte (' + fmt(userPoints) + ' / ' + fmt(r.cost) + ' P).', 'error');
    return;
  }

  redeemBusy = true;
  const btn = document.getElementById('redeemBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Lädt…'; }

  fetch(EBS_BASE_URL + '/api/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-extension-jwt': viewerJwt },
    body: JSON.stringify({ reward_id: String(r.id), tts_text: ttsText || null }),
  })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.success) {
          setRedeemStatus('✅ "' + esc(r.name) + '" eingelöst!', 'success');
          userPoints -= r.cost;
          updateFooterPoints(userPoints);
          setTimeout(backToList, 2000);
        } else if (data && data.error) {
          const msgs = {
            invalid_jwt: 'Authentifizierung fehlgeschlagen.',
            stream_offline: 'Stream ist gerade offline.',
            user_not_found: 'Account nicht gefunden.',
            not_enough_points: 'Nicht genug Punkte.',
            cooldown_active: 'Cooldown aktiv – noch ' + (data.remaining || '?') + 's.',
            once_per_stream_active: 'Einmalig pro Stream – bereits eingelöst.',
            reward_disabled: 'Reward gerade deaktiviert.',
            rpc_error: 'Serverfehler beim Einlösen.',
          };
          setRedeemStatus('❌ ' + (msgs[data.error] || data.error), 'error');
          const b = document.getElementById('redeemBtn');
          if (b) { b.disabled = false; b.textContent = 'Jetzt einlösen'; }
        } else {
          setRedeemStatus('❌ Unbekannte Antwort.', 'error');
          const b2 = document.getElementById('redeemBtn');
          if (b2) { b2.disabled = false; b2.textContent = 'Jetzt einlösen'; }
        }
        redeemBusy = false;
      })
      .catch(function(e) {
        setRedeemStatus('❌ Fehler: ' + esc(e.message), 'error');
        const b = document.getElementById('redeemBtn');
        if (b) { b.disabled = false; b.textContent = 'Jetzt einlösen'; }
        redeemBusy = false;
      });
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch(e) { return null; }
}

window.Twitch.ext.onAuthorized(function(auth) {
  viewerJwt = auth.token;
  // auth.userId ist die opake ID (U<hash>); die echte numerische Twitch-User-ID steckt im JWT-Payload
  const payload = decodeJwtPayload(auth.token);
  viewerUserId = (payload && payload.user_id) ? payload.user_id : null;

  if (!viewerUserId) {
    window.Twitch.ext.actions.requestIdShare();
  }

  loadMyPoints(auth.userId, auth.token);

  if (allRewards.length && !selectedId) renderList();
});

loadLeaderboard();
loadRewards();

setInterval(function() {
  loadLeaderboard();
  if (!selectedId) loadRewards();
  if (viewerJwt) loadMyPoints(viewerUserId || '', viewerJwt);
}, 60000);
