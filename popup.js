const statusEl = document.getElementById("status");
const toggleBtn = document.getElementById("toggle");
const updateBtn = document.getElementById("update");
const updateStatusEl = document.getElementById("updateStatus");
const keepCopiesInput = document.getElementById("keepCopies");
const pricePercentInput = document.getElementById("pricePercent");
const autoSellInput = document.getElementById("autoSell");
const maxListingsInput = document.getElementById("maxListings");

const LATEST_MANIFEST_URL = "https://api.github.com/repos/Lioxyze/Extension-Kyara/contents/manifest.json?ref=main";

const defaultSettings = {
  kyaraEnabled: true,
  kyaraSellKeepCopies: 1,
  kyaraSellPricePercent: 100,
  kyaraAutoSellEnabled: false,
  kyaraSellMaxPerVisit: 1
};

async function getEnabled() {
  const result = await chrome.storage.local.get({ kyaraEnabled: true });
  return result.kyaraEnabled;
}

async function render() {
  const settings = await chrome.storage.local.get(defaultSettings);
  statusEl.textContent = settings.kyaraEnabled ? "Assistant activé" : "Assistant arrêté";
  toggleBtn.textContent = settings.kyaraEnabled
    ? "Arrêter les ouvertures gratuites"
    : "Activer les ouvertures gratuites";
  keepCopiesInput.value = settings.kyaraSellKeepCopies;
  pricePercentInput.value = settings.kyaraSellPricePercent;
  autoSellInput.checked = settings.kyaraAutoSellEnabled;
  maxListingsInput.value = settings.kyaraSellMaxPerVisit;
}

toggleBtn.addEventListener("click", async () => {
  const enabled = await getEnabled();
  await chrome.storage.local.set({ kyaraEnabled: !enabled });
  await render();
});

async function saveSaleSettings() {
  const keepCopies = Number(keepCopiesInput.value);
  const pricePercent = Number(pricePercentInput.value);
  const maxPerVisit = Number(maxListingsInput.value);
  if (!Number.isInteger(keepCopies) || keepCopies < 0 || keepCopies > 99 ||
    !Number.isInteger(pricePercent) || pricePercent < 50 || pricePercent > 200 ||
    !Number.isInteger(maxPerVisit) || maxPerVisit < 1 || maxPerVisit > 10) {
    statusEl.textContent = "Réglages invalides : vérifie les limites affichées.";
    return;
  }
  await chrome.storage.local.set({
    kyaraSellKeepCopies: keepCopies,
    kyaraSellPricePercent: pricePercent,
    kyaraAutoSellEnabled: autoSellInput.checked,
    kyaraSellMaxPerVisit: maxPerVisit
  });
  statusEl.textContent = autoSellInput.checked
    ? "Réglages enregistrés · vente automatique activée"
    : "Réglages enregistrés · vente automatique désactivée";
}

for (const input of [keepCopiesInput, pricePercentInput, autoSellInput, maxListingsInput]) {
  input.addEventListener("change", () => {
    saveSaleSettings().catch(error => {
      console.error("Kyara Booster Helper: unable to save sale settings", error);
      statusEl.textContent = "Impossible d’enregistrer les réglages de vente.";
    });
  });
}

document.getElementById("open").addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ url: ["https://kyara.games/*", "https://www.kyara.games/*"] });
  if (tabs.length) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId !== undefined) await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: "https://kyara.games/" });
  }
});

function compareVersions(first, second) {
  const firstParts = first.split(".").map(Number);
  const secondParts = second.split(".").map(Number);
  for (let index = 0; index < Math.max(firstParts.length, secondParts.length); index += 1) {
    const difference = (firstParts[index] || 0) - (secondParts[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

async function checkForUpdate() {
  updateBtn.hidden = true;
  updateStatusEl.textContent = "Vérification des mises à jour…";
  try {
    const installedVersion = chrome.runtime.getManifest().version;
    const diskResponse = await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" });
    if (!diskResponse.ok) throw new Error("Le manifeste local de l’extension est illisible.");
    const diskManifest = await diskResponse.json();
    if (typeof diskManifest.version !== "string" || !/^\d+(?:\.\d+){0,3}$/.test(diskManifest.version)) {
      throw new Error("La version locale de l’extension est invalide.");
    }

    if (compareVersions(diskManifest.version, installedVersion) > 0) {
      updateBtn.textContent = `Activer la mise à jour · ${diskManifest.version}`;
      updateBtn.hidden = false;
      updateStatusEl.textContent =
        `👀 Regarde, la mise à jour ${diskManifest.version} est prête ! Clique pour l’activer.`;
      return;
    }

    const response = await fetch(LATEST_MANIFEST_URL, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) throw new Error(`GitHub a répondu ${response.status}.`);
    const file = await response.json();
    if (typeof file.content !== "string" || file.encoding !== "base64") {
      throw new Error("Le manifeste publié sur GitHub est illisible.");
    }
    const manifestBytes = Uint8Array.from(atob(file.content.replace(/\s/g, "")), character => character.charCodeAt(0));
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    if (typeof manifest.version !== "string" || !/^\d+(?:\.\d+){0,3}$/.test(manifest.version)) {
      throw new Error("La version publiée dans le manifeste est invalide.");
    }

    if (compareVersions(manifest.version, diskManifest.version) > 0) {
      updateStatusEl.textContent =
        `Mise à jour ${manifest.version} disponible ; téléchargement automatique programmé.`;
      return;
    }
    updateStatusEl.textContent = `✓ Extension à jour · version ${installedVersion}`;
  } catch (error) {
    console.error("Kyara Booster Helper: unable to check for updates", error);
    updateStatusEl.textContent = "Vérification impossible. Lance l’installateur Windows pour activer les mises à jour automatiques.";
  }
}

updateBtn.addEventListener("click", async () => {
  updateBtn.disabled = true;
  updateStatusEl.textContent = "Activation de la mise à jour…";
  try {
    const tabs = await chrome.tabs.query({
      url: ["https://kyara.games/*", "https://www.kyara.games/*"]
    });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "KYARA_RELOAD_AFTER_UPDATE" });
      } catch (error) {
        console.warn(`Kyara Booster Helper: could not schedule page refresh for tab ${tab.id}`, error);
      }
    }
    chrome.runtime.reload();
  } catch (error) {
    console.error("Kyara Booster Helper: unable to activate the update", error);
    updateBtn.disabled = false;
    updateStatusEl.textContent = "Impossible d’activer la mise à jour. Réessaie depuis le popup de l’extension.";
  }
});

render();
checkForUpdate();