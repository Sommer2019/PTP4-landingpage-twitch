// Wert wird beim GitHub-Build per sed ersetzt (siehe build.yml)
var EBS_BASE_URL = '__EBS_BASE_URL__';

var viewerUserId = null;
var viewerJwt = null; // JWT Token speichern

function fmt(n) { return Number(n).toLocaleString('de-DE'); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function loadMyPoints(uid, jwt) {
  var el = document.getElementById('myPoints');
  var headers = {};
  if (jwt) headers['x-extension-jwt'] = jwt;
  
  fetch(EBS_BASE_URL + '/api/points?user_id=' + encodeURIComponent(uid), {
    headers: headers
  })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.registered) {
        el.innerHTML = '<div class="not-registered">Noch nicht registriert.</div>';
      } else {
        el.innerHTML = '<div class="points-card"><div class="points-label">Deine Punkte</div><div class="points-value">' + fmt(data.points) + '</div></div>';
      }
    })
    .catch(function() { el.innerHTML = '<div class="error-msg">Fehler beim Laden.</div>'; });
}

function loadLeaderboard(jwt) {
  var el = document.getElementById('leaderboardList');
  var headers = {};
  if (jwt) headers['x-extension-jwt'] = jwt;
  
  fetch(EBS_BASE_URL + '/api/leaderboard?limit=10', {
    headers: headers
  })
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

window.Twitch.ext.onAuthorized(function(auth) {
  viewerJwt = auth.token; // JWT speichern
  viewerUserId = (auth.userId && auth.userId !== '0') ? auth.userId : null;

  if (!viewerUserId) {
    // Identitaetslink anfordern
    window.Twitch.ext.actions.requestIdShare();
    document.getElementById('myPoints').innerHTML =
      '<div class="not-registered">Bitte erteile der Extension Zugriff auf deine Twitch-ID.</div>';
  } else {
    // Immer Punkte laden — Backend löst opaque ID auf
    loadMyPoints(viewerUserId, viewerJwt);
  }
});

loadLeaderboard(viewerJwt);

setInterval(function() {
  loadLeaderboard(viewerJwt);
  if (viewerUserId) loadMyPoints(viewerUserId, viewerJwt);
}, 60000);