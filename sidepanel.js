// Thin shell: the side panel IS the Prisme.ai chat (loaded in an iframe from
// the instance's /embed/chat). The extension's only job is to keep the agent's
// context in sync with the page you're looking at — so you just type any
// question in the chat ("summarize", "translate", "what is this about?",
// "explain this selection") and the agent already knows the page.
const LOADER_SOURCE = 'prisme-embed'; // loader → iframe
const FRAME_SOURCE = 'prisme-embed-frame'; // iframe → loader

const $ = (id) => document.getElementById(id);
const els = {
  config: $('config'),
  frame: $('frame'),
  gear: $('gear'),
  newchat: $('newchat'),
  instance: $('cfg-instance'),
  api: $('cfg-api'),
  agent: $('cfg-agent'),
  org: $('cfg-org'),
  browserTools: $('cfg-browser-tools'),
  connect: $('connect'),
};

// Agents all live in the shared agent-factory workspace, so the slug is fixed
// and not exposed in the UI.
const WORKSPACE_SLUG = 'slug:agent-factory';

// Icons matching the Prisme.ai platform codebase (lucide: PenSquare / SlidersHorizontal).
els.newchat.innerHTML =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>';
// Classic gear (lucide Settings) — deliberately NOT SlidersHorizontal, which
// the embed chat uses for the agent's tools picker.
els.gear.innerHTML =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

let cfg = null;
let frameOrigin = null;
let frameReady = false;
let lastContext = null;
let agentName = null;

const DEFAULTS = {
  instance: 'http://studio.local.prisme.ai:3000',
  api: 'https://api.sandbox.prisme.ai/v2',
  agent: '',
  org: '',
  // Plan Action: workspace exposing the browser.* tool-calls. Left blank →
  // the extension is a plain page-context chat (no tool execution).
  browserTools: 'slug:browser-mcp',
};

// Config precedence: managed policy (enterprise, chrome.storage.managed) wins
// over the user's saved config, which wins over defaults. Managed keys mirror
// schema.json (instance/api/agent/org/toolsWorkspace); toolsWorkspace maps to
// the internal `browserTools` field.
chrome.storage.managed.get(null, (managed) => {
  const m = managed || {};
  chrome.storage.local.get('prisme-embed-cfg', ({ 'prisme-embed-cfg': saved }) => {
    const c = { ...DEFAULTS, ...(saved || {}) };
    if (m.instance) c.instance = m.instance;
    if (m.api) c.api = m.api;
    if (m.agent) c.agent = m.agent;
    if (m.org) c.org = m.org;
    if (m.toolsWorkspace) c.browserTools = m.toolsWorkspace;
    els.instance.value = c.instance;
    els.api.value = c.api;
    els.agent.value = c.agent;
    els.org.value = c.org;
    els.browserTools.value = c.browserTools;
    // Auto-connect when managed policy supplies an agent, or the user saved one.
    if (c.agent && (m.agent || (saved && saved.agent))) connect();
  });
});

function readForm() {
  return {
    instance: els.instance.value.trim().replace(/\/+$/, ''),
    api: els.api.value.trim(),
    agent: els.agent.value.trim(),
    org: els.org.value.trim(),
    browserTools: els.browserTools.value.trim(),
  };
}

function connect() {
  cfg = readForm();
  if (!cfg.instance || !cfg.agent) {
    alert('Platform URL and Agent ID are required.');
    return;
  }
  chrome.storage.local.set({ 'prisme-embed-cfg': cfg });
  try {
    frameOrigin = new URL(cfg.instance).origin;
  } catch {
    alert('Invalid instance URL.');
    return;
  }
  loadChat();
  els.config.classList.add('hidden');
  els.frame.classList.remove('hidden');
  els.gear.classList.remove('hidden');
  els.newchat.classList.remove('hidden');
}

// (Re)load the embed → a fresh conversation.
function loadChat() {
  frameReady = false;
  els.frame.src = cfg.instance + '/embed/chat?t=' + Date.now();
}

function postToFrame(message) {
  if (els.frame.contentWindow && frameOrigin) {
    els.frame.contentWindow.postMessage({ source: LOADER_SOURCE, ...message }, frameOrigin);
  }
}

function sendConfig() {
  postToFrame({
    type: 'config',
    config: {
      workspaceSlug: WORKSPACE_SLUG,
      agentId: cfg.agent,
      apiUrl: cfg.api,
      auth: 'anonymous',
      orgSlug: cfg.org || undefined,
      theme: 'light',
      features: {
        enableFiles: true,
        enableFeedback: true,
        enableToolCalls: true,
        enableArtifacts: true,
        // Voice-to-voice is not ready yet → keep only speech-to-text (dictation).
        enableVoice: false,
        enableSpeechToText: true,
      },
      context: lastContext || undefined,
      // When set, the iframe opens the workspace's tool.exec.* stream and
      // relays execution back here (handleToolExec). The workspace is
      // browser-mcp here, but the embed contract is domain-agnostic.
      toolsWorkspace: cfg.browserTools || undefined,
    },
  });
}

// Push the current page context to the chat. It rides along with every message
// the user sends (parts[].metadata.contextSnippet), so no special UI is needed.
function syncContext(ctx) {
  lastContext = ctx || lastContext;
  if (frameReady && lastContext) postToFrame({ type: 'setContext', context: lastContext });
}

// From the iframe: it's ready to receive config.
window.addEventListener('message', (event) => {
  if (event.origin !== frameOrigin) return;
  const data = event.data;
  if (!data || data.source !== FRAME_SOURCE) return;
  if (data.type === 'ready') {
    frameReady = true;
    sendConfig();
    requestActiveTabContext(); // prime immediately
  } else if (data.type === 'event' && data.name === 'agent' && data.data && data.data.name) {
    agentName = data.data.name; // label for the page-selection "Ask {agent}" pill
    pushAgentName();
  } else if (data.type === 'tool-exec') {
    // The embed relayed a tool.exec.request from the agent's run (received on
    // its session event stream). Execute it here and return the result.
    handleToolExec(data);
  }
});

// Execute a browser tool: screenshot in the side panel (captureVisibleTab),
// everything else in the active tab's content script. Reply via postMessage.
// Contract (MCP-aligned): correlate by correlationId, and return `result`
// (text/JSON) or `content` (native MCP parts) XOR `error: {code, message}` —
// no `ok` flag. `contextId` (conversation) is reserved for multi-tab targeting;
// today we act on the active tab.
function handleToolExec({ correlationId, name, args }) {
  const reply = (payload) => postToFrame(Object.assign({ type: 'tool-result', correlationId }, payload));
  const fail = (message, code) => reply({ error: { code: code || 1, message: String(message) } });
  if (name === 'browser_screenshot') {
    chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) return fail(chrome.runtime.lastError.message);
      if (!dataUrl) return fail('capture returned no image');
      // Hand the raw data URL to the iframe for upload to Storage — never push
      // the base64 over the event bus (payload-size cap + persisted in ES).
      reply({
        upload: {
          dataUrl,
          mimeType: 'image/png',
          filename: `screenshot-${correlationId}.png`,
        },
      });
    });
    return;
  }
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return fail('no active tab');
    const onRes = (res) => {
      if (!res) return fail('no result');
      // content↔sidepanel messaging uses an internal ok flag; translate it to
      // the event-bus contract (result XOR error).
      if (res.ok) reply({ result: res.result });
      else fail(res.error || 'tool failed');
    };
    const send = () =>
      chrome.tabs.sendMessage(tab.id, { type: 'prisme-exec', tool: name, args }, (res) => {
        if (!chrome.runtime.lastError) return onRes(res);
        // Content script absent (tab opened before the extension loaded, or it
        // was never injected). Inject it once, then retry the call.
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }, () => {
          if (chrome.runtime.lastError) return fail(chrome.runtime.lastError.message);
          chrome.tabs.sendMessage(tab.id, { type: 'prisme-exec', tool: name, args }, (res2) => {
            if (chrome.runtime.lastError) return fail(chrome.runtime.lastError.message);
            onRes(res2);
          });
        });
      });
    send();
  });
}

// Tell the active tab's content script the agent name (for the selection pill).
function pushAgentName() {
  if (!agentName) return;
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (tab && tab.id != null) {
      chrome.tabs.sendMessage(tab.id, { type: 'prisme-agent-name', name: agentName }).catch(() => {});
    }
  });
}

// Live updates from the page.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg) return;
  if (msg.type === 'prisme-page-context') {
    syncContext(msg.context); // ambient page → attached to every message
    // A live content script is on this tab → make sure it has the agent name.
    if (agentName && sender.tab && sender.tab.id != null) {
      chrome.tabs.sendMessage(sender.tab.id, { type: 'prisme-agent-name', name: agentName }).catch(() => {});
    }
  } else if (msg.type === 'prisme-page-selection') {
    // page selection → quoted into the composer (like "Ask {agent}")
    if (frameReady) postToFrame({ type: 'setQuote', text: msg.text || null });
  }
});

// Ask the active tab for its context once, right after connecting.
function requestActiveTabContext() {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return;
    chrome.tabs.sendMessage(tab.id, { type: 'prisme-request-context' }, (ctx) => {
      if (chrome.runtime.lastError) return; // no content script (e.g. chrome:// page or page not reloaded)
      if (ctx) syncContext(ctx);
    });
  });
}

els.connect.addEventListener('click', connect);
els.newchat.addEventListener('click', () => {
  loadChat(); // reload the iframe → new conversation (config re-posted on ready)
});
els.gear.addEventListener('click', () => {
  els.config.classList.remove('hidden');
  els.frame.classList.add('hidden');
  els.gear.classList.add('hidden');
  els.newchat.classList.add('hidden');
});
