let decksContainer = document.getElementById("decksContainer");
let deckBuilderContainer = document.getElementById("deckBuilderContainer");
let deckBuilderNameEntry = document.getElementById("deckBuilderNameEntry");
let deckBuilderBackButton = document.getElementById("deckBuilderBackButton");
let deckBuilderShareButton = document.getElementById("deckBuilderShareButton");
let deckBuilderDeleteButton = document.getElementById("deckBuilderDeleteButton");
let deckBuilderCount = document.getElementById("deckBuilderCount");
let deckBuilderDeckList = document.getElementById("deckBuilderDeckList");
let deckBuilderBinder = document.getElementById("deckBuilderBinder");
let deckBuilderBinderList = document.getElementById("deckBuilderBinderList");
let deckBuilderBinderSearch = document.getElementById("deckBuilderBinderSearch");
let deckBuilderBinderFilter = document.getElementById("deckBuilderBinderFilter");
let deckBuilderRarityFilter = document.getElementById("deckBuilderRarityFilter");
let deckBuilderTypeFilter = document.getElementById("deckBuilderTypeFilter");

let activeDeck;
const DECK_LIMIT = 30;
const MAX_COPIES_PER_CARD = 4;
let deckRarityRestrictions = { "Rare": 15, "Legendary": 5, "Mythic": 2 };
const RARITY_ORDER_DECK = ["Mythic", "Legendary", "Rare", "Common"];
const DECK_CODE_PREFIX = "DTCG1.";

/* ---- Deck list (one tile per card, with a ×N quantity) ---- */

function createDeckListCardEl(cardID) {
    let cardEl = createCardEl(getObjectById(cards, cardID), (e) => {
        removeCardFromDeckList(e.target.dataset.cardId);
    }, false, false, true);
    let qty = document.createElement('div');
    qty.className = 'badge deck-qty';
    cardEl.append(qty);
    let hint = document.createElement('div');
    hint.className = 'deck-remove-hint';
    hint.innerHTML = '<i class="bi bi-dash-circle-fill"></i>';
    cardEl.append(hint);
    return cardEl;
}

function getDeckListCardEl(cardID) {
    return deckBuilderDeckList.querySelector(`.card-wrapper:has(img[data-card-id="${cardID}"])`);
}

function getBinderListCardEl(cardID) {
    return deckBuilderBinderList.querySelector(`.card-wrapper:has(img[data-card-id="${cardID}"])`);
}

// Sync both panels for one card after its quantity in the active deck changes.
function refreshDeckCard(cardID) {
    const inDeck = activeDeck.deckList[cardID] || 0;

    let deckEl = getDeckListCardEl(cardID);
    if (inDeck > 0 && !deckEl) {
        deckEl = createDeckListCardEl(cardID);
        deckBuilderDeckList.append(deckEl);
        sortDeckBuilderDeckList();
    }
    if (inDeck === 0 && deckEl) deckEl.remove();
    if (deckEl && inDeck > 0) {
        deckEl.querySelector('.deck-qty').textContent = inDeck;
        deckEl.querySelector('.card').alt = `${getObjectById(cards, cardID).name}, ${inDeck} in deck`;
    }

    const binderEl = getBinderListCardEl(cardID);
    if (binderEl) {
        const available = (binder[cardID] || 0) - inDeck;
        binderEl.querySelector('.badge').textContent = available;
        binderEl.querySelector('.card').classList.toggle('owned', available > 0);
        const deckBadge = binderEl.querySelector('.deck-count-badge');
        deckBadge.innerHTML = `<i class="bi bi-inboxes-fill"></i>${inDeck}`;
        deckBadge.style.display = inDeck > 0 ? '' : 'none';
    }
}

/* ---- Deck tiles ---- */

function buildDecks() {
    decksContainer.innerHTML = '';

    let addNewDeckButton = document.createElement("div");
    addNewDeckButton.innerHTML = `<i class="bi bi-plus-square"></i> Create New Deck`;
    addNewDeckButton.classList.add("add-new-deck");
    addNewDeckButton.onclick = () => {
        if (!currentProfile) return;
        createDeck("New Deck " + (decks.length + 1), {});
    };
    makeActivatable(addNewDeckButton);
    decksContainer.append(addNewDeckButton);

    let importDeckButton = document.createElement("div");
    importDeckButton.innerHTML = `<i class="bi bi-box-arrow-in-down"></i> Import Deck Code`;
    importDeckButton.classList.add("add-new-deck", "import-deck");
    importDeckButton.onclick = importDeck;
    makeActivatable(importDeckButton);
    decksContainer.append(importDeckButton);

    decks.forEach(deck => {
        let deckPreview = document.createElement("div");
        deckPreview.classList.add("deck-card-preview");

        let iconImg = document.createElement("img");
        iconImg.classList.add("deck-card-icon");
        iconImg.src = deck.icon ? `./assets/card-art/${deck.icon}.jpg` : "./assets/card-art/back.png";
        iconImg.alt = "";
        if (!deck.icon) iconImg.classList.add("placeholder");

        let nameEl = document.createElement("div");
        nameEl.classList.add("deck-preview-name");
        nameEl.textContent = deck.name;

        let countEl = document.createElement("div");
        countEl.classList.add("deck-preview-count");
        countEl.textContent = `${getCountDeck(deck)} / ${DECK_LIMIT} cards`;

        deckPreview.append(iconImg, nameEl, countEl);
        deckPreview.onclick = () => {
            activeDeck = deck;
            loadDeck(deck);
        };
        makeActivatable(deckPreview, `Edit ${deck.name}`);
        decksContainer.append(deckPreview);
    });
}

function createDeck(name, deckList) {
    activeDeck = {
        "id": generateUID(),
        "name": name,
        "deckList": deckList,
        "icon": null
    };
    decks.push(activeDeck);
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({ decks: decks });
    loadDeck(activeDeck);
}

/* ---- Builder ---- */

function populateTypeFilter() {
    if (deckBuilderTypeFilter.options.length > 1) return;
    const types = [...new Set(cards.filter(c => c.class !== "Sleeve" && c.type).map(c => c.type))].sort();
    types.forEach(type => deckBuilderTypeFilter.add(new Option(type, type)));
}

function loadDeck(deck) {
    decksContainer.style.display = "none";
    deckBuilderContainer.style.display = "flex";
    deckBuilderNameEntry.value = deck.name;
    deckBuilderDeckList.innerHTML = "";
    deckBuilderBinderList.innerHTML = "";
    populateTypeFilter();

    for (let id in binder) {
        const card = getObjectById(cards, id);
        if (!card || card.class === "Sleeve") continue;
        let cardEl = createCardEl(card, (e) => addCardToDeck(e.target.dataset.cardId), true, false, true);

        let deckBadge = document.createElement('div');
        deckBadge.className = 'deck-count-badge';
        cardEl.append(deckBadge);

        deckBuilderBinderList.append(cardEl);
    }
    sortDeckBuilderBinder();

    for (let id in deck.deckList) refreshDeckCard(id);
    for (let id in binder) if (!deck.deckList[id]) refreshDeckCard(id);

    updateDeckStats();
    updateDeckIconPreview();
    applyDeckBuilderFilters();
}

function addCardToDeck(cardID) {
    const card = getObjectById(cards, cardID);
    const inDeck = activeDeck.deckList[cardID] || 0;
    if (inDeck >= (binder[cardID] || 0)) {
        showToast("No more copies of this card in your binder.", "error");
        return;
    }
    const violation = getDeckRuleViolation(activeDeck.deckList, card);
    if (violation) {
        showToast(violation, "error");
        return;
    }
    activeDeck.deckList[cardID] = inDeck + 1;
    refreshDeckCard(cardID);
    updateDeckStats();
    saveActiveDeck();
}

function removeCardFromDeckList(cardID) {
    if (!activeDeck.deckList[cardID]) return;

    if (activeDeck.deckList[cardID] > 1) activeDeck.deckList[cardID] -= 1;
    else delete activeDeck.deckList[cardID];

    if (activeDeck.icon === cardID && !activeDeck.deckList[cardID]) {
        delete activeDeck.icon;
        updateDeckIconPreview();
    }

    refreshDeckCard(cardID);
    updateDeckStats();
    saveActiveDeck();
}

function updateDeckStats() {
    const total = getCountActiveDeck();
    deckBuilderCount.textContent = total;

    // Progress bar
    const fill = document.getElementById('deckProgressFill');
    if (fill) {
        const pct = (total / DECK_LIMIT) * 100;
        fill.style.width = pct + '%';
        fill.className = 'deck-progress-fill' +
            (total >= DECK_LIMIT ? ' complete' : pct >= 80 ? ' near' : '');
    }

    // Restriction meters for slot-limited rarities
    let statsEl = document.getElementById('deckBuilderRarityStats');
    if (!statsEl) return;

    statsEl.innerHTML = ['Rare', 'Legendary', 'Mythic'].map(r => {
        const used = getRarityCount(activeDeck.deckList, r);
        const max  = deckRarityRestrictions[r];
        const cls  = used >= max ? ' full' : used / max >= 0.75 ? ' near' : '';
        return `<span class="deck-rarity-pip rarity-${r.toLowerCase()}${cls}">${used}/${max} ${r}</span>`;
    }).join('');
}

/* ---- Deck icon: chosen from a picker of the deck's cards ---- */

const deckIconSelector = document.getElementById("deckBuilderIconSelector");
const deckIconModalContainer = document.getElementById("deckIconModalContainer");
const deckIconPicker = document.getElementById("deckIconPicker");
const deckIconClearButton = document.getElementById("deckIconClearButton");

function updateDeckIconPreview() {
    const preview = document.getElementById("deckBuilderIconPreview");
    if (!preview) return;
    if (activeDeck && activeDeck.icon) {
        preview.innerHTML = `<img src="./assets/card-art/${activeDeck.icon}.jpg" alt="">`;
    } else {
        preview.innerHTML = "<span>No icon</span>";
    }
}

function setDeckIcon(cardId) {
    if (!activeDeck) return;
    if (cardId) activeDeck.icon = cardId;
    else delete activeDeck.icon;
    updateDeckIconPreview();
    saveActiveDeck();
}

function openDeckIconPicker() {
    const rarityRank = { "Mythic": 0, "Legendary": 1, "Rare": 2, "Common": 3 };
    const ids = Object.keys(activeDeck.deckList)
        .map(id => getObjectById(cards, id))
        .filter(Boolean)
        .sort((a, b) => (rarityRank[a.rarity] ?? 4) - (rarityRank[b.rarity] ?? 4) || a.name.localeCompare(b.name));

    deckIconPicker.innerHTML = "";
    if (ids.length === 0) {
        deckIconPicker.innerHTML = '<p class="empty-state">Add some cards to this deck first, then pick one as its icon.</p>';
    }
    ids.forEach(card => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "deck-icon-option";
        const selected = activeDeck.icon === card.id;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
        option.title = card.name;
        option.innerHTML = `<img src="./assets/card-art/${card.id}.jpg" alt="${escapeHTML(card.name)}" loading="lazy" draggable="false">`;
        option.addEventListener("click", () => {
            setDeckIcon(card.id);
            deckIconModalContainer.classList.remove("active");
        });
        deckIconPicker.append(option);
    });

    deckIconClearButton.disabled = !activeDeck.icon;
    deckIconModalContainer.classList.add("active");
    (deckIconPicker.querySelector(".selected") || deckIconPicker.querySelector("button") || deckIconClearButton)
        .focus({ preventScroll: true });
}

deckIconSelector.addEventListener("click", openDeckIconPicker);
deckIconClearButton.addEventListener("click", () => {
    setDeckIcon(null);
    deckIconModalContainer.classList.remove("active");
});
document.getElementById("deckIconCloseButton").addEventListener("click", () => {
    deckIconModalContainer.classList.remove("active");
});
deckIconModalContainer.addEventListener("click", (e) => {
    if (e.target === deckIconModalContainer) deckIconModalContainer.classList.remove("active");
});

function sortDeckBuilderBinder() {
    const container = document.querySelector("#deckBuilderBinderList");
    const rarityRank = { "Mythic": 0, "Legendary": 1, "Rare": 2, "Common": 3 };
    Array.from(container.querySelectorAll('.card-wrapper'))
        .sort((a, b) => {
            const cardA = getObjectById(cards, a.querySelector('img').dataset.cardId);
            const cardB = getObjectById(cards, b.querySelector('img').dataset.cardId);
            const rDiff = (rarityRank[cardA?.rarity] ?? 4) - (rarityRank[cardB?.rarity] ?? 4);
            if (rDiff !== 0) return rDiff;
            return (cardA?.name || '').localeCompare(cardB?.name || '');
        })
        .forEach(card => container.appendChild(card));
}

function sortDeckBuilderDeckList() {
    const container = document.querySelector("#deckBuilderDeckList");
    Array.from(container.querySelectorAll('.card-wrapper'))
        .sort((a, b) => {
            const idA = parseInt(a.querySelector('img').dataset.cardId, 10);
            const idB = parseInt(b.querySelector('img').dataset.cardId, 10);
            return idA - idB;
        })
        .forEach(card => container.appendChild(card));
}

/* ---- Rules ---- */

// Returns why one more copy of `card` can't go into `deckList`, or null if it can.
function getDeckRuleViolation(deckList, card) {
    if (countDeckList(deckList) + 1 > DECK_LIMIT) {
        return `Decks are limited to ${DECK_LIMIT} cards.`;
    }
    // every art of a card counts toward the same copy limit
    const baseId = card.altOf || card.id;
    let copies = 0;
    for (let id in deckList) if (artBaseId(id) === baseId) copies += deckList[id];
    if (card.rarity === "Mythic" || card.rarity === "Legendary") {
        if (copies > 0) return `Only 1 copy of ${card.name} allowed per deck.`;
    } else if (copies >= MAX_COPIES_PER_CARD) {
        return `Max ${MAX_COPIES_PER_CARD} copies of any card per deck.`;
    }
    const rarityLimit = deckRarityRestrictions[card.rarity];
    if (rarityLimit !== undefined && getRarityCount(deckList, card.rarity) + 1 > rarityLimit) {
        return `Max ${rarityLimit} ${card.rarity} cards per deck.`;
    }
    return null;
}

function getRarityCount(deckList, rarity) {
    let count = 0;
    for (let id in deckList) {
        if (getObjectById(cards, id)?.rarity === rarity) count += deckList[id];
    }
    return count;
}

function countDeckList(deckList) {
    let count = 0;
    for (let id in deckList) count += deckList[id];
    return count;
}

/* ---- Share codes ---- */

function encodeDeckCode(deck) {
    const json = JSON.stringify({ n: deck.name, c: deck.deckList });
    const bytes = new TextEncoder().encode(json);
    return DECK_CODE_PREFIX + btoa(String.fromCharCode(...bytes));
}

function decodeDeckCode(code) {
    const trimmed = code.trim();
    if (!trimmed.startsWith(DECK_CODE_PREFIX)) return null;
    try {
        const bytes = Uint8Array.from(atob(trimmed.slice(DECK_CODE_PREFIX.length)), ch => ch.charCodeAt(0));
        const data = JSON.parse(new TextDecoder().decode(bytes));
        if (typeof data !== "object" || typeof data.c !== "object") return null;
        return { name: String(data.n || "Imported Deck"), deckList: data.c };
    } catch {
        return null;
    }
}

deckBuilderShareButton.addEventListener("click", async () => {
    const code = encodeDeckCode(activeDeck);
    try {
        await navigator.clipboard.writeText(code);
        showToast("Deck code copied to clipboard.", "success");
    } catch {
        await showInput("Copy this deck code:", "", code, { type: "text" });
    }
});

async function importDeck() {
    if (!currentProfile) {
        showToast("Log in to import a deck.", "error");
        return;
    }
    const code = await showInput("Paste a deck code to import:", "DTCG1.…", "", { type: "text" });
    if (code === null) return;
    const parsed = decodeDeckCode(code);
    if (!parsed) {
        showToast("That doesn't look like a valid deck code.", "error");
        return;
    }

    // Rebuild the list against your own binder and the deck rules.
    const deckList = {};
    let wanted = 0, skippedMissing = 0, skippedRules = 0;
    for (const [id, qty] of Object.entries(parsed.deckList)) {
        const card = getObjectById(cards, id);
        const count = Math.max(0, Math.floor(Number(qty) || 0));
        wanted += count;
        for (let i = 0; i < count; i++) {
            if (!card || card.class === "Sleeve" || (deckList[id] || 0) >= (binder[id] || 0)) { skippedMissing++; continue; }
            if (getDeckRuleViolation(deckList, card)) { skippedRules++; continue; }
            deckList[id] = (deckList[id] || 0) + 1;
        }
    }

    createDeck(parsed.name, deckList);
    const added = countDeckList(deckList);
    if (added === wanted) {
        showToast(`Imported "${parsed.name}" (${added} cards).`, "success");
    } else {
        const reasons = [];
        if (skippedMissing) reasons.push(`${skippedMissing} not in your binder`);
        if (skippedRules) reasons.push(`${skippedRules} over deck limits`);
        showToast(`Imported ${added} of ${wanted} cards (${reasons.join(", ")}).`, "info");
    }
}

/* ---- Header controls ---- */

let deckNameSaveTimer = null;
deckBuilderNameEntry.addEventListener("input", () => {
    activeDeck.name = deckBuilderNameEntry.value;
    clearTimeout(deckNameSaveTimer);
    deckNameSaveTimer = setTimeout(() => saveActiveDeck(), 500);
});
deckBuilderNameEntry.addEventListener("blur", () => {
    if (activeDeck) { clearTimeout(deckNameSaveTimer); saveActiveDeck(); }
});

deckBuilderBackButton.addEventListener("click", () => {
    buildDecks();
    decksContainer.style.display = "";
    deckBuilderContainer.style.display = "none";
});

deckBuilderDeleteButton.addEventListener("click", async () => {
    const confirmed = await showConfirm(`Delete <strong>${escapeHTML(activeDeck.name)}</strong>? This cannot be undone.`, { confirmLabel: "Delete" });
    if (!confirmed) return;

    decks = decks.filter(d => d.id !== activeDeck.id);
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({ decks: decks });
    buildDecks();
    decksContainer.style.display = "";
    deckBuilderContainer.style.display = "none";
    showToast(`"${activeDeck.name}" deleted.`, "success");
});

/* ---- Binder panel filters ---- */

function applyDeckBuilderFilters() {
    const search = deckBuilderBinderSearch.value.trim().toLowerCase();
    const cls    = deckBuilderBinderFilter.value;
    const rarity = deckBuilderRarityFilter.value;
    const type   = deckBuilderTypeFilter.value;
    deckBuilderBinderList.querySelectorAll(".card").forEach(img => {
        const card = getObjectById(cards, img.dataset.cardId);
        const show = card
            && cardMatchesSearch(card, search)
            && (!cls    || card.class === cls)
            && (!rarity || card.rarity === rarity)
            && (!type   || card.type === type);
        img.parentElement.style.display = show ? "" : "none";
    });
}

deckBuilderBinderSearch.addEventListener("input", applyDeckBuilderFilters);
[deckBuilderBinderFilter, deckBuilderRarityFilter, deckBuilderTypeFilter].forEach(sel => {
    sel.addEventListener("change", applyDeckBuilderFilters);
});

function saveActiveDeck() {
    if (!activeDeck || !currentProfile) return;
    for (let d in decks) {
        if (decks[d].id === activeDeck.id) {
            decks[d] = activeDeck;
            break;
        }
    }
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({ decks: decks });
}

function getCountActiveDeck() {
    return countDeckList(activeDeck.deckList);
}

function getCountDeck(deck) {
    return countDeckList(deck.deckList);
}

// After a card's binder count drops, no deck may hold more copies than you own.
function trimDecksToBinder(cardID) {
    const owned = binder[cardID] || 0;
    const trimmed = [];
    decks.forEach(deck => {
        const inDeck = deck.deckList[cardID] || 0;
        if (inDeck <= owned) return;
        if (owned > 0) deck.deckList[cardID] = owned;
        else delete deck.deckList[cardID];
        if (deck.icon === cardID && !deck.deckList[cardID]) delete deck.icon;
        trimmed.push(deck.name);
    });
    if (!trimmed.length) return;
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({ decks: decks });
    buildDecks();
    const name = getObjectById(cards, cardID)?.name ?? 'that card';
    showToast(`Trimmed ${name} in ${trimmed.join(', ')} to match your binder.`, 'info');
}

function deleteAllDecks() {
    decks = [];
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({ decks: decks });
}
