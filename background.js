'use strict';

const ALARM_NAME = 'kyara-background-wakeup';
const UPDATE_ALARM_NAME = 'kyara-update-check';
const UPDATE_CHECK_INTERVAL_MINUTES = 360;
const UPDATE_NOTIFICATION_ID = 'kyara-update-available';
const UPDATE_REPOSITORY_URL = 'https://github.com/Lioxyze/Extension-Kyara';
const LATEST_MANIFEST_URL = 'https://api.github.com/repos/Lioxyze/Extension-Kyara/contents/manifest.json?ref=main';
const KYARA_URLS = ['https://kyara.games/*', 'https://www.kyara.games/*'];
let ensuringKyaraTab = null;

function compareVersions(first, second) {
  const firstParts = first.split('.').map(Number);
  const secondParts = second.split('.').map(Number);
  for (let index = 0; index < Math.max(firstParts.length, secondParts.length); index += 1) {
    const difference = (firstParts[index] || 0) - (secondParts[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

async function getLatestVersion() {
  const response = await fetch(LATEST_MANIFEST_URL, {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' }
  });
  if (!response.ok) throw new Error(`GitHub a répondu ${response.status}.`);
  const file = await response.json();
  if (typeof file.content !== 'string' || file.encoding !== 'base64') {
    throw new Error('Le manifeste publié sur GitHub est illisible.');
  }
  const manifestBytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), character => character.charCodeAt(0));
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  if (typeof manifest.version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(manifest.version)) {
    throw new Error('La version publiée dans le manifeste est invalide.');
  }
  return manifest.version;
}

async function checkForExtensionUpdate() {
  const latestVersion = await getLatestVersion();
  const installedVersion = chrome.runtime.getManifest().version;
  if (compareVersions(latestVersion, installedVersion) <= 0) {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.notifications.clear(UPDATE_NOTIFICATION_ID);
    await chrome.storage.local.remove('kyaraUpdateNotifiedVersion');
    return;
  }

  await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
  await chrome.action.setBadgeText({ text: 'MAJ' });
  const { kyaraUpdateNotifiedVersion } = await chrome.storage.local.get({
    kyaraUpdateNotifiedVersion: ''
  });
  if (kyaraUpdateNotifiedVersion === latestVersion) return;

  await chrome.notifications.create(UPDATE_NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'icon128.png',
    title: 'Kyara Booster Helper',
    message: `Regarde, la mise à jour ${latestVersion} est disponible !`,
    contextMessage: 'Clique pour consulter le projet sur GitHub.',
    priority: 1
  });
  await chrome.storage.local.set({ kyaraUpdateNotifiedVersion: latestVersion });
}

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
  chrome.alarms.create(UPDATE_ALARM_NAME, { periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES });
  checkForExtensionUpdate().catch(error => {
    console.error('Kyara Booster Helper: unable to check for extension updates', error);
  });
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
  if (alarm.name === UPDATE_ALARM_NAME) {
    try {
      await checkForExtensionUpdate();
    } catch (error) {
      console.error('Kyara Booster Helper: unable to check for extension updates', error);
    }
    return;
  }
  if (alarm.name !== ALARM_NAME) return;
  const { kyaraEnabled = true } = await chrome.storage.local.get({ kyaraEnabled: true });
  if (!kyaraEnabled) return;
  await ensureKyaraTab();
  await wakeKyaraTabs();
});

chrome.notifications.onClicked.addListener(notificationId => {
  if (notificationId !== UPDATE_NOTIFICATION_ID) return;
  chrome.tabs.create({ url: UPDATE_REPOSITORY_URL }).catch(error => {
    console.error('Kyara Booster Helper: unable to open the update page', error);
  });
});
