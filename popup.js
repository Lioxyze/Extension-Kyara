const statusEl = document.getElementById("status");
const toggleBtn = document.getElementById("toggle");
const keepCopiesInput = document.getElementById("keepCopies");
const pricePercentInput = document.getElementById("pricePercent");
const autoSellInput = document.getElementById("autoSell");
const maxListingsInput = document.getElementById("maxListings");

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
  toggleBtn.textContent = settings.kyaraEnabled ? "Arrêter l'assistant" : "Activer l'assistant";
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

document.getElementById("update").addEventListener("click", () => {
  statusEl.textContent = "Recherche d’une mise à jour…";
  chrome.runtime.requestUpdateCheck((status) => {
    const error = chrome.runtime.lastError;
    if (error) {
      statusEl.textContent = `Mise à jour automatique impossible : ${error.message}. Pour une extension locale, remplace les fichiers puis clique sur « Recharger » dans chrome://extensions.`;
      return;
    }

    if (status === "update_available") {
      statusEl.textContent = "Mise à jour trouvée. Le navigateur va l’installer.";
    } else if (status === "no_update") {
      statusEl.textContent = "L’extension est déjà à jour.";
    } else if (status === "throttled") {
      statusEl.textContent = "Vérification déjà effectuée récemment. Réessaie plus tard.";
    } else {
      statusEl.textContent = `Résultat de la vérification : ${status}`;
    }
  });
});

render();