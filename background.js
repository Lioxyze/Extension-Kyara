'use strict';

const ALARM_NAME = 'kyara-background-wakeup';
const KYARA_URLS = ['https://kyara.games/*', 'https://www.kyara.games/*'];
let ensuringKyaraTab = null;

function ensureKyaraTab() {
  if (!ensuringKyaraTab) {
    ensuringKyaraTab = (async () => {
      const tabs = await chrome.tabs.query({ url: KYARA_URLS });
      if (tabs.length === 0) {
        await chrome.tabs.create({ url: 'https://kyara.games/', active: false });
      }
    })().finally(() => {
      ensuringKyaraTab = null;
    });
  }
  return ensuringKyaraTab;
}

async function wakeTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'KYARA_WAKE' });
  } catch (messageError) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, { type: 'KYARA_WAKE' });
  }
}

async function wakeKyaraTabs() {
  const tabs = await chrome.tabs.query({ url: KYARA_URLS });
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await wakeTab(tab.id);
    } catch (error) {
      console.error(`Kyara Booster Helper: unable to activate the helper in tab ${tab.id}`, error);
    }
  }
}

async function ensureAlarm() {
  const { kyaraEnabled = true } = await chrome.storage.local.get({ kyaraEnabled: true });
  await chrome.alarms.clear(ALARM_NAME);
  if (kyaraEnabled) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
    await ensureKyaraTab();
    await wakeKyaraTabs();
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm().catch(error => console.error('Kyara Booster Helper: initialization failed', error));
});
chrome.runtime.onStartup.addListener(() => {
  ensureAlarm().catch(error => console.error('Kyara Booster Helper: startup failed', error));
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.kyaraEnabled) {
    ensureAlarm().catch(error => console.error('Kyara Booster Helper: settings update failed', error));
  }
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const { kyaraEnabled = true } = await chrome.storage.local.get({ kyaraEnabled: true });
  if (!kyaraEnabled) return;
  await ensureKyaraTab();
  await wakeKyaraTabs();
});
