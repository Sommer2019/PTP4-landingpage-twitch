async function fetchRewards() {
      console.log('[Overlay] Lade Rewards aus DB ...');
      const response = await fetch('/api/rewards');
      const data = await response.json();
      console.log('[Overlay] Rewards geladen:', data);
      return data;
    }
    async function fetchRedeemedRewards() {
      console.log('[Overlay] Lade eingelöste Rewards ...');
      const response = await fetch('/api/redeemed_rewards');
      const data = await response.json();
      console.log('[Overlay] Eingelöste Rewards:', data);
      return data;
    }
    let pollTimeoutId = null;
    let isPlaying = false;
    // IDs der zuletzt abgespielten Rewards merken (max 20)
    function getPlayedRewardIds() {
      try {
        return JSON.parse(localStorage.getItem('playedRewardIds') || '[]');
      } catch { return []; }
    }
    function addPlayedRewardId(id) {
      let arr = getPlayedRewardIds();
      arr.push(id);
      if (arr.length > 20) arr = arr.slice(arr.length - 20);
      localStorage.setItem('playedRewardIds', JSON.stringify(arr));
    }
    async function pollRedeemedRewards() {
      if (isPlaying) return; // Blockiere doppeltes Polling wÃ¤hrend Wiedergabe
      const now = Date.now();
      const redeemed = await fetchRedeemedRewards();
      const playedIds = getPlayedRewardIds();
      // Finde ersten Reward, der noch nicht gespielt wurde
      const next = redeemed.find(r => !playedIds.includes(r.id));
      console.log(`[Overlay] Polling: ${redeemed.length} Rewards gefunden, Zeit seit letztem: ${now - lastRedeemTime}ms`);
      if (next && (now - lastRedeemTime >= MIN_REDEEM_INTERVAL)) {
        console.log('[Overlay] Spiele nächsten Reward ab ...');
        isPlaying = true;
        await playAndDeleteReward(next);
        lastRedeemTime = Date.now();
        addPlayedRewardId(next.id);
        // Das weitere Polling wird erst nach erfolgreichem LÃ¶schen im clearAndDelete() wieder gestartet!
      } else {
        document.getElementById('media').innerHTML = '';
        pollTimeoutId = setTimeout(pollRedeemedRewards, 5000);
      }
    }

    async function playAndDeleteReward(redeemed) {
      try {
        console.log('[Overlay] Starte playAndDeleteReward für:', redeemed);
        const rewards = await fetchRewards();
        const reward = rewards.find(r => String(r.id) === String(redeemed.reward_id));
        console.log('[Overlay] Gefundener Reward:', reward);
        if (!reward) {
          console.error('[Overlay] âŒ Reward NICHT gefunden! reward_id:', redeemed.reward_id);
          console.log('[Overlay] Verfügbare Reward-IDs:', rewards.map(r => r.id));
          return;
        }
        console.log('[Overlay] reward.istts:', reward?.istts, 'typeof:', typeof reward?.istts);
        const mediaDiv = document.getElementById('media');
        mediaDiv.innerHTML = '';
        let duration = reward.duration ? parseInt(reward.duration, 10) : 10; // Standard 10 Sekunden
        console.log(`[Overlay] Zeige Reward: ${reward.id}, Dauer: ${duration}s`);
        const mediaUrl = reward.mediaurl || '';
        const imageUrl = reward.imageurl || '';
        const textContent = reward.text || reward.description || '';

        // Hole Display-User vom Backend
        let username = redeemed.display_user || redeemed.username || redeemed.user || redeemed.twitch_user_name;
        if (!username) {
          username = 'Unbekannt';
        }
        console.log('[Overlay] Verwendeter Username:', username, 'von redeemed:', redeemed.display_user || redeemed.username || redeemed.user || redeemed.twitch_user_name || redeemed.twitch_user_id);
        const lower = (mediaUrl || '').toLowerCase();
        const isYouTube = /youtube\.com|youtu\.be/.test(lower);
        const isAudio = /\.(mp3|wav|ogg|m4a)(\?|$)/.test(lower);
        const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/.test(lower) || imageUrl;
      function withUsernamePrefix(text) {
        const base = (text || '').trim();
        if (!username) return base;
        if (!base) return username;
        const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`^${escapedUsername}\\s*[:\-]`, 'i').test(base)) {
          return base;
        }
        return `${username}: ${base}`;
      }
      function getRewardContainerHtml(usernameText, mainContent) {
        // Wenn kein mainContent, returne einfach nur username
        if (!mainContent || mainContent.trim() === '') {
          if (usernameText) {
            return `<div class="reward-username">${usernameText}</div>`;
          }
          return '';
        }
        // Wrapper mit Username oben
        let html = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5em;">';
        if (usernameText) {
          html += `<div class="reward-username">${usernameText}</div>`;
        }
        html += mainContent;
        html += '</div>';
        return html;
      }
      function getRewardTextHtml(textContent) {
        if (textContent && String(textContent).trim().length > 0) {
          return `<div class=\"reward-text\">${textContent}</div>`;
        }
        return '';
      }
      function afterPlayback() {
        // Nach der Wiedergabe: Lösche Reward aus DB
        fetch(`/api/redeemed_rewards?id=${redeemed.id}`, { method: 'DELETE' })
          .then(async response => {
            const text = await response.text();
            if (response.ok) {
              console.log('[Overlay] Reward nach Wiedergabe gelöscht:', redeemed.id, '| Status:', response.status, '| Antwort:', text);
            } else {
              console.error('[Overlay] Fehler beim Löschen nach Wiedergabe:', response.status, response.statusText, '| Antwort:', text);
            }
          })
          .catch(e => {
            console.error('[Overlay] Fehler beim Löschen nach Wiedergabe (Netzwerk/JS):', e);
          });
        mediaDiv.innerHTML = '';
        isPlaying = false;
        pollTimeoutId = setTimeout(pollRedeemedRewards, 5000);
      }
      if (reward.istts === true || reward.istts === 'true' || reward.istts === 1) {
        let text;
        console.log('[Overlay] TTS Reward erkannt. redeemed.ttstext:', redeemed.ttstext);

        // Text-Logik beibehalten
        if (reward.name && reward.name.toLowerCase().includes('raid')) {
          const target = redeemed.ttstext || redeemed.tts_text || redeemed.ttsText || redeemed.description || '';
          text = `RAID-AnfÃ¼hrer ${username} zu ${target}`;
        } else {
          text = redeemed.ttstext || redeemed.tts_text || redeemed.ttsText || redeemed.description || reward.description || 'Text to Speech';
        }

        // 1. Text anzeigen
        mediaDiv.innerHTML = getRewardTextHtml(withUsernamePrefix(text));

        // 2. Audio Ã¼ber deinen neuen Proxy abspielen
        console.log('[Overlay] Starte Proxy-TTS: ' + text);
        const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}`;
        const audio = new Audio(ttsUrl);
        audio.volume = 1.0;

        // Sicherheits-Fallback: Falls das Audio gar nicht lÃ¤dt/spielt
        const safetyTimeout = setTimeout(() => {
          console.warn('[Overlay] TTS Proxy-Fallback ausgelÃ¶st (Timeout)');
          afterPlayback();
        }, (duration * 1000) + 1000);

        audio.onplay = () => {
          console.log('[Overlay] Proxy-TTS spielt ab...');
        };

        audio.onended = () => {
          clearTimeout(safetyTimeout);
          console.log('[Overlay] Proxy-TTS erfolgreich beendet');
          afterPlayback();
        };

        audio.onerror = (e) => {
          clearTimeout(safetyTimeout);
          console.error('[Overlay] Proxy-TTS Fehler:', e);
          afterPlayback(); // Trotz Fehler weitermachen, damit die Queue nicht hakt
        };

        audio.play().catch(err => {
          console.error("[Overlay] Autoplay-Error beim Proxy-TTS:", err);
          // Wenn Autoplay blockiert wird, nach der eingestellten Dauer weitermachen
          setTimeout(afterPlayback, duration * 1000);
        });

      } else if (mediaUrl) {
          if (isYouTube) {
          const ytIdMatch = mediaUrl.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
          const ytId = ytIdMatch ? ytIdMatch[1] : '';
          if (reward.showmedia === false) {
            let imgHtml = '';
            if (imageUrl) imgHtml = `<img src=\"${imageUrl}\" alt=\"Reward-Bild\" style=\"max-width:50vw;max-height:50vh;\" />`;
            const contentHtml = imgHtml + getRewardTextHtml(textContent);
            mediaDiv.innerHTML = getRewardContainerHtml(username, contentHtml);
            // Stille YouTube im Hintergrund
            mediaDiv.innerHTML += `<iframe width="1" height="1" style="opacity:0;position:absolute;left:-9999px;pointer-events:none;" src="https://www.youtube.com/embed/${ytId}?autoplay=1" allow="autoplay; encrypted-media"></iframe>`;
            console.log('[Overlay] YouTube-Video ausgeblendet, Ton lÃ¤uft, zeige stattdessen Bild/Text:', imageUrl, textContent);
            setTimeout(afterPlayback, duration * 1000);
          } else {
            if (!window.YT) {
              let tag = document.createElement('script');
              tag.src = "https://www.youtube.com/iframe_api";
              document.body.appendChild(tag);
            }
            function onYouTubeIframeAPIReadyWrapper() {
              const ytHtml = `<div id=\"ytplayer\"></div>`;
              const textHtml = getRewardTextHtml(textContent);
              mediaDiv.innerHTML = getRewardContainerHtml(username, ytHtml + textHtml);
              let player = new window.YT.Player('ytplayer', {
                height: '315',
                width: '560',
                videoId: ytId,
                playerVars: { 'autoplay': 1 },
                events: {
                  'onStateChange': function(event) {
                    if (event.data === window.YT.PlayerState.PLAYING) {
                      console.log('[Overlay] YouTube-Video PLAYING:', mediaUrl, '| getCurrentTime:', player.getCurrentTime());
                    }
                    if (event.data === window.YT.PlayerState.ENDED) {
                      console.log('[Overlay] YouTube-Video ENDED:', mediaUrl);
                      afterPlayback();
                    }
                  }
                }
              });
              setTimeout(() => {
                console.warn('[Overlay] YouTube-Timeout als Fallback ausgelÃ¶st!');
                afterPlayback();
              }, duration * 1000);
              console.log('[Overlay] YouTube-Video eingebettet (API):', mediaUrl);
            }
            if (window.YT && window.YT.Player) {
              onYouTubeIframeAPIReadyWrapper();
            } else {
              window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReadyWrapper;
            }
          }
         } else if (isAudio) {
           const contentHtml = `<audio id=\"rewardAudio\" src=\"${mediaUrl}\" controls autoplay></audio>` + getRewardTextHtml(textContent);
           mediaDiv.innerHTML = getRewardContainerHtml(username, contentHtml);
           console.log('[Overlay] Audio-Element erzeugt:', mediaUrl);
           const audio = document.getElementById('rewardAudio');
           if (audio) {
             audio.onloadedmetadata = () => {
               if (!reward.duration) duration = Math.ceil(audio.duration);
               setTimeout(afterPlayback, duration * 1000);
               console.log('[Overlay] Sound geladen, Dauer:', audio.duration);
             };
             audio.onended = afterPlayback;
           } else {
             setTimeout(afterPlayback, duration * 1000);
           }
         } else if (isImage) {
           const imgSrc = imageUrl || mediaUrl;
           const contentHtml = `<img src=\"${imgSrc}\" alt=\"Reward-Bild\" style=\"max-width:50vw;max-height:50vh;\" />` + getRewardTextHtml(textContent);
           mediaDiv.innerHTML = getRewardContainerHtml(username, contentHtml);
           console.log('[Overlay] Image+Text Reward:', imgSrc, textContent);
           setTimeout(afterPlayback, duration * 1000);
         } else {
           const contentHtml = getRewardTextHtml(textContent || reward.description || '');
           mediaDiv.innerHTML = getRewardContainerHtml(username, contentHtml);
           console.log('[Overlay] Unbekannter Media-Typ, zeige Text:', textContent || reward.description || '');
           setTimeout(afterPlayback, duration * 1000);
         }
       } else {
         const contentHtml = getRewardTextHtml(textContent || reward.description || '');
         mediaDiv.innerHTML = getRewardContainerHtml(username, contentHtml);
         console.log('[Overlay] Fallback Reward:', reward.description);
         setTimeout(afterPlayback, duration * 1000);
       }
      } catch (error) {
        console.error('[Overlay] FEHLER in playAndDeleteReward:', error);
        isPlaying = false;
        pollTimeoutId = setTimeout(pollRedeemedRewards, 5000);
      }
    }
    let lastRedeemTime = 0;
    const MIN_REDEEM_INTERVAL = 5000;

    // OBS Browser Workaround: Initialisiere Web Audio Context
    function initAudioContext() {
      console.log('[Overlay] ðŸ”Š Versuche Audio-Kontext zu initialisieren (OBS-Fix)');
      try {
        // Methode 1: Web Audio API Context starten
        if (window.AudioContext || window.webkitAudioContext) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const audioContext = new AudioContext();
          if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
              console.log('[Overlay] âœ… Audio-Kontext aktiviert (resume erfolgreich)');
            }).catch(e => {
              console.log('[Overlay] âš ï¸ Audio-Kontext resume fehlgeschlagen:', e);
            });
          } else {
            console.log('[Overlay] âœ… Audio-Kontext bereits aktiv');
          }
        }

        // Methode 2: speechSynthesis auch resumieren (fÃ¼r OBS)
        if (window.speechSynthesis && window.speechSynthesis.resume) {
          try {
            window.speechSynthesis.resume();
            console.log('[Overlay] âœ… speechSynthesis.resume() aufgerufen');
          } catch (e) {
            console.log('[Overlay] âš ï¸ speechSynthesis.resume() nicht unterstÃ¼tzt');
          }
        }

        // Methode 3: Erstelle einen sehr kurzen Audio-Chunk mit Web Audio API
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.setValueAtTime(0, ctx.currentTime); // Stille!
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.001); // 1ms spÃ¤ter stoppen
          console.log('[Overlay] âœ… Web Audio Trick aufgerufen');
        } catch (e) {
          console.log('[Overlay] âš ï¸ Web Audio Trick fehlgeschlagen:', e);
        }
      } catch (e) {
        console.log('[Overlay] âš ï¸ Audio-Kontext Initialization fehlgeschlagen:', e);
      }
    }

    // Initialisiere auf Seitenload
    window.addEventListener('load', initAudioContext);
    window.addEventListener('DOMContentLoaded', initAudioContext);

    // Auch Ã¼ber Click-Event (Fallback)
    document.addEventListener('click', initAudioContext, { once: true });

    // ZusÃ¤tzlich nach KurzverzÃ¶gerung
    setTimeout(initAudioContext, 100);
    setTimeout(initAudioContext, 500);

    pollRedeemedRewards();
