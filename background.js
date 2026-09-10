// Open the side panel when the toolbar icon is clicked. The side panel hosts
// the Prisme.ai embed iframe and bridges the current page's context to it.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[prisme-ext] sidePanel behavior:', err));
