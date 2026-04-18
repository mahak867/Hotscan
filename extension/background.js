// HotScan India Chrome Extension — Service Worker (Manifest V3)
// Handles installation and keeps the extension registered.
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    chrome.action.setBadgeText({ text: 'NEW' })
    chrome.action.setBadgeBackgroundColor({ color: '#e63946' })
  }
})
