// Runs in every page. Two jobs:
//  1. ambient page context (title / url / readable text) → attached to every
//     message, so the agent always knows the page.
//  2. a floating "Ask {agent}" pill on text selection — same behaviour & look
//     as the in-chat selection button — that quotes the selection into the
//     composer (via the side panel → embed setQuote tunnel).

// ── Ambient page context ────────────────────────────────────────────────────
// Readability-lite: prefer the main article container and strip chrome
// (nav / aside / footer / scripts) so the agent gets clean article text rather
// than the whole noisy page. Falls back to the body. (A future build step can
// swap this for @mozilla/readability; audit use-cases — raw HTML / screenshot —
// will come via the tool-calls channel.)
function readableText() {
  // Read innerText of the LIVE main element (article/main/[role=main]) — this is
  // rendered so innerText is correct, and those containers already exclude most
  // nav/footer chrome. NB: do NOT cloneNode — innerText on a detached node is
  // empty (no layout), which silently dropped the page context.
  const root = document.querySelector('article, main, [role="main"]') || document.body;
  const text = ((root && root.innerText) || '').replace(/\n{3,}/g, '\n\n').trim();
  // Fallback for SPAs / unusual markup where the main container is thin.
  if (text.length < 200 && document.body) {
    return (document.body.innerText || '').trim();
  }
  return text;
}

function collectPage() {
  return {
    title: document.title,
    url: location.href,
    content: readableText().slice(0, 8000),
  };
}
let pageTimer;
function pushPage() {
  if (document.visibilityState !== 'visible') return;
  clearTimeout(pageTimer);
  pageTimer = setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'prisme-page-context', context: collectPage() }).catch(() => {});
  }, 300);
}

// ── Floating "Ask {agent}" pill (mirrors AskAgentButton.tsx) ─────────────────
let agentName = 'the agent';
let btn = null;

// MessageSquareQuote-ish icon, matching the in-chat button.
const ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto">' +
  '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

function ensureButton() {
  if (btn) return btn;
  btn = document.createElement('button');
  btn.type = 'button';
  Object.assign(btn.style, {
    position: 'fixed',
    zIndex: '2147483646',
    display: 'none',
    alignItems: 'center',
    gap: '6px',
    padding: '0 12px',
    height: '32px',
    borderRadius: '9999px',
    background: '#0a0a0a',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,.25)',
    font: '500 12px system-ui, -apple-system, sans-serif',
    lineHeight: '32px',
  });
  // mousedown (not click): read the selection BEFORE it is cleared.
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = String(window.getSelection() || '').trim();
    if (text) chrome.runtime.sendMessage({ type: 'prisme-page-selection', text }).catch(() => {});
    hideButton();
  });
  (document.body || document.documentElement).appendChild(btn);
  return btn;
}

function hideButton() {
  if (btn) btn.style.display = 'none';
}

function showButtonForSelection() {
  const sel = window.getSelection();
  const text = sel ? String(sel).trim() : '';
  if (!text || !sel.rangeCount) return hideButton();
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return hideButton();

  const b = ensureButton();
  b.innerHTML = ICON + '<span></span>';
  b.querySelector('span').textContent = 'Ask ' + agentName;
  b.style.display = 'inline-flex';

  const H = 32;
  const GAP = 8;
  const wantedTop = rect.top - H - GAP;
  b.style.top = (wantedTop < 8 ? rect.bottom + GAP : wantedTop) + 'px';
  b.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 200)) + 'px';
}

let selTimer;
document.addEventListener('selectionchange', () => {
  if (document.visibilityState !== 'visible') return;
  clearTimeout(selTimer);
  selTimer = setTimeout(showButtonForSelection, 150);
});
document.addEventListener('scroll', hideButton, true);
window.addEventListener('resize', hideButton);

// ── Messages from the side panel ────────────────────────────────────────────
// ── Action executor (Plan Action / tool-calls) ─────────────────────────────
// The agent (server) calls browser.* tools on the browser-mcp workspace; those
// relay to us (see design/browser-extension/tool-calls.md). We resolve elements
// by a stable index built by `snapshot` — never fragile CSS selectors.
let a11yRefs = []; // index → element, rebuilt on each snapshot

function isInteractive(el) {
  if (!el || el.disabled) return false;
  const tag = el.tagName;
  if (tag === 'A' && el.href) return true;
  if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return true;
  const role = el.getAttribute && el.getAttribute('role');
  if (role && ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio'].includes(role)) return true;
  return false;
}
function visible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function labelOf(el) {
  return (
    (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('placeholder'))) ||
    (el.innerText || el.value || el.getAttribute?.('title') || '')
  )
    .trim()
    .slice(0, 120);
}
function snapshot() {
  a11yRefs = [];
  const out = [];
  document.querySelectorAll('a,button,input,select,textarea,[role]').forEach((el) => {
    if (!isInteractive(el) || !visible(el)) return;
    const ref = a11yRefs.length;
    a11yRefs.push(el);
    out.push({ ref, role: (el.getAttribute('role') || el.tagName).toLowerCase(), name: labelOf(el) });
  });
  return { title: document.title, url: location.href, elements: out };
}
function elByRef(ref) {
  const el = a11yRefs[ref];
  if (!el || !el.isConnected) throw new Error('stale ref ' + ref + ' — call snapshot again');
  return el;
}
function execTool(tool, args) {
  args = args || {};
  switch (tool) {
    case 'browser_snapshot':
      return snapshot();
    case 'browser_read':
      return { title: document.title, url: location.href, content: args.mode === 'html' ? document.documentElement.outerHTML.slice(0, 20000) : readableText().slice(0, 12000) };
    case 'browser_click': {
      const el = elByRef(args.ref);
      el.scrollIntoView({ block: 'center' });
      el.click();
      return { ok: true };
    }
    case 'browser_fill': {
      const el = elByRef(args.ref);
      el.focus();
      el.value = args.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    }
    case 'browser_select': {
      const el = elByRef(args.ref);
      el.value = args.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    }
    case 'browser_navigate':
      location.assign(args.url);
      return { ok: true, url: args.url };
    default:
      throw new Error('unknown tool ' + tool);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'prisme-request-context') {
    sendResponse(collectPage());
    return true;
  }
  if (msg && msg.type === 'prisme-agent-name' && msg.name) {
    agentName = msg.name;
  }
  // Execute a browser tool in the page (screenshot is handled in the side panel).
  if (msg && msg.type === 'prisme-exec') {
    try {
      sendResponse({ ok: true, result: execTool(msg.tool, msg.args) });
    } catch (err) {
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    }
    return true;
  }
});

document.addEventListener('visibilitychange', pushPage);
pushPage();
