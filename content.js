(() => {
  'use strict';
  if (window.__kyaraBoosterHelperInstalled) return;
  window.__kyaraBoosterHelperInstalled = true;

  const CHECK_MS = 900;
  const IDLE_MS = 5000;
  const ACTION_WAIT_MS = 1400;
  let busy = false;
  let timer = null;
  let lastClickAt = 0;
  let enabled = true;
  let tradeBalancing = false;

  const panel = document.createElement('aside');
  panel.id = 'kyara-helper-panel';
  panel.style.cssText = [
    'position:fixed','right:16px','bottom:16px','z-index:2147483647',
    'width:245px','padding:13px','background:#171717','color:#fff',
    'border:1px solid #f59e0b','border-radius:12px','box-shadow:0 5px 24px #0009',
    'font:14px Arial,sans-serif'
  ].join(';');
  panel.innerHTML = `
    <div style="font-size:16px;font-weight:bold">Kyara Booster Helper</div>
    <div id="kh-status" style="color:#fbbf24;margin:10px 0">Initialisation…</div>
    <button id="kh-auctions" style="display:none;width:100%;padding:8px;margin-bottom:8px;border:1px solid #34d399;border-radius:7px;background:#064e3b;color:#d1fae5;font-weight:bold;cursor:pointer">Voir mes enchères</button>
    <button id="kh-toggle" style="width:100%;padding:9px;border:0;border-radius:7px;background:#f59e0b;color:#111;font-weight:bold;cursor:pointer">Arrêter les ouvertures gratuites</button>
    <div style="font-size:11px;color:#aaa;margin-top:8px">Gratuit uniquement · veille arrière-plan</div>`;
  (document.documentElement || document.body).appendChild(panel);

  const statusEl = panel.querySelector('#kh-status');
  const toggleBtn = panel.querySelector('#kh-toggle');
  const auctionsBtn = panel.querySelector('#kh-auctions');
  auctionsBtn.addEventListener('click', () => {
    location.assign(`${location.origin}/marche?onglet=mises`);
  });
  function say(text) { statusEl.textContent = text; }
  function visible(el) {
    if (!el || !el.isConnected || !el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }
  function candidates() {
    return [...document.querySelectorAll('button,a,[role="button"],[role="link"], [tabindex="0"]')]
      .filter(el => !panel.contains(el) && visible(el))
      .map(el => ({ el, text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() }));
  }
  function find(predicate) { return candidates().find(x => predicate(x.text, x.el))?.el || null; }
  function schedule(ms = CHECK_MS) {
    clearTimeout(timer);
    if (enabled) timer = setTimeout(tick, ms);
  }
  function updateToggle() {
    toggleBtn.textContent = enabled
      ? 'Arrêter les ouvertures gratuites'
      : 'Activer les ouvertures gratuites';
  }
  async function loadSetting() {
    try { const data = await chrome.storage.local.get({ kyaraEnabled: true }); enabled = !!data.kyaraEnabled; }
    catch (_) { enabled = true; }
    updateToggle();
    if (enabled) schedule(250); else say('Assistant arrêté');
  }
  toggleBtn.addEventListener('click', async () => {
    enabled = !enabled;
    try { await chrome.storage.local.set({ kyaraEnabled: enabled }); } catch (_) {}
    updateToggle();
    if (enabled) { say('Assistant activé'); schedule(100); }
    else { clearTimeout(timer); say('Assistant arrêté'); }
  });

  function clickSafely(el, message, wait = ACTION_WAIT_MS) {
    if (!enabled || !el || !visible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    if (Date.now() - lastClickAt < 1200) return false;
    lastClickAt = Date.now(); busy = true; say(message);
    el.click();
    setTimeout(() => { busy = false; schedule(250); }, wait);
    return true;
  }

  function isFreeOpen(text) {
    const hasOpen = /\b(?:ouvrir|open)\b/.test(text);
    const isFree = /\b(?:gratuit(?:es|e|s)?(?:ement)?|free)\b/.test(text);
    return hasOpen && isFree &&
      !text.includes('ouvrir un autre') && !text.includes('open another') &&
      !text.includes('changer de booster') && !text.includes('change booster') &&
      !/\b\d[\d.,]*\s*(chakra|gemmes?|diamants?|gems?)\b/.test(text);
  }

  function freeOpenBatchSize(text) {
    if (!isFreeOpen(text)) return 0;
    if (/\b(?:x\s*10|10\s*x)\b|×\s*10|10\s*×|\b(?:ouvrir|open)\s+(?:(?:les?|all|tous|toutes)\s+)?(?:10|dix)(?:\s+(?:boosters?|packs?|paquets?))?\b/.test(text)) {
      return 10;
    }
    if (/\b(?:x\s*5|5\s*x)\b|×\s*5|5\s*×|\b(?:ouvrir|open)\s+(?:(?:les?|all|tous|toutes)\s+)?(?:5|cinq)(?:\s+(?:boosters?|packs?|paquets?))?\b/.test(text)) {
      return 5;
    }
    if (/\b(?:ouvrir|open)\s+(?:tous|toutes|all)\s+(?:les?\s+)?(?:(?:free|gratuit(?:e)?s?)\s+)?(?:boosters?|packs?|paquets?)\b/.test(text)) {
      return 0;
    }
    return 1;
  }

  function findFreeOpen() {
    return candidates()
      .filter(({ text, el }) => freeOpenBatchSize(text) > 0 &&
        !el.disabled && el.getAttribute('aria-disabled') !== 'true')
      .sort((a, b) => freeOpenBatchSize(b.text) - freeOpenBatchSize(a.text))[0]?.el || null;
  }

  function freeBoosterCount() {
    const counter = [...document.querySelectorAll('[aria-label]')].find(el => {
      const label = normalizedText(el.getAttribute('aria-label'));
      return label.includes('booster') &&
        (label.includes('free') || label.includes('gratuit') || label.includes('gratis'));
    });
    if (!counter) return null;

    const text = normalizedText(`${counter.getAttribute('aria-label')} ${counter.textContent}`);
    const ratio = text.match(/(\d+)\s*\/\s*\d+/);
    if (ratio) return Number(ratio[1]);
    const count = text.match(/(\d+)\s*(?:free\s+)?boosters?/);
    return count ? Number(count[1]) : null;
  }

  function freeOpenQuantityControls() {
    const groups = [...document.querySelectorAll('[role="group"]')];
    const group = groups.find(el => {
      const label = normalizedText(el.getAttribute('aria-label'));
      return label.includes('number of boosters to open') ||
        label.includes('nombre de boosters a ouvrir');
    });
    return group ? [...group.querySelectorAll('button')] : [];
  }

  function selectFreeOpenQuantity(freeOpen) {
    if (!freeOpen) return false;
    const count = freeBoosterCount();
    if (count === null || count <= 0) return false;

    const controls = freeOpenQuantityControls();
    const sizes = controls.map(button => ({
      button,
      size: Number((button.innerText || button.textContent || '').trim().match(/^[×x]\s*(1|5|10)$/i)?.[1])
    })).filter(option => option.size && option.size <= count &&
      !option.button.disabled && option.button.getAttribute('aria-disabled') !== 'true');
    const choice = [10, 5, 1].map(size => sizes.find(option => option.size === size))
      .find(Boolean);
    if (!choice || choice.button.getAttribute('aria-pressed') === 'true') return false;

    return clickSafely(choice.button, `Sélection de ${choice.size} booster(s) gratuit(s)…`, 300);
  }

  function hasNoFreeBoosters() {
    return freeBoosterCount() === 0;
  }

  function normalizedText(value) {
    return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function isEligibleTradeRarity(value) {
    const rarity = normalizedText(value);
    return rarity === 'commune' || rarity === 'peu commune' || rarity === 'rare' ||
      rarity === 'epique' || rarity === 'common' || rarity === 'uncommon' || rarity === 'epic';
  }

  function parseDisplayedNumber(value) {
    const match = String(value || '').match(/\d[\d\s.,]*/);
    if (!match) return null;
    const number = Number(match[0].replace(/\D/g, ''));
    return Number.isSafeInteger(number) ? number : null;
  }

  function availableCardCount(tile) {
    const text = tile.querySelector('.have')?.textContent || '';
    const match = text.match(/(?:×|x)\s*([\d\s.,]+)/i) || text.match(/([\d\s.,]+)\s*(?:dispo|available)/i);
    if (!match) return 0;
    return parseDisplayedNumber(match[1]) || 0;
  }

  function selectedCardCount(tile) {
    return parseDisplayedNumber(tile.querySelector('.in')?.textContent) || 0;
  }

  function tradeTray(form, side) {
    const trays = [...form.querySelectorAll('.trays > section')];
    return trays.find(section => {
      const title = normalizedText(section.querySelector('h3')?.textContent);
      return side === 'want'
        ? title.includes('recoi') || title.includes('receive')
        : title.includes('donne') || title.includes('give');
    }) || trays[side === 'want' ? 1 : 0];
  }

  function tradeTrayValue(form, side) {
    const tray = tradeTray(form, side);
    if (!tray) return null;

    const total = tray.querySelector('.total');
    if (!total) return tray.querySelector('.slots li') ? null : 0;
    return parseDisplayedNumber(total.textContent);
  }

  function tradeTrayCardCount(form, side) {
    const tray = tradeTray(form, side);
    if (!tray) return null;
    return [...tray.querySelectorAll('.slots li')].reduce((count, card) => {
      return count + (parseDisplayedNumber(card.querySelector('.qty')?.textContent) || 1);
    }, 0);
  }

  function giveChakraAmount(form) {
    const tray = tradeTray(form, 'give');
    const amountInput = tray?.querySelector('input[type="number"]');
    if (!amountInput || !amountInput.value) return 0;
    const amount = Number(amountInput.value);
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
  }

  async function setGiveChakra(form, amount, waitForRender) {
    const tray = tradeTray(form, 'give');
    const chakraLabel = [...(tray?.querySelectorAll('label') || [])]
      .find(label => normalizedText(label.textContent).includes('chakra'));
    if (!tray || !chakraLabel) throw new Error('Contrôle du chakra introuvable dans « Tu donnes ».');

    let amountInput = tray.querySelector('input[type="number"]');
    const toggle = chakraLabel.querySelector('input[type="checkbox"]');
    if (amount > 0 && toggle && !toggle.checked) {
      toggle.click();
      await waitForRender();
      amountInput = tray.querySelector('input[type="number"]');
    }
    if (!amountInput) {
      if (amount === 0) return 0;
      throw new Error('Champ de quantité de chakra introuvable.');
    }

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Impossible de mettre à jour la quantité de chakra.');
    setter.call(amountInput, String(amount));
    amountInput.dispatchEvent(new Event('input', { bubbles: true }));
    amountInput.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForRender();

    const actualAmount = Number(amountInput.value);
    if (!Number.isSafeInteger(actualAmount) || actualAmount !== amount) {
      throw new Error('Kyara n’a pas confirmé la quantité de chakra demandée.');
    }
    return actualAmount;
  }

  function clearRarityFilters(form) {
    for (const chip of form.querySelectorAll('.filters .chips button[aria-pressed="true"]')) {
      const label = normalizedText(chip.textContent);
      if (label.includes('double') || label.includes('manque') || label.includes('missing')) continue;
      chip.click();
    }
  }

  function chooseDuplicateCards(candidates, target, maxCards) {
    const affordable = candidates
      .filter(candidate => candidate.price > 0 && candidate.maxAdditional > 0)
      .sort((a, b) => a.price - b.price);
    const additions = [];
    let value = 0;
    let count = 0;

    for (const candidate of affordable) {
      const quantity = Math.min(candidate.maxAdditional, maxCards - count,
        Math.floor((target - value) / candidate.price));
      if (quantity <= 0) continue;
      additions.push({ ...candidate, count: quantity });
      value += candidate.price * quantity;
      count += quantity;
      if (count >= maxCards || value >= target) break;
    }

    return { additions, value };
  }

  async function addBalancedDuplicates(form, button, status) {
    if (tradeBalancing) return;
    tradeBalancing = true;
    const setStatus = text => {
      const currentStatus = form.querySelector('[data-kh-trade-balance-status]') || status;
      currentStatus.textContent = text;
    };
    button.disabled = true;
    setStatus('Calcul de la valeur des cartes…');
    const waitForRender = () => new Promise(resolve => setTimeout(resolve, 30));

    try {
      const wantValue = tradeTrayValue(form, 'want');
      const giveValue = tradeTrayValue(form, 'give');
      const alreadyGivenCount = tradeTrayCardCount(form, 'give');
      const alreadyWantedCount = tradeTrayCardCount(form, 'want');
      const existingChakra = giveChakraAmount(form);
      if (wantValue === null || giveValue === null || alreadyGivenCount === null ||
        alreadyWantedCount === null || existingChakra === null) {
        setStatus('Valeur indisponible pour certaines cartes : aucun changement effectué.');
        return;
      }
      if (wantValue <= 0) {
        setStatus('Sélectionne d’abord les cartes que tu veux recevoir.');
        return;
      }

      const target = wantValue - giveValue - existingChakra;
      if (target <= 0) {
        setStatus('Tes cartes sélectionnées valent déjà autant ou plus. Aucun changement effectué.');
        return;
      }
      const cardSlots = Math.max(0, 20 - alreadyGivenCount - alreadyWantedCount);

      const tabs = [...form.querySelectorAll('[role="tab"]')];
      const ownTab = tabs.find(tab => /^(?:mes cartes|my cards)$/.test(normalizedText(tab.textContent)));
      if (!ownTab) throw new Error('Onglet « Mes cartes » introuvable dans la fenêtre d’échange.');
      if (ownTab.getAttribute('aria-selected') !== 'true') {
        ownTab.click();
        await waitForRender();
      }

      const search = form.querySelector('.filters input[type="search"]');
      if (search?.value) {
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        await waitForRender();
      }
      clearRarityFilters(form);
      await waitForRender();

      const doubleFilter = [...form.querySelectorAll('.filters .chips button')]
        .find(chip => !chip.hasAttribute('data-kh-trade-balance') &&
          !chip.hasAttribute('data-kh-trade-duplicates') &&
          /^(?:mes doubles|my duplicates|duplicates)$/.test(normalizedText(chip.textContent)));
      if (!doubleFilter) throw new Error('Filtre natif « Mes doubles » introuvable.');
      if (doubleFilter.getAttribute('aria-pressed') !== 'true') {
        doubleFilter.click();
        await waitForRender();
      }

      for (let page = 0; page < 100; page += 1) {
        const more = form.querySelector('button.more');
        if (!more) break;
        more.click();
        await waitForRender();
        if (page === 99 && form.querySelector('button.more')) {
          throw new Error('Trop de cartes à parcourir pour terminer le calcul.');
        }
      }

      const candidates = [...form.querySelectorAll('ul.grid > li > button.tile')].flatMap(tile => {
        const rarity = normalizedText(tile.querySelector('.r')?.textContent);
        if (!isEligibleTradeRarity(rarity) || tile.querySelector('.lk')) return [];

        const available = availableCardCount(tile);
        const price = parseDisplayedNumber(tile.querySelector('.pr')?.textContent);
        if (price === null) return [];

        return [{
          key: `${tile.querySelector('.nm')?.textContent.trim() || ''}|${rarity}|${tile.querySelector('img')?.src || ''}`,
          price,
          maxAdditional: Math.max(0, available - 1)
        }];
      });
      const plan = chooseDuplicateCards(candidates, target, cardSlots);

      let addedCount = 0;
      for (const addition of plan.additions) {
        for (let count = 0; count < addition.count; count += 1) {
          const tile = [...form.querySelectorAll('ul.grid > li > button.tile')].find(current => {
            const rarity = normalizedText(current.querySelector('.r')?.textContent);
            const key = `${current.querySelector('.nm')?.textContent.trim() || ''}|${rarity}|${current.querySelector('img')?.src || ''}`;
            return key === addition.key;
          });
          if (!tile || tile.disabled) throw new Error('Une carte prévue n’est plus disponible; le reste n’a pas été ajouté.');

          const before = selectedCardCount(tile);
          tile.click();
          await waitForRender();
          const refreshedTile = [...form.querySelectorAll('ul.grid > li > button.tile')].find(current => {
            const rarity = normalizedText(current.querySelector('.r')?.textContent);
            const key = `${current.querySelector('.nm')?.textContent.trim() || ''}|${rarity}|${current.querySelector('img')?.src || ''}`;
            return key === addition.key;
          });
          if (!refreshedTile || selectedCardCount(refreshedTile) !== before + 1) {
            throw new Error('Kyara n’a pas confirmé l’ajout d’une carte; le reste n’a pas été ajouté.');
          }
          addedCount += 1;
        }
      }

      const updatedGiveValue = tradeTrayValue(form, 'give');
      if (updatedGiveValue === null) {
        throw new Error('Valeur de tes cartes indisponible après leur ajout.');
      }
      const remainingValue = Math.max(0, wantValue - updatedGiveValue - existingChakra);
      const chakraAdded = remainingValue > 0
        ? (await setGiveChakra(form, existingChakra + remainingValue, waitForRender)) - existingChakra
        : 0;
      const cardMessage = addedCount
        ? `${addedCount} carte(s) ajoutée(s)`
        : 'Aucun autre double éligible disponible';
      const chakraMessage = chakraAdded
        ? ` et ${chakraAdded.toLocaleString('fr-FR')} ◆ de chakra`
        : '';
      const limitMessage = cardSlots === 0 && remainingValue > 0
        ? ' (limite de 20 cartes pour l’échange atteinte)'
        : '';
      setStatus(`${cardMessage}${chakraMessage}${limitMessage}. Valeur visée : ${wantValue.toLocaleString('fr-FR')} ◆. L’échange n’a pas été envoyé.`);
    } catch (error) {
      console.error('Kyara Booster Helper: unable to balance trade with duplicates', error);
      setStatus(`Ajout interrompu : ${error.message || 'erreur inattendue'}. Vérifie les cartes sélectionnées.`);
    } finally {
      tradeBalancing = false;
      button.disabled = false;
      for (const currentButton of form.querySelectorAll('[data-kh-trade-balance]')) {
        currentButton.disabled = false;
      }
    }
  }

  function refreshTradeDuplicates() {
    auctionsBtn.style.display = location.pathname.toLowerCase() === '/marche' ? 'block' : 'none';
    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (const dialog of dialogs) {
      const form = dialog.querySelector('form.form');
      const filters = form?.querySelector('.filters');
      const list = form?.querySelector('ul.grid');
      if (!form || !filters || !list) continue;

      let tools = filters.querySelector('[data-kh-trade-tools]');
      if (!tools) {
        tools = document.createElement('div');
        tools.dataset.khTradeTools = 'true';
        tools.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:7px';
        filters.appendChild(tools);
      }

      let balanceButton = tools.querySelector('[data-kh-trade-balance]');
      if (!balanceButton) {
        balanceButton = document.createElement('button');
        balanceButton.type = 'button';
        balanceButton.dataset.khTradeBalance = 'true';
        balanceButton.textContent = 'Ajouter mes doubles équilibrés';
        balanceButton.title = 'Ajouter des doubles non gold pour rapprocher la valeur des cartes reçues';
        balanceButton.style.cssText = 'padding:5px 9px;border:1px solid #f59e0b;border-radius:999px;background:#78350f;color:#fef3c7;font:inherit;font-size:12px;font-weight:700;cursor:pointer';
        balanceButton.addEventListener('click', () => {
          const status = form.querySelector('[data-kh-trade-balance-status]');
          if (status) addBalancedDuplicates(form, balanceButton, status);
        });
        tools.appendChild(balanceButton);
      }
      balanceButton.disabled = tradeBalancing;

      let balanceStatus = tools.querySelector('[data-kh-trade-balance-status]');
      if (!balanceStatus) {
        balanceStatus = document.createElement('span');
        balanceStatus.dataset.khTradeBalanceStatus = 'true';
        balanceStatus.setAttribute('role', 'status');
        balanceStatus.setAttribute('aria-live', 'polite');
        balanceStatus.style.cssText = 'flex-basis:100%;font-size:11px;color:#fbbf24';
        tools.appendChild(balanceStatus);
      }

      const tabs = [...form.querySelectorAll('[role="tab"]')];
      const selectedTab = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
      const ownTabSelected = /^(?:mes cartes|my cards)$/.test(normalizedText(selectedTab?.textContent));
      if (ownTabSelected) {
        tools.querySelector('[data-kh-trade-duplicates]')?.remove();
        for (const card of list.querySelectorAll('li')) {
          card.classList.remove('kh-trade-duplicate', 'kh-trade-duplicate-filtered');
        }
        continue;
      }

      const cards = [...list.querySelectorAll('li')];
      const duplicateCounts = new Map(cards.map(card => {
        const count = card.querySelector('.lk') ? 0 : availableCardCount(card);
        return [card, count];
      }));
      const duplicateTotal = [...duplicateCounts.values()].filter(count => count > 1).length;

      let style = document.getElementById('kh-trade-duplicates-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'kh-trade-duplicates-style';
        style.textContent = `
          li.kh-trade-duplicate > button.tile { outline: 2px solid #34d399 !important; outline-offset: 1px; }
          li.kh-trade-duplicate-filtered { display: none !important; }
        `;
        (document.head || document.documentElement).appendChild(style);
      }

      let toggle = tools.querySelector('[data-kh-trade-duplicates]');
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.dataset.khTradeDuplicates = 'true';
        toggle.setAttribute('aria-pressed', 'false');
        toggle.title = 'Afficher uniquement les cartes que cette personne peut échanger';
        toggle.style.cssText = 'padding:5px 9px;border:1px solid #34d399;border-radius:999px;background:#064e3b;color:#d1fae5;font:inherit;font-size:12px;font-weight:700;cursor:pointer';
        toggle.addEventListener('click', () => {
          const showOnly = toggle.getAttribute('aria-pressed') !== 'true';
          toggle.setAttribute('aria-pressed', String(showOnly));
          refreshTradeDuplicates();
        });
        tools.appendChild(toggle);
      }

      const showOnly = toggle.getAttribute('aria-pressed') === 'true';
      const label = `Doubles uniquement (${duplicateTotal})`;
      if (toggle.textContent !== label) toggle.textContent = label;
      for (const [card, count] of duplicateCounts) {
        card.classList.toggle('kh-trade-duplicate', count > 1);
        card.classList.toggle('kh-trade-duplicate-filtered', showOnly && count <= 1);
      }
    }

  }

  const saleDefaults = {
    kyaraEnabled: true,
    kyaraSellKeepCopies: 1,
    kyaraSellPricePercent: 100,
    kyaraAutoSellEnabled: false,
    kyaraSellMaxPerVisit: 1
  };
  let saleRunActive = false;
  let saleListingsThisVisit = 0;
  let saleAutoTimer = null;
  let saleAssistantStatus = null;
  let saleFormAvailable = null;

  function isSellPage() {
    return location.pathname.toLowerCase() === '/marche' &&
      new URLSearchParams(location.search).get('onglet') === 'vendre';
  }

  function sellableCopies(button) {
    const label = button.querySelector('.mut.small')?.textContent || '';
    const match = label.match(/[×x]\s*(\d+)/i);
    return match ? Number(match[1]) : 1;
  }

  function updateSaleStatus(message) {
    if (saleAssistantStatus?.isConnected) saleAssistantStatus.textContent = message;
  }

  function ensureSaleAssistant() {
    if (!isSellPage()) {
      document.querySelector('[data-kh-sell-assistant]')?.remove();
      saleAssistantStatus = null;
      saleFormAvailable = null;
      clearTimeout(saleAutoTimer);
      saleAutoTimer = null;
      return;
    }

    const panelTarget = document.querySelector('main [role="tabpanel"]');
    if (!panelTarget) return;

    let assistant = panelTarget.querySelector('[data-kh-sell-assistant]');
    if (!assistant) {
      assistant = document.createElement('section');
      assistant.dataset.khSellAssistant = 'true';
      assistant.style.cssText = 'margin:10px 0;padding:10px 12px;border:1px solid #f59e0b;border-radius:9px;background:#171717;color:#fff;font:13px Arial,sans-serif';
      const title = document.createElement('strong');
      title.textContent = 'Kyara Booster Helper · vente des doublons';
      const status = document.createElement('div');
      status.dataset.khSellStatus = 'true';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.style.cssText = 'margin:6px 0;color:#fbbf24';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Publier les doublons selon mes réglages';
      button.style.cssText = 'padding:7px 10px;border:0;border-radius:6px;background:#f59e0b;color:#111;font-weight:bold;cursor:pointer';
      button.addEventListener('click', () => {
        runSellAssistant(true).catch(error => {
          console.error('Kyara Booster Helper: manual duplicate sale failed', error);
          updateSaleStatus(`Vente interrompue : ${error.message || 'erreur inattendue'}.`);
        });
      });
      const listingsLink = document.createElement('a');
      listingsLink.href = '/marche?onglet=ventes';
      listingsLink.textContent = 'Gérer mes annonces Kyara';
      listingsLink.style.cssText = 'display:inline-block;margin-left:10px;color:#fbbf24';
      assistant.append(title, status, button, listingsLink);
      panelTarget.prepend(assistant);
    }
    saleAssistantStatus = assistant.querySelector('[data-kh-sell-status]');

    const hasSellForm = !!document.querySelector('.sellgrid .sellpick');
    if (saleFormAvailable !== hasSellForm) {
      saleFormAvailable = hasSellForm;
      updateSaleStatus(hasSellForm
        ? 'Prêt. Kyara n’affiche ici que les copies autorisées à la vente ; les cartes protégées et bloquées par le site restent exclues.'
        : 'Kyara ne propose pas de cartes vendables pour ce compte. Aucune annonce n’a été créée.');
    }

    if (enabled && hasSellForm && !saleAutoTimer && !saleRunActive) {
      saleAutoTimer = setTimeout(() => {
        saleAutoTimer = null;
        runSellAssistant(false).catch(error => {
          console.error('Kyara Booster Helper: automatic duplicate sale failed', error);
          updateSaleStatus(`Vente automatique interrompue : ${error.message || 'erreur inattendue'}.`);
        });
      }, 500);
    }
  }

  function waitForElement(selector, root = document, timeoutMs = 8000) {
    return new Promise(resolve => {
      const startedAt = Date.now();
      const check = () => {
        const element = root.querySelector(selector);
        if (element || Date.now() - startedAt >= timeoutMs) {
          resolve(element);
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }

  function nativeInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Impossible de régler le prix dans le formulaire Kyara.');
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function submitNativeSale(button, settings) {
    button.click();
    const dialog = await waitForElement('[role="dialog"]');
    const form = dialog && await waitForElement('form.form', dialog, 10000);
    if (!form) throw new Error('Le formulaire de vente natif de Kyara est introuvable.');

    const priceInput = form.querySelector('input[type="number"][required]');
    if (!priceInput) throw new Error('Le champ de prix minimum de Kyara est introuvable.');

    const hints = [...form.querySelectorAll('.hint')].map(element => element.textContent || '').join(' ');
    const medianMatch = hints.match(/(?:median|médian(?:e)?|mediana)\s*:\s*([\d\s.,]+)/i);
    const median = medianMatch ? parseDisplayedNumber(medianMatch[1]) : null;
    const siteSuggestedPrice = parseDisplayedNumber(priceInput.value);
    const baseline = median || siteSuggestedPrice;
    const minimum = Number(priceInput.min);
    if (!Number.isSafeInteger(baseline) || baseline <= 0 ||
      !Number.isSafeInteger(minimum) || minimum < 0) {
      throw new Error('Prix médian ou minimum indisponible ; aucune annonce n’a été publiée.');
    }

    const price = Math.max(minimum, Math.ceil(baseline * settings.kyaraSellPricePercent / 100));
    nativeInputValue(priceInput, price);
    await new Promise(resolve => setTimeout(resolve, 150));
    if (Number(priceInput.value) !== price) {
      throw new Error('Kyara n’a pas confirmé le prix recommandé.');
    }
    if (!enabled || !isSellPage()) throw new Error('Vente arrêtée avant publication.');

    const submit = form.querySelector('button[type="submit"]');
    if (!submit || submit.disabled) throw new Error('Le formulaire Kyara refuse cette annonce.');
    updateSaleStatus(`Publication d’une annonce au prix de ${price.toLocaleString('fr-FR')} ◆…`);
    submit.click();

    const success = await waitForElement('.ok[role="status"]', dialog, 12000);
    if (!success || !/(?:published|publi[ée]e?|list[ée]e?|publicad[oa])/i.test(success.textContent || '')) {
      const error = dialog.querySelector('[role="alert"]');
      throw new Error(error?.textContent?.trim() || 'Kyara n’a pas confirmé la publication de l’annonce.');
    }

    saleListingsThisVisit += 1;
    updateSaleStatus(`Annonce publiée à ${price.toLocaleString('fr-FR')} ◆. ${saleListingsThisVisit} annonce(s) créée(s) durant cette visite.`);
    const closeButton = [...dialog.querySelectorAll('button')]
      .find(candidate => /^(?:close|fermer|cerrar|ok)$/i.test((candidate.textContent || '').trim()));
    if (closeButton) closeButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    return !!closeButton;
  }

  async function runSellAssistant(manual) {
    if (saleRunActive || !isSellPage() || !enabled) return;
    saleRunActive = true;
    try {
      const settings = await chrome.storage.local.get(saleDefaults);
      if (!manual && !settings.kyaraAutoSellEnabled) return;

      const keepCopies = Number(settings.kyaraSellKeepCopies);
      const pricePercent = Number(settings.kyaraSellPricePercent);
      const maxPerVisit = Number(settings.kyaraSellMaxPerVisit);
      if (!Number.isInteger(keepCopies) || keepCopies < 0 || keepCopies > 99 ||
        !Number.isInteger(pricePercent) || pricePercent < 50 || pricePercent > 200 ||
        !Number.isInteger(maxPerVisit) || maxPerVisit < 1 || maxPerVisit > 10) {
        throw new Error('Les réglages de vente enregistrés sont invalides.');
      }

      let runCount = 0;
      while (saleListingsThisVisit < maxPerVisit && runCount < maxPerVisit) {
        if (!enabled || !isSellPage()) return;
        const candidate = [...document.querySelectorAll('.sellgrid .sellpick')]
          .find(button => {
            if (button.disabled || button.getAttribute('aria-disabled') === 'true' ||
              button.querySelector('.lk')) return false;
            return sellableCopies(button) > keepCopies;
          });
        if (!candidate) {
          updateSaleStatus(runCount
            ? `Terminé : ${runCount} annonce(s) publiée(s). La réserve de ${keepCopies} copie(s) a été conservée.`
            : 'Aucun double vendable au-delà de la réserve choisie ; aucune annonce créée.');
          return;
        }

        const dialogClosed = await submitNativeSale(candidate, settings);
        runCount += 1;
        if (!dialogClosed) {
          updateSaleStatus('Annonce publiée. Le formulaire de confirmation est resté ouvert ; aucune autre vente n’a été lancée.');
          return;
        }
      }
      if (saleListingsThisVisit >= maxPerVisit) {
        updateSaleStatus(`Limite de ${maxPerVisit} annonce(s) par visite atteinte.`);
      }
    } finally {
      saleRunActive = false;
    }
  }

  function tick() {
    if (!enabled || busy || !document.body) return;
    const path = location.pathname.toLowerCase();
    const bodyText = (document.body.innerText || '').toLowerCase();
    const resultsScreen = /\d+\s*(?:nouvelles cartes?|new cards?)/.test(bodyText) ||
      ((bodyText.includes('meilleure carte') && bodyText.includes('voir la collection')) ||
        (bodyText.includes('best card') && bodyText.includes('view collection')));

    const openingPage = path.startsWith('/ouvrir/');
    if (openingPage) {
      const reveal = find(text => text.includes('tout révéler') || text.includes('révéler tout') ||
        text.includes('reveal all'));
      if (reveal && clickSafely(reveal, 'Révélation des cartes…', 1700)) return;
    }

    if (resultsScreen) {
      // Prefer the clear navigation label at the top-left; avoid paid/open-another buttons.
      const back = find((text, el) => {
        const label = text.replace(/[‹←\s]/g, '').trim();
        const href = (el.getAttribute('href') || '').toLowerCase();
        return (label === 'boosters' || label.endsWith('boosters')) &&
          !text.includes('ouvrir') && (el.tagName === 'A' || href.includes('booster') || el.getAttribute('role') === 'button' || el.hasAttribute('tabindex'));
      });
      if (back && clickSafely(back, 'Retour à la liste des boosters…', 2000)) return;
      const resultAction = find(text => text.includes('voir les autres') || text.includes('see other') ||
        text.includes('retour aux boosters') || text.includes('return to boosters') ||
        text.includes('retour aux paquets') || text.includes('return to packs'));
      if (resultAction && clickSafely(resultAction, 'Retour à la liste des boosters…', 2000)) return;
      say('Cartes révélées — recherche du retour…');
      schedule(IDLE_MS);
      return;
    }

    if (openingPage) {
      const freeOpen = findFreeOpen();
      if (hasNoFreeBoosters()) {
        say('Aucun booster gratuit restant.');
        schedule(IDLE_MS);
        return;
      }
      if (selectFreeOpenQuantity(freeOpen)) return;
      if (freeOpen && clickSafely(freeOpen, 'Ouverture du booster gratuit…')) return;
      say('Attente de l’étape suivante…');
      schedule(IDLE_MS);
      return;
    }

    const freeOpen = findFreeOpen();
    if (freeOpen && clickSafely(freeOpen, 'Ouverture du booster gratuit…')) return;
    say('Recherche d’un booster gratuit…');
    schedule(IDLE_MS);
  }

  const observer = new MutationObserver(() => {
    refreshTradeDuplicates();
    ensureSaleAssistant();
    if (enabled && !busy) schedule(500);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  refreshTradeDuplicates();
  ensureSaleAssistant();
  document.addEventListener('visibilitychange', () => { if (enabled && !busy) schedule(100); });
  window.addEventListener('focus', () => { if (enabled && !busy) schedule(100); });
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'KYARA_WAKE' && enabled && !busy) schedule(50);
    if (message?.type === 'KYARA_RELOAD_AFTER_UPDATE') {
      setTimeout(() => location.reload(), 1200);
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.kyaraEnabled) {
      enabled = !!changes.kyaraEnabled.newValue;
      updateToggle();
      if (enabled) schedule(100);
      else {
        clearTimeout(timer);
        clearTimeout(saleAutoTimer);
        say('Assistant arrêté');
      }
    }
    if (changes.kyaraEnabled || changes.kyaraAutoSellEnabled ||
      changes.kyaraSellKeepCopies || changes.kyaraSellPricePercent ||
      changes.kyaraSellMaxPerVisit) ensureSaleAssistant();
  });
  loadSetting();
})();
