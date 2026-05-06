// Debug-System
    const debugLogs = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    function addDebugLog(message) {
      debugLogs.push(message);
      if (debugLogs.length > 100) debugLogs.shift();
      updateDebugPanel();
    }

    function updateDebugPanel() {
      const panel = document.getElementById('debugLog');
      if (panel) {
        panel.textContent = debugLogs.join('\n');
        panel.parentElement.scrollTop = panel.parentElement.scrollHeight;
      }
    }

    function clearDebugLogs() {
      debugLogs.length = 0;
      updateDebugPanel();
    }

    // Intercept console logs
    console.log = function(...args) {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      addDebugLog('[LOG] ' + msg);
      originalLog.apply(console, args);
    };

    console.error = function(...args) {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      addDebugLog('[ERR] ' + msg);
      originalError.apply(console, args);
    };

    console.warn = function(...args) {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      addDebugLog('[WARN] ' + msg);
      originalWarn.apply(console, args);
    };

    // Zeige Debug-Panel auf Druck von 'd'
    document.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        const panel = document.getElementById('debugPanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
    });

    function testTTSManual() {
      console.log('[DEBUG] Starte TTS über Java-Backend-Proxy...');
      const testText = "Dies ist ein Test über den Proxy.";

      // Wir rufen jetzt DEINEN Server auf (Port 8081)
      const url = `/api/tts?text=${encodeURIComponent(testText)}`;

      const audio = new Audio(url);
      audio.play()
              .then(() => console.log("âœ… TTS Sound wird abgespielt!"))
              .catch(e => console.error("âŒ Fehler beim Abspielen:", e));
    }
