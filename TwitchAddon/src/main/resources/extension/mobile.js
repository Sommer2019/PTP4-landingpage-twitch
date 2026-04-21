// Wert wird beim GitHub-Build per sed ersetzt (siehe build.yml)
var EBS_BASE_URL = '__EBS_BASE_URL__';

var viewerUserId = null;

function fmt(n) { return Number(n).toLocaleString('de-DE'); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function loadMyPoints(uid) {
  var el = document.getElementById('myPoints');
  fetch(EBS_BASE_URL + '/api/points?user_id=' + encodeURIComponent(uid))
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

function loadLeaderboard() {
  var el = document.getElementById('leaderboardList');
  fetch(EBS_BASE_URL + '/api/leaderboard?limit=10')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.length) { el.innerHTML = '<div class="status-msg">Noch keine Einträge.</div>'; return; }
      var medals  = ['🥇','🥈','🥉'];
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
  viewerUserId = (auth.userId && auth.userId !== '0') ? auth.userId : null;
  if (viewerUserId) {
    loadMyPoints(viewerUserId);
  } else {
    document.getElementById('myPoints').innerHTML =
      '<div class="not-registered">Anmelden um Punkte zu sehen.</div>';
  }
});

loadLeaderboard();

setInterval(function() {
  loadLeaderboard();
  if (viewerUserId) loadMyPoints(viewerUserId);
}, 60000);
