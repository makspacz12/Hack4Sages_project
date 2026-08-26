/**
 * rConsole.js
 * Mini R interpreter panel — bottom-left corner.
 *
 * Uses WebR (R compiled to WebAssembly) loaded lazily from CDN.
 * No server required — R runs entirely in the browser.
 *
 * Interaction:
 *   - Shows a rendered plot in a small canvas.
 *   - Double-click anywhere on the panel to open the code editor.
 *   - Ctrl+Enter or the "Uruchom" button re-executes the code.
 *   - Esc / "Anuluj" closes the editor without running.
 */

// ── Styles ───────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('r-console-style')) return;
  const s = document.createElement('style');
  s.id = 'r-console-style';
  s.textContent = `
    #r-panel {
      position: fixed;
      bottom: 72px;          /* sit above replay bar */
      left: 14px;
      width: 300px;
      background: rgba(8, 10, 20, 0.92);
      border: 1px solid #1e2e4a;
      border-radius: 10px;
      font-family: monospace;
      font-size: 12px;
      color: #ccd;
      z-index: 850;
      box-shadow: 0 4px 24px rgba(0,0,0,.55);
      overflow: hidden;
      user-select: none;
    }

    /* ── header ───────────────────────────────────── */
    #r-panel .rp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 10px 5px;
      background: rgba(0,20,50,.55);
      border-bottom: 1px solid #1e2e4a;
      cursor: default;
    }
    #r-panel .rp-title {
      font-weight: bold; color: #6cf; letter-spacing: .05em; font-size: 12px;
    }
    #r-panel .rp-hint {
      font-size: 10px; color: #446; margin-left: 6px;
    }
    #r-panel .rp-toggle {
      background: none; border: none; color: #446; cursor: pointer;
      font-size: 14px; padding: 0 2px; line-height: 1;
    }
    #r-panel .rp-toggle:hover { color: #aac; }

    /* ── canvas area ──────────────────────────────── */
    #r-panel .rp-canvas-wrap {
      position: relative; display: flex;
      align-items: center; justify-content: center;
      background: #fff;
      cursor: pointer;
    }
    #r-panel canvas.rp-canvas { display: block; }
    #r-panel .rp-overlay {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(5,8,20,.82);
      color: #6af; font-size: 12px; gap: 8px; text-align: center; padding: 10px;
    }
    #r-panel .rp-spinner {
      width: 22px; height: 22px;
      border: 3px solid #1a3060;
      border-top-color: #5af;
      border-radius: 50%;
      animation: rp-spin .8s linear infinite;
    }
    @keyframes rp-spin { to { transform: rotate(360deg); } }

    /* ── editor overlay ───────────────────────────── */
    #r-panel .rp-editor {
      display: none;
      flex-direction: column;
      background: rgba(5,8,18,.97);
      padding: 8px;
      border-top: 1px solid #1e2e4a;
    }
    #r-panel .rp-editor.open { display: flex; }
    #r-panel .rp-editor textarea {
      width: 100%; height: 120px; resize: vertical;
      background: #0a0e1a; color: #bdf;
      border: 1px solid #2a3860; border-radius: 5px;
      padding: 6px 8px; font-family: monospace; font-size: 12px;
      line-height: 1.5; outline: none; box-sizing: border-box;
    }
    #r-panel .rp-editor textarea:focus { border-color: #4a7fd0; }
    #r-panel .rp-editor .rp-btn-row {
      display: flex; gap: 6px; margin-top: 6px; justify-content: flex-end;
    }
    #r-panel .rp-editor button {
      padding: 3px 12px; border-radius: 4px; cursor: pointer;
      font-family: monospace; font-size: 12px; border: 1px solid #3a4860;
    }
    #r-panel .rp-run { background: #0e2a50; color: #7cf; }
    #r-panel .rp-run:hover { background: #153a70; }
    #r-panel .rp-cancel { background: #111; color: #778; }
    #r-panel .rp-cancel:hover { background: #1a1a2a; }

    /* ── status bar ───────────────────────────────── */
    #r-panel .rp-status {
      padding: 3px 10px; font-size: 10px; color: #446;
      border-top: 1px solid #141e30; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    #r-panel .rp-status.err  { color: #e66; }
    #r-panel .rp-status.ok   { color: #4a8; }
    #r-panel .rp-status.busy { color: #6af; }
  `;
  document.head.appendChild(s);
}

// ── Default R code ────────────────────────────────────────────────────────
const DEFAULT_CODE = `# Wykres sin(x)
x <- seq(0, 2 * pi, length.out = 200)
plot(x, sin(x),
     type = "l", lwd = 2,
     col  = "steelblue",
     main = "sin(x)",
     xlab = "x", ylab = "y")
abline(h = 0, col = "gray60", lty = 2)`;

// ── WebR loader (lazy, singleton) ─────────────────────────────────────────
let _webr    = null;
let _shelter = null;

async function getWebR() {
  if (_webr) return _webr;
  const { WebR } = await import('https://webr.r-wasm.org/v0.4.2/webr.mjs');
  _webr = new WebR({ baseUrl: 'https://webr.r-wasm.org/v0.4.2/' });
  await _webr.init();
  _shelter = await new _webr.Shelter();
  return _webr;
}

async function getShelter() {
  await getWebR();
  return _shelter;
}

// ── Plot executor ─────────────────────────────────────────────────────────
/**
 * Run R code capturing plots via shelter.captureR() — the official WebR API.
 * captureR uses webr::canvas() internally and returns ImageBitmap objects
 * directly, with no filesystem access required.
 *
 * @param {string} code
 * @param {number} width   CSS pixel width of the display canvas
 * @param {number} height  CSS pixel height of the display canvas
 * @returns {Promise<{ images: ImageBitmap[], text: string }>}
 */
async function runRCode(code, width, height) {
  const shelter = await getShelter();

  // captureR wraps execution in tryCatch, routes stdout/stderr to output[],
  // and returns all plots produced by webr::canvas() as ImageBitmap objects.
  const capture = await shelter.captureR(code, {
    captureGraphics: {
      width,
      height,
      bg: 'white',
    },
  });

  const text = (capture.output ?? [])
    .filter(m => m.type === 'stdout' || m.type === 'stderr' || m.type === 'message')
    .map(m => String(m.data))
    .join('\n')
    .trim();

  return { images: capture.images ?? [], text };
}

// ── Public API ────────────────────────────────────────────────────────────
/**
 * Create and mount the R console panel.
 * @returns {{ mount: () => void, destroy: () => void }}
 */
export function createRConsole() {
  injectStyles();

  const CANVAS_W = 298;   // px
  const CANVAS_H = 200;

  let currentCode  = DEFAULT_CODE;
  let editorOpen   = false;

  // ── Build DOM ─────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'r-panel';

  // header
  const header = document.createElement('div');
  header.className = 'rp-header';
  header.innerHTML = `
    <span>
      <span class="rp-title">R</span>
      <span class="rp-hint">dwuklik = edytuj</span>
    </span>`;

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'rp-toggle';
  toggleBtn.title     = 'Minimalizuj';
  toggleBtn.textContent = '−';
  header.appendChild(toggleBtn);

  // canvas area
  const canvasWrap = document.createElement('div');
  canvasWrap.className  = 'rp-canvas-wrap';
  canvasWrap.title      = 'Double-click to edit code';

  const canvas = document.createElement('canvas');
  canvas.className = 'rp-canvas';
  canvas.width     = CANVAS_W;
  canvas.height    = CANVAS_H;
  canvas.style.width  = `${CANVAS_W}px`;
  canvas.style.height = `${CANVAS_H}px`;

  const overlay = document.createElement('div');
  overlay.className = 'rp-overlay';
  overlay.innerHTML = `<div class="rp-spinner"></div><span>Loading WebR…</span>`;

  canvasWrap.append(canvas, overlay);

  // editor
  const editor = document.createElement('div');
  editor.className = 'rp-editor';
  const textarea = document.createElement('textarea');
  textarea.value = currentCode;
  textarea.spellcheck = false;
  const btnRow = document.createElement('div');
  btnRow.className = 'rp-btn-row';
  const btnRun    = document.createElement('button');
  btnRun.className    = 'rp-run';
  btnRun.textContent  = '▶ Run';
  btnRun.title        = 'Ctrl+Enter';
  const btnCancel = document.createElement('button');
  btnCancel.className   = 'rp-cancel';
  btnCancel.textContent = 'Cancel';
  btnRow.append(btnRun, btnCancel);
  editor.append(textarea, btnRow);

  // status bar
  const statusBar = document.createElement('div');
  statusBar.className   = 'rp-status';
  statusBar.textContent = 'Initialising WebR…';

  panel.append(header, canvasWrap, editor, statusBar);

  // ── Helpers ───────────────────────────────────────────────────────────
  let minimized = false;

  function setStatus(msg, cls = '') {
    statusBar.className   = 'rp-status ' + cls;
    statusBar.textContent = msg;
  }

  function openEditor() {
    editorOpen = true;
    textarea.value = currentCode;
    editor.classList.add('open');
    setTimeout(() => textarea.focus(), 30);
  }

  function closeEditor() {
    editorOpen = false;
    editor.classList.remove('open');
  }

  async function execute(code) {
    closeEditor();
    currentCode = code;
    overlay.style.display    = 'flex';
    overlay.innerHTML = `<div class="rp-spinner"></div><span>Computing…</span>`;
    setStatus('Running…', 'busy');

    try {
      const result = await runRCode(code, CANVAS_W, CANVAS_H);

      if (result.images && result.images.length > 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        // Draw the last (or only) plot; captureR uses 2x device scale, drawImage handles resize
        const img = result.images[result.images.length - 1];
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        overlay.style.display = 'none';
        const errText = result.text.includes('Error') ? result.text : '';
        setStatus(errText || '✓ OK', errText ? 'err' : 'ok');
      } else {
        // No plot — show text output
        overlay.style.display = 'flex';
        const msg = result.text || '(no plot — no output)';
        overlay.innerHTML = `<pre style="color:#bdf;font-size:11px;white-space:pre-wrap;text-align:left;max-height:${CANVAS_H - 20}px;overflow:auto">${escHtml(msg)}</pre>`;
        setStatus(result.text ? 'Text output' : 'No plot', result.text ? '' : 'err');
      }
    } catch (err) {
      overlay.style.display = 'flex';
      overlay.innerHTML = `<span style="color:#e66;padding:8px">${escHtml(String(err.message ?? err))}</span>`;
      setStatus(String(err.message ?? err).slice(0, 100), 'err');
    }
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Events ─────────────────────────────────────────────────────────────
  // Double-click on canvas → open editor
  canvasWrap.addEventListener('dblclick', openEditor);

  // Run button
  btnRun.addEventListener('click', () => execute(textarea.value));

  // Cancel button
  btnCancel.addEventListener('click', closeEditor);

  // Ctrl+Enter in textarea → run
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      execute(textarea.value);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeEditor();
    }
    e.stopPropagation();   // don't trigger global replay shortcuts
  });

  // Minimize toggle
  toggleBtn.addEventListener('click', () => {
    minimized = !minimized;
    canvasWrap.style.display = minimized ? 'none' : '';
    editor.style.display     = minimized ? 'none' : '';
    statusBar.style.display  = minimized ? 'none' : '';
    toggleBtn.textContent    = minimized ? '+' : '−';
    toggleBtn.title          = minimized ? 'Expand' : 'Minimise';
    if (minimized) closeEditor();
  });

  // ── Boot WebR and run default code ─────────────────────────────────────
  async function boot() {
    try {
      setStatus('Loading WebR (R/WASM)…', 'busy');
      await getWebR();
      setStatus('Running default code…', 'busy');
      await execute(DEFAULT_CODE);
    } catch (err) {
      overlay.style.display = 'flex';
      overlay.innerHTML = `<span style="color:#e66">WebR error:<br>${escHtml(String(err.message ?? err))}</span>`;
      setStatus('WebR init error', 'err');
    }
  }

  // ── Mount ──────────────────────────────────────────────────────────────
  function mount() {
    document.body.appendChild(panel);
    boot();
  }

  function destroy() {
    panel.remove();
  }

  return { mount, destroy };
}
