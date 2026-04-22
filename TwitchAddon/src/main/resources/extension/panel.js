// Werte werden beim GitHub-Build per sed ersetzt (siehe build.yml)
var EBS_BASE_URL  = '__EBS_BASE_URL__';
var SUPABASE_URL  = '__SUPABASE_URL__';
var SUPABASE_ANON = '__SUPABASE_ANON_KEY__';

var viewerUserId  = null;
var viewerJwt     = null;
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

function updateFooterPoints(pts) {
  var el = document.getElementById('pointsDisplay');
  if (el) el.textContent = (pts !== null && pts !== undefined) ? fmt(pts) : '\u2013';
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
  var headers = {};
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
  var el = document.getElementById('leaderboardList');
  fetch(EBS_BASE_URL + '/api/leaderboard?limit=10')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data.length) { el.innerHTML = '<div class="status-msg">Noch keine Eintraege.</div>'; return; }
        var medals  = ['\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49'];
        var classes = ['top1','top2','top3'];
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
  var el = document.getElementById('rewardsArea');
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
  var r = allRewards.find(function(x) { return String(x.id) === String(id); });
  if (!r) return;

  var el = document.getElementById('rewardsArea');
  el.innerHTML =
      '<div class="reward-detail">' +
      '<button class="back-btn" id="backBtn">\u2190 Zur\u00fcck</button>' +
      '<div class="detail-name">' + esc(r.name || 'Reward') + '</div>' +
      '<div class="detail-cost">' + fmt(r.cost) + ' Punkte</div>' +
      (r.istts && !r.text ? '<textarea class="tts-input" id="ttsInput" placeholder="Deine Nachricht..." rows="3" maxlength="200"></textarea>' : '') +
      '<button class="redeem-btn" id="redeemBtn">Jetzt einl\u00f6sen</button>' +
      '</div>';

  document.getElementById('backBtn').addEventListener('click', backToList);
  document.getElementById('redeemBtn').addEventListener('click', handleRedeem);

  if (userPoints < r.cost) {
    var btn = document.getElementById('redeemBtn');
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
            btn.disabled = true; btn.textContent = 'Bereits eingelöst (Stream)'; return;
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
                    else { clearInterval(cooldownTimer); b.disabled = false; b.textContent = 'Jetzt einl\u00f6sen'; }
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
  if (btn) { btn.disabled = true; btn.textContent = 'L\u00e4dt\u2026'; }

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
          setRedeemStatus('\u2705 "' + esc(r.name) + '" eingelöst!', 'success');
          userPoints -= r.cost;
          updateFooterPoints(userPoints);
          setTimeout(backToList, 2000);
        } else if (data && data.error) {
          var msgs = {
            cooldown_active:        'Cooldown aktiv \u2013 noch ' + (data.remaining || '?') + 's.',
            once_per_stream_active: 'Einmalig pro Stream \u2013 bereits eingelöst.',
            reward_disabled:        'Reward gerade deaktiviert.',
            not_enough_points:      'Nicht genug Punkte.',
            user_not_found:         'Account nicht gefunden.',
          };
          setRedeemStatus('\u274C ' + (msgs[data.error] || data.error), 'error');
          var b = document.getElementById('redeemBtn');
          if (b) { b.disabled = false; b.textContent = 'Jetzt einl\u00f6sen'; }
        } else {
          setRedeemStatus('\u274C Unbekannte Antwort.', 'error');
          var b2 = document.getElementById('redeemBtn');
          if (b2) { b2.disabled = false; b2.textContent = 'Jetzt einl\u00f6sen'; }
        }
        redeemBusy = false;
      })
      .catch(function(e) {
        setRedeemStatus('\u274C Fehler: ' + esc(e.message), 'error');
        var b = document.getElementById('redeemBtn');
        if (b) { b.disabled = false; b.textContent = 'Jetzt einl\u00f6sen'; }
        redeemBusy = false;
      });
}

window.Twitch.ext.onAuthorized(function(auth) {
  viewerJwt = auth.token;
  viewerUserId = (auth.userId && auth.userId !== '0') ? auth.userId : null;

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
