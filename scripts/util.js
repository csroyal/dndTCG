let cards;
let packs;
let binder = {};
let goldenTickets = {};
let decks = [];
let sleeve = {};
let isAdmin = false;
let blisters = {};   // promo card id -> { opened, at, from, openedAt }

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Anything that needs card/pack data (e.g. loading a profile) waits on this.
const dataReady = Promise.all([
    fetch("./data/cards.json").then(res => res.json()),
    fetch("./data/packs.json").then(res => res.json()),
]).then(([cardData, packData]) => {
    // Alternate arts are listed as { id, altOf }: the same card as `altOf`, with a different front.
    // Each one is its own collectible, so it gets a full copy of the original's data under its own id.
    cards = cardData.map(c => {
        if (!c.altOf) return c;
        const { forms, ...original } = getObjectById(cardData, c.altOf);
        return { ...original, ...c };
    });
    packs = packData;
    buildBinder(cards, packs);
});


let menuButtons = document.querySelectorAll("#menu .menu-button");
let cardViewModalContainer = document.getElementById("cardViewModalContainer");
let cardViewImg = cardViewModalContainer.querySelector("img");
let cardViewControls = document.querySelector(".card-view-controls");

function setActiveNav(sectionId) {
    menuButtons.forEach(btn => {
        const isActive = btn.dataset.section === sectionId;
        btn.classList.toggle("active-nav", isActive);
        if (isActive) btn.setAttribute("aria-current", "page");
        else btn.removeAttribute("aria-current");
    });
}

// the admin page waits for an admin login before it can be shown
const storedSection = localStorage.getItem("DND_TCG_LATEST_SECTION");
if (storedSection && !["adminSection", "spectateSection"].includes(storedSection) && document.getElementById(storedSection)) {
    document.querySelector("#sectionsContainer .section.active").classList.remove("active");
    document.querySelector(`#sectionsContainer #${storedSection}`).classList.add("active");
    setActiveNav(storedSection);
} else {
    setActiveNav("homeSection");
}

menuButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelector("#sectionsContainer .section.active").classList.remove("active");
        document.querySelector(`#sectionsContainer #${btn.dataset.section}`).classList.add("active");
        localStorage.setItem("DND_TCG_LATEST_SECTION", btn.dataset.section);
        setActiveNav(btn.dataset.section);
    });
});

function profileDoc(profileName) {
    return db.collection("profiles").doc(toKebabCase(profileName));
}

// `prefetchedDoc` lets the login flow reuse the snapshot it already fetched.
function loadProfile(profileName, prefetchedDoc = null) {
    const docPromise = prefetchedDoc ? Promise.resolve(prefetchedDoc) : profileDoc(profileName).get();
    Promise.all([dataReady, docPromise]).then(([, doc]) => {
        if (!doc.exists) {
            showToast(`Profile "${profileName}" no longer exists.`, "error");
            unloadProfile();
            return;
        }
        const data = doc.data();

        currentProfile = profileName;
        localStorage.setItem("DND_TCG_LATEST_PROFILE", profileName);
        document.querySelector("#profileInfo p span").textContent = profileName;
        document.querySelector("#profileInfo").style.display = "flex";
        document.querySelector("#profileLogin").style.display = "none";

        if (data.profilePictureURL) {
            document.querySelector("#profileIcon i").style.display = "none";
            document.querySelector("#profilePictureImage").src = data.profilePictureURL;
            document.querySelector("#profilePictureImage").style.display = "block";
        }

        // Reset everything so nothing leaks over from a previous profile.
        binder        = data.binder || {};
        goldenTickets = data.goldenTickets || {};
        decks         = data.decks || [];
        sleeve        = data.sleeve || {};
        blisters      = data.blisters || {};
        setAdmin(data.isAdmin === true);

        buildBinder(cards, packs);
        buildPacks();
        buildDecks();
        buildSleeve();
        restoreOrStartSimulator(data.battle);
        battleLog = data.battleLog || [];
        queueBattleCommands(data.battleCommands);

        profileDoc(profileName).update({ lastSeen: Date.now() }).catch(() => {});
        watchOwnProfile(profileName);
        queueGifts(data.gifts);
    }).catch((error) => {
        console.error("Error loading profile:", error);
        showToast("Couldn't load that profile.", "error");
    });
}

function createProfile(profileName) {
    profileDoc(profileName).set({
        name: profileName,
        goldenTickets: {}
    }).then(() => {
        showToast(`Profile "${profileName}" created.`, "success");
        loadProfile(profileName);
    })
    .catch((error) => {
        console.error("Error writing document: ", error);
        showToast("Couldn't create that profile.", "error");
    });
}

/* ---- Live sync: pick up changes made to this profile elsewhere (an admin's gift, another tab) ---- */

// Deep equality that ignores key order: Firestore hands maps back with their keys sorted,
// while local objects keep insertion order, so a plain JSON.stringify comparison misfires.
function stableStringify(value) {
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    if (value && typeof value === 'object') {
        return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
    }
    return JSON.stringify(value);
}
const sameData = (a, b) => stableStringify(a) === stableStringify(b);

let stopWatchingProfile = null;
let remoteRefreshTimer = null;

function watchOwnProfile(profileName) {
    stopWatchingProfile?.();
    // includeMetadataChanges: without it Firestore never re-sends a change this same client wrote
    // once the server confirms it, so edits made from this device (an admin gifting themselves,
    // another tab) would be skipped below and only show up after a refresh.
    stopWatchingProfile = profileDoc(profileName).onSnapshot({ includeMetadataChanges: true }, (doc) => {
        if (!doc.exists || currentProfile !== profileName) return;
        const data = doc.data();
        // gifts can pop up straight away, even from an unconfirmed copy (they're de-duplicated by id);
        // a new gift explains itself, so it also skips the generic "collection updated" toast
        const giftArrived = queueGifts(data.gifts);
        queueBattleCommands(data.battleCommands);
        // everything else waits for the server's copy, so our own in-flight saves can't be undone by an echo
        if (doc.metadata.hasPendingWrites) return;
        const changed = [];
        if (!sameData(data.binder || {}, binder)) { binder = data.binder || {}; changed.push('binder'); }
        if (!sameData(data.goldenTickets || {}, goldenTickets)) { goldenTickets = data.goldenTickets || {}; changed.push('tickets'); }
        if (!sameData(data.decks || [], decks)) { decks = data.decks || []; changed.push('decks'); }
        if (!sameData(data.blisters || {}, blisters)) { blisters = data.blisters || {}; changed.push('blisters'); }
        if ((data.isAdmin === true) !== isAdmin) { setAdmin(data.isAdmin === true); changed.push('admin'); }
        if (!changed.length) return;
        clearTimeout(remoteRefreshTimer);
        remoteRefreshTimer = setTimeout(() => refreshAfterRemoteChange(changed, giftArrived), 150);
    }, (error) => {
        // reconnect after a dropped listener rather than going quietly out of sync
        console.warn('profile sync stopped, retrying', error);
        setTimeout(() => { if (currentProfile === profileName) watchOwnProfile(profileName); }, 5000);
    });
}

// Coming back to the tab: check for gifts that arrived while it was hidden or offline.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !currentProfile) return;
    const name = currentProfile;
    profileDoc(name).get().then(doc => { if (currentProfile === name && doc.exists) queueGifts(doc.data().gifts); }).catch(() => {});
});

function refreshAfterRemoteChange(changed, quiet = false) {
    // don't yank the board out from under an open pack or the deck builder
    const packOpen = packOpeningModalContainer.classList.contains('active');
    const builderOpen = deckBuilderContainer.style.display === 'flex';
    if (changed.includes('binder') || changed.includes('tickets')) {
        buildBinder(cards, packs);
        buildSleeve();
    }
    if (!packOpen && ['binder', 'tickets', 'blisters'].some(k => changed.includes(k))) buildPacks();
    if (changed.includes('decks') || changed.includes('binder')) {
        if (!builderOpen) buildDecks();
        else if (activeDeck) {
            activeDeck = decks.find(d => d.id === activeDeck.id) || activeDeck;
            loadDeck(activeDeck);
        }
    }
    if (!quiet && (changed.includes('binder') || changed.includes('tickets'))) showToast('Your collection was updated.', 'info');
}

function setAdmin(value) {
    isAdmin = value;
    document.querySelectorAll(".admin-only").forEach(el => { el.hidden = !value; });
    // losing admin while on the admin page sends you home
    if (!value && ["adminSection", "spectateSection"].some(id => document.getElementById(id)?.classList.contains("active"))) {
        document.querySelector('#menu .menu-button[data-section="homeSection"]').click();
    }
    if (!value && typeof adminPanel !== "undefined" && adminPanel) adminPanel.classList.remove("active");
}

function unloadProfile() {
    stopWatchingProfile?.();
    stopWatchingProfile = null;
    clearGifts();
    clearBattleCommands();
    currentProfile = null;
    localStorage.removeItem("DND_TCG_LATEST_PROFILE");
    setAdmin(false);

    document.querySelector("#profileInfo").style.display = "none";
    document.querySelector("#profileLogin").style.display = "flex";
    document.querySelector("#profileIcon i").style.display = "block";
    const pic = document.querySelector("#profilePictureImage");
    pic.style.display = "none";
    pic.removeAttribute("src");
    profileEntryInput.value = "";

    binder = {};
    goldenTickets = {};
    decks = [];
    sleeve = {};
    blisters = {};
    activeDeck = null;

    if (cards && packs) buildBinder(cards, packs);
    packsWrapper.style.display = "none";
    buildPullHistory();
    decksContainer.innerHTML = '';
    decksContainer.style.display = "";
    deckBuilderContainer.style.display = "none";
    activeSleeve.innerHTML = '';
    if (cards) buildSleeve();
    resetSimulator({ openDeckSelect: false }); // the saved game stays put for next login
    simulatorDeckSelect.innerHTML = '';
}

// A small ⓘ button that opens card details; for tiles whose click does something else.
function createCardInfoButton(card) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-info-button";
    btn.innerHTML = `<i class="bi bi-info-lg"></i>`;
    btn.setAttribute("aria-label", `View details for ${card.name}`);
    btn.title = "View card details";
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openInCardViewModal(card.id);
    });
    return btn;
}

function createCardEl(card, func, includeBadge = true, sleeveCount = false, showInfo = false) {
    let cardWrapper = document.createElement("div");
    cardWrapper.classList.add("card-wrapper");

    if (!card) {
        let missing = document.createElement("div");
        missing.classList.add("missing-card");
        missing.textContent = "Missing card data";
        cardWrapper.append(missing);
        return cardWrapper;
    }

    let cardEl = document.createElement("img");
    cardEl.src = "./assets/card-art/" + card.id + ".jpg";
    cardEl.alt = card.name;
    cardEl.loading = "lazy";
    cardEl.classList.add("card");
    cardEl.setAttribute("draggable", false);
    makeActivatable(cardEl);
    cardEl.setAttribute("data-card-id", card.id);
    cardEl.setAttribute("data-name", card.name.toLowerCase());
    cardEl.setAttribute("data-card-class", card.class);
    cardEl.setAttribute("data-rarity", card.rarity);

    let ownershipBadge = document.createElement("div");
    ownershipBadge.classList.add("badge");
    ownershipBadge.innerHTML = "0";

    if (includeBadge) {
        if (binder && binder[card.id] && binder[card.id] >= 1) {
            cardEl.classList.add("owned");
            ownershipBadge.innerHTML = binder[card.id];
        }
        cardWrapper.append(ownershipBadge);
    } else {
        cardEl.classList.add("owned");
    }

    if (sleeveCount) {
        let sleeveOverlay = document.createElement("div");
        sleeveOverlay.classList.add("sleeve-overlay");
        sleeveOverlay.innerHTML = `
            <div>
                <span>0</span> / ${binder[card.id]}
            </div>
            <div class='plus-minus-button'>
                <div>-</div>
                <div>+</div>
            </div>
        `;

        sleeveOverlay.querySelector(".plus-minus-button div:nth-child(1)").addEventListener("click", () => {
            let span = sleeveOverlay.querySelector("span");
            span.innerHTML = Number(span.innerHTML) - 1;

            if (sleeve[card.id]) sleeve[card.id] = sleeve[card.id] - 1;
            if (sleeve[card.id] === 0) delete sleeve[card.id];
            db.collection("profiles").doc(toKebabCase(currentProfile)).update({
                sleeve: sleeve
            });
            refreshSleeveStats();

            if (Number(span.innerHTML) === 0) {
                sleeveOverlay.style.display = "none";
            }
        });

        sleeveOverlay.querySelector(".plus-minus-button div:nth-child(2)").addEventListener("click", () => {
            addCardToSleeve(card, sleeveOverlay);
        });


        cardWrapper.append(sleeveOverlay);
    }

    if (card.altOf) cardWrapper.append(altArtChip());
    setHolo(cardWrapper, card.rarity);

    cardEl.addEventListener("click", func);

    cardEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openInCardViewModal(card.id);
    });

    if (showInfo) {
        cardWrapper.append(createCardInfoButton(card));
        cardEl.addEventListener("keydown", (e) => {
            if (e.key === "i" || e.key === "I") openInCardViewModal(card.id);
        });
    }

    cardWrapper.append(cardEl);

    return cardWrapper;
}

let cardViewCountDisplay = document.getElementById("cardViewCountDisplay");
let cardViewCountDecrease = document.getElementById("cardViewCountDecrease");
let cardViewCountIncrease = document.getElementById("cardViewCountIncrease");
let cardViewFormsEl  = document.getElementById("cardViewForms");
let cardViewFormLabel = document.getElementById("cardViewFormLabel");
let cardViewFormPrev = document.getElementById("cardViewFormPrev");
let cardViewFormNext = document.getElementById("cardViewFormNext");
let cardViewLabel = document.querySelector(".card-view-label");

let _cardFormForms = null;
let _cardFormIdx   = 0;

function getCardForms(cardID) {
    const card = getObjectById(cards, cardID);
    if (card && card.forms) return card.forms;
    const base = cards.find(c => c.forms && c.forms.includes(cardID));
    return base ? base.forms : null;
}

// Alternate forms are the same physical card as their base, so they share the base's copies:
// owning the base unlocks every form. Returns the id whose binder count applies to `cardID`.
function ownershipId(cardID) {
    const base = cards.find(c => c.forms && c.forms.includes(cardID));
    return base ? base.id : cardID;
}

function ownedCopies(cardID) {
    return (binder && binder[ownershipId(cardID)]) || 0;
}

// Alternate arts play as the card they reprint: deck limits and effects go by this id.
function artBaseId(cardID) {
    return getObjectById(cards, cardID)?.altOf || cardID;
}

// "Wolf (Alt Art)", for lists where the two arts would otherwise share a name.
function cardLabel(card) {
    return card.altOf ? `${card.name} (Alt Art)` : card.name;
}

// Search boxes match a card's name and all of its rules text; every word typed has to appear somewhere.
const _cardSearchText = new WeakMap();
function cardMatchesSearch(card, query) {
    const words = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    let text = _cardSearchText.get(card);
    if (text === undefined) {
        const info = card.summonInfo || {};
        const abilities = [...(info.traits || []), ...(info.actions || []), ...(info.bonusActions || []), ...(info.reactions || [])];
        text = [card.name, card.class, card.type, ...(card.tags || []), card.description, card.reaction, info.specialSummon,
            ...abilities.flatMap(a => [a.name, a.description])].filter(Boolean).join('\n').toLowerCase();
        _cardSearchText.set(card, text);
    }
    return words.every(w => text.includes(w));
}

function altArtChip() {
    const chip = document.createElement("div");
    chip.className = "alt-art-chip";
    chip.title = "Alternate art";
    chip.innerHTML = '<i class="bi bi-stars"></i>Alt';
    return chip;
}

function _applyCardViewCard(cardID) {
    cardViewImg.src = "./assets/card-art/" + cardID + ".jpg";
    cardViewImg.setAttribute("data-card-id", cardID);
    cardViewImg.setAttribute("data-rarity", getObjectById(cards, cardID).rarity);
    setHolo(cardViewImg.parentElement, getObjectById(cards, cardID).rarity);
    const countId = ownershipId(cardID);
    cardViewImg.dataset.countId = countId; // the +/- buttons change the base card's count
    const ownedCount = ownedCopies(cardID);
    cardViewCountDisplay.textContent = ownedCount;
    cardViewLabel.textContent = countId !== cardID ? `Owned (as ${getObjectById(cards, countId)?.name ?? countId})`
        : getObjectById(cards, cardID)?.altOf ? "Owned (alt art)" : "Owned";
    updateCardViewButtons(ownedCount, cardID);
    cardViewImg.classList.toggle("owned", ownedCount >= 1);
}

function openInCardViewModal(cardID) {
    playSound("draw");
    _applyCardViewCard(cardID);
    cardViewImg.alt = getObjectById(cards, cardID)?.name ?? "";

    let activeSection = document.querySelector("#sectionsContainer .section.active");
    cardViewControls.style.display = activeSection && activeSection.id === "binderSection" ? "flex" : "none";

    const forms = getCardForms(cardID);
    if (forms && forms.length > 1) {
        _cardFormForms = forms;
        _cardFormIdx   = forms.indexOf(cardID);
        cardViewFormLabel.textContent = `${_cardFormIdx + 1} / ${forms.length}`;
        cardViewFormsEl.style.display = 'flex';
    } else {
        _cardFormForms = null;
        cardViewFormsEl.style.display = 'none';
    }

    cardViewModalContainer.classList.add("active");
}

cardViewFormPrev.addEventListener("click", () => {
    if (!_cardFormForms) return;
    _cardFormIdx = (_cardFormIdx - 1 + _cardFormForms.length) % _cardFormForms.length;
    playSound("draw");
    _applyCardViewCard(_cardFormForms[_cardFormIdx]);
    cardViewFormLabel.textContent = `${_cardFormIdx + 1} / ${_cardFormForms.length}`;
});

cardViewFormNext.addEventListener("click", () => {
    if (!_cardFormForms) return;
    _cardFormIdx = (_cardFormIdx + 1) % _cardFormForms.length;
    playSound("draw");
    _applyCardViewCard(_cardFormForms[_cardFormIdx]);
    cardViewFormLabel.textContent = `${_cardFormIdx + 1} / ${_cardFormForms.length}`;
});

function updateCardViewButtons(count, cardID) {
    cardViewCountDecrease.disabled = count <= 0;
    cardViewCountIncrease.disabled = false;
    cardViewCountDecrease.title = count > 0 ? "Remove one copy" : "No copies to remove";
    cardViewCountIncrease.title = "Add one copy";
}

cardViewCountDecrease.addEventListener("click", () => {
    let cardID = cardViewImg.dataset.countId || cardViewImg.dataset.cardId;
    let currentCount = binder[cardID] || 0;
    if (currentCount <= 0) return;
    currentCount--;
    if (currentCount > 0) binder[cardID] = currentCount;
    else delete binder[cardID];
    trimDecksToBinder(cardID);
    cardViewCountDisplay.textContent = currentCount;
    updateCardViewButtons(currentCount, cardID);
    cardViewImg.classList.toggle("owned", currentCount > 0);
    updateBinderCardDisplay(cardID, currentCount);
    if (currentProfile) {
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({ binder: binder });
    }
});

cardViewCountIncrease.addEventListener("click", () => {
    let cardID = cardViewImg.dataset.countId || cardViewImg.dataset.cardId;
    let currentCount = binder[cardID] || 0;
    currentCount++;
    binder[cardID] = currentCount;
    cardViewCountDisplay.textContent = currentCount;
    updateCardViewButtons(currentCount, cardID);
    cardViewImg.classList.add("owned");
    updateBinderCardDisplay(cardID, currentCount);
    if (currentProfile) {
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({ binder: binder });
    }
});

function updateBinderCardDisplay(cardID, count) {
    refreshCollectionTotal();
    // Update all card instances (pack view and flat view both render the same card)
    document.querySelectorAll(`.card-wrapper:has(img[data-card-id="${cardID}"])`).forEach(cardWrapper => {
        let badge = cardWrapper.querySelector(".badge");
        if (badge) {
            badge.textContent = count;
        }
        let cardEl = cardWrapper.querySelector(".card");
        if (count > 0) cardEl.classList.add("owned");
        else cardEl.classList.remove("owned");
    });

    // update pack owned counts
    document.querySelectorAll(".pack-container").forEach(pack => {
        let cardEls = pack.querySelectorAll(".card-wrapper");
        let ownedCards = 0;
        cardEls.forEach(wrapper => {
            let id = wrapper.querySelector("img.card").dataset.cardId;
            if (binder[id] && binder[id] >= 1) ownedCards++;
        });
        let packCount = pack.querySelector(".pack-header > div:last-child");
        if (packCount) {
            let total = cardEls.length;
            packCount.innerHTML = `<i class="bi bi-file-richtext"></i> <span>${ownedCards}</span> / ${total}`;
        }
    });

    // update flat view rarity counts
    document.querySelectorAll(".binder-rarity-section").forEach(section => {
        let wrappers = section.querySelectorAll(".card-wrapper");
        let owned = 0;
        wrappers.forEach(w => {
            let id = w.querySelector("img.card")?.dataset.cardId;
            if (id && binder[id] && binder[id] >= 1) owned++;
        });
        let countEl = section.querySelector(".binder-rarity-count");
        if (countEl) countEl.innerHTML = `<i class="bi bi-file-richtext"></i> ${owned} / ${wrappers.length}`;
    });
}

cardViewModalContainer.addEventListener("click", (e) => {
    if (e.target.id !== "cardViewModalContainer") return;
    if ((cardViewModalContainer).classList.contains("active")) {
        cardViewModalContainer.classList.remove("active");
        cardViewImg.classList.remove("back");
    }
});

cardViewImg.addEventListener("click", () => {
    let card = getObjectById(cards, cardViewImg.dataset.cardId);
    if (card.class !== "Utility") {
        playSound("flip");
        if (cardViewImg.classList.contains("back")) {
            cardViewImg.src = "./assets/card-art/" + card.id + ".jpg";
        } else {
            cardViewImg.src = "./assets/card-art/" + (card.altOf || card.id) + "-back.jpg"; // alt arts share the original's back
        }
        cardViewImg.classList.toggle("back");
    }
});

/* ---- Holo sheen on Legendary and Mythic cards ----
   Each card's light drifts slowly on its own phase; while the pointer is over a card the light
   follows the pointer instead, and eases back when it leaves. Only cards on screen are animated. */
const CARD_SHINE_KEY = 'DND_TCG_CARD_SHINE';
let cardShineOn = localStorage.getItem(CARD_SHINE_KEY) !== 'off';
const _holoState = new WeakMap();
const _holoVisible = new Set();
let _holoHovered = null;
let _holoRaf = 0;
const _holoObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
        if (e.isIntersecting) _holoVisible.add(e.target);
        else _holoVisible.delete(e.target);
    }
    _holoKick();
});

// Give an element its rarity's sheen (or take it away); safe to call again when its card changes.
function setHolo(el, rarity) {
    const kind = rarity === 'Mythic' ? 'mythic' : rarity === 'Legendary' ? 'legendary' : null;
    el.classList.toggle('holo', !!kind);
    el.classList.toggle('holo-mythic', kind === 'mythic');
    el.classList.toggle('holo-legendary', kind === 'legendary');
    if (kind) {
        if (!_holoState.has(el)) _holoState.set(el, { x: 50, y: 50, i: 0.7, px: 50, py: 50, phase: Math.random() * Math.PI * 2 });
        _holoObserver.observe(el);
    } else {
        _holoObserver.unobserve(el);
        _holoVisible.delete(el);
    }
}

function _holoKick() {
    if (!_holoRaf && cardShineOn && !prefersReducedMotion.matches && _holoVisible.size) _holoRaf = requestAnimationFrame(_holoFrame);
}

function _holoFrame(now) {
    _holoRaf = 0;
    const t = now / 1000;
    for (const el of _holoVisible) {
        if (!el.isConnected) { _holoVisible.delete(el); continue; }
        const s = _holoState.get(el);
        const hover = el === _holoHovered;
        // idle: a slow figure-of-eight across the card
        const tx = hover ? s.px : 50 + 40 * Math.sin(t * 0.38 + s.phase);
        const ty = hover ? s.py : 50 + 30 * Math.sin(t * 0.27 + s.phase * 1.7);
        const ease = hover ? 0.16 : 0.05;
        s.x += (tx - s.x) * ease;
        s.y += (ty - s.y) * ease;
        s.i += ((hover ? 1 : 0.7) - s.i) * 0.08;
        el.style.setProperty('--holo-x', s.x.toFixed(1) + '%');
        el.style.setProperty('--holo-y', s.y.toFixed(1) + '%');
        el.style.setProperty('--holo-i', s.i.toFixed(3));
    }
    _holoKick();
}

document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.holo');
    _holoHovered = el && _holoState.has(el) ? el : null;
    if (!_holoHovered) return;
    const r = el.getBoundingClientRect();
    const s = _holoState.get(el);
    s.px = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    s.py = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { _holoHovered = null; });
prefersReducedMotion.addEventListener?.('change', _holoKick);

function setCardShine(on) {
    cardShineOn = on;
    localStorage.setItem(CARD_SHINE_KEY, on ? 'on' : 'off');
    document.documentElement.classList.toggle('no-card-shine', !on);
    document.querySelectorAll('#cardShineToggle button').forEach(btn => {
        const active = (btn.dataset.shine === 'on') === on;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', String(active));
    });
    _holoKick();
}
document.querySelectorAll('#cardShineToggle button').forEach(btn => {
    btn.addEventListener('click', () => setCardShine(btn.dataset.shine === 'on'));
});
setCardShine(cardShineOn);

/* ---- Sound effects volume (0–100, 0 = silent) ---- */
const SFX_VOLUME_KEY = 'DND_TCG_SFX_VOLUME';
let _sfxVolume = (() => {
    const stored = localStorage.getItem(SFX_VOLUME_KEY);
    if (stored !== null && !isNaN(Number(stored))) return Number(stored);
    // carry over the old mute toggle
    const wasMuted = localStorage.getItem('soundMuted') === 'true';
    localStorage.removeItem('soundMuted');
    return wasMuted ? 0 : 75;
})();

function playSound(soundName) {
    if (_sfxVolume <= 0) return;
    const sound = new Audio(`./assets/sounds/${soundName}.mp3`);
    sound.volume = _sfxVolume / 100;
    sound.play().catch(() => {});
}

function setSfxVolume(value) {
    _sfxVolume = Math.max(0, Math.min(100, Number(value) || 0));
    localStorage.setItem(SFX_VOLUME_KEY, _sfxVolume);
    _renderVolumeControl();
}

function _renderVolumeControl() {
    const slider = document.getElementById('sfxVolume');
    if (!slider) return;
    slider.value = _sfxVolume;
    slider.style.setProperty('--fill', `${_sfxVolume}%`);
    document.getElementById('sfxVolumeValue').textContent = _sfxVolume === 0 ? 'Off' : `${_sfxVolume}%`;
    document.getElementById('sfxVolumeIcon').className =
        _sfxVolume === 0 ? 'bi bi-volume-mute-fill' : _sfxVolume < 50 ? 'bi bi-volume-down-fill' : 'bi bi-volume-up-fill';
}

(function initVolumeControl() {
    const slider = document.getElementById('sfxVolume');
    slider.addEventListener('input', () => setSfxVolume(slider.value));
    slider.addEventListener('change', () => playSound('draw')); // preview at the new level
    _renderVolumeControl();
})();

function getObjectById(arr, id) {
    return arr.find(obj => obj.id === id);
}

function toKebabCase(str) {
    return str
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-");
}

function generateUID() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function isNumeric(str) {
  if (typeof str != "string") return false
  return !isNaN(str) &&
         !isNaN(parseFloat(str))
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { error: 'bi-exclamation-circle-fill', success: 'bi-check-circle-fill', info: 'bi-info-circle-fill', dm: 'bi-shield-fill-exclamation' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span></span>`;
    toast.querySelector("span").textContent = message;
    container.append(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    }, 3200);
}

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// `message` may contain markup; escape any user text with escapeHTML() first.
function showConfirm(message, { confirmLabel = 'Confirm', danger = true } = {}) {
    return new Promise(resolve => {
        const lastFocus = document.activeElement;
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog" role="alertdialog" aria-modal="true">
                <p>${message}</p>
                <div class="confirm-buttons">
                    <button class="btn-ghost confirm-cancel">Cancel</button>
                    <button class="${danger ? 'danger' : 'btn-accent'} confirm-ok">${confirmLabel}</button>
                </div>
            </div>`;
        document.body.append(overlay);
        const close = (result) => {
            overlay.remove();
            document.removeEventListener('keydown', onKey, true);
            lastFocus?.focus?.();
            resolve(result);
        };
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } };
        document.addEventListener('keydown', onKey, true);
        overlay.querySelector('.confirm-cancel').onclick = () => close(false);
        overlay.querySelector('.confirm-ok').onclick    = () => close(true);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
        overlay.querySelector('.confirm-ok').focus();
    });
}

function showInput(message, placeholder = '', defaultValue = '', { type = 'number' } = {}) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        const numberAttrs = type === 'number' ? 'min="1" step="1"' : 'spellcheck="false" autocomplete="off"';
        overlay.innerHTML = `
            <div class="confirm-dialog" role="dialog" aria-modal="true">
                <p>${message}</p>
                <input class="input-modal-field" type="${type}" placeholder="${escapeHTML(placeholder)}" value="${escapeHTML(defaultValue)}" ${numberAttrs}>
                <div class="confirm-buttons">
                    <button class="btn-ghost confirm-cancel">Cancel</button>
                    <button class="btn-accent confirm-ok">OK</button>
                </div>
            </div>`;
        document.body.append(overlay);
        const input = overlay.querySelector('.input-modal-field');
        const close = (result) => { overlay.remove(); resolve(result); };
        requestAnimationFrame(() => { input.focus(); input.select(); });
        overlay.querySelector('.confirm-cancel').onclick = () => close(null);
        overlay.querySelector('.confirm-ok').onclick = () => close(input.value);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') close(input.value);
            if (e.key === 'Escape') { e.stopPropagation(); close(null); }
        });
        overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    });
}

const SIM_BG_NAMES = {
    '':       'Default',
    'stars':  'Starfield',
    'snow':   'Snowfall',
    'arcane': 'Arcane Vault',
    'ember':  'Emberfall',
    'rift':   'Rift',
    'glade':  'Firefly Glade',
    'rain':   'Rainstorm',
    'tavern': 'Hearthside Tavern',
    'aurora': 'Aurora',
    'autumn': 'Autumn Woods',
    'subter': 'Subter',
    'moonsea': 'Moonlit Sea',
    'sunken': 'Sunken Temple',
    'astral': 'Astral Sea',
};

/* ---- Particle canvas engine ---- */
let _simBgCanvas  = null;
let _simBgFrame   = null;
let _simBgActive  = '';
let _simBgGen     = 0; // incremented on each clear to cancel stale rAF callbacks

function _clearSimBg() {
    _simBgGen++;
    if (_simBgFrame)  { cancelAnimationFrame(_simBgFrame); _simBgFrame = null; }
    if (_simBgCanvas) { _simBgCanvas.remove(); _simBgCanvas = null; }
}

// The callback gets W/H in CSS pixels; the backing store is scaled up for crisp HiDPI output.
function _makeCanvas(section, cb) {
    _clearSimBg();
    const gen = _simBgGen;
    const c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1;';
    section.insertBefore(c, section.firstChild);
    requestAnimationFrame(() => {
        if (_simBgGen !== gen) { c.remove(); return; }
        const W = section.clientWidth  || window.innerWidth  - 80;
        const H = section.clientHeight || window.innerHeight - 52;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        c.width  = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        _simBgCanvas = c;
        cb(ctx, W, H, c);
    });
}

// Frame loop that stops on its own once its canvas has been replaced or removed.
function _loop(canvas, draw) {
    function frame(t) {
        if (_simBgCanvas !== canvas) return;
        draw(t);
        _simBgFrame = requestAnimationFrame(frame);
    }
    _simBgFrame = requestAnimationFrame(frame);
}

/* ---- Scenery: layers painted once at load, drawn behind each background's particles ---- */

// A full-size offscreen layer at the screen's pixel density.
function _paintLayer(W, H, paint) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * dpr));
    c.height = Math.max(1, Math.round(H * dpr));
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(g, W, H);
    return c;
}

// A glow layer painted small and scaled up when drawn, which blurs it into soft light.
function _glowLayer(W, H, scale, paint) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(W / scale));
    c.height = Math.max(1, Math.ceil(H / scale));
    const g = c.getContext('2d');
    g.scale(1 / scale, 1 / scale);
    paint(g, W, H);
    return c;
}

function _drawLayer(ctx, layer, x, y, w, h, alpha = 1, op = 'source-over') {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = op;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(layer, x, y, w, h);
    ctx.restore();
}

// Height of a ridge line at x (shared by _ridge, so trees can stand on the crest).
function _ridgeY(x, W, baseY, amp, freq, seed) {
    const u = (x / W) * freq;
    const n = Math.sin(u * 6.1 + seed) * 0.5 + Math.sin(u * 13.7 + seed * 2) * 0.3 + Math.sin(u * 29 + seed * 3) * 0.2;
    return baseY - amp * n;
}

// Rolling hill / mountain silhouette around baseY.
function _ridge(g, W, H, baseY, amp, fill, { freq = 1, seed = Math.random() * 10, jag = 0 } = {}) {
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) {
        g.lineTo(x, _ridgeY(x, W, baseY, amp, freq, seed) - (jag ? Math.random() * jag : 0));
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
}

function _pine(g, x, baseY, h, fill) {
    g.fillStyle = fill;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
        const top = baseY - h + i * h * 0.22, bw = h * 0.36 * (0.45 + i * 0.22);
        g.moveTo(x, top); g.lineTo(x + bw, top + h * 0.36); g.lineTo(x - bw, top + h * 0.36); g.closePath();
    }
    g.fill();
    g.fillRect(x - h * 0.03, baseY - h * 0.12, h * 0.06, h * 0.12);
}

function _softBlob(g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
}

function _startStars(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const TINTS = ['255,255,255', '255,255,255', '210,225,255', '255,236,210'];
        const mkStar = (hero) => ({
            x:     Math.random() * W,
            y:     Math.random() * H,
            r:     hero ? Math.random() * 1.2 + 1.4 : Math.random() * 1.3 + 0.2,
            phase: Math.random() * Math.PI * 2,
            spd:   hero ? Math.random() * 0.01 + 0.002 : Math.random() * 0.016 + 0.003,
            base:  hero ? 0.55 : Math.random() * 0.35 + 0.08,
            tint:  TINTS[Math.floor(Math.random() * TINTS.length)],
            hero,
        });
        const stars = [
            ...Array.from({ length: 240 }, () => mkStar(false)),
            ...Array.from({ length: 12 },  () => mkStar(true)),
        ];
        const meteors = [];
        let meteorCd = 120 + Math.random() * 240;

        // the Milky Way: a diagonal band of soft dust, darker lanes, and dense faint stars
        const along = (t, spread) => {
            const off = (Math.random() + Math.random() + Math.random() - 1.5) * H * spread;
            return [-0.1 * W + t * 1.2 * W + off * 0.45, H * 0.9 - t * H * 0.8 + off];
        };
        const milky = _glowLayer(W, H, 6, (g) => {
            for (let i = 0; i < 900; i++) {
                const [x, y] = along(Math.random(), 0.16);
                _softBlob(g, x, y, 10 + Math.random() * 30, Math.random() < 0.7 ? '190,205,255' : '255,215,195', 0.05);
            }
            g.globalCompositeOperation = 'destination-out';
            for (let i = 0; i < 80; i++) {
                const [x, y] = along(Math.random(), 0.035);
                _softBlob(g, x, y, 14 + Math.random() * 26, '0,0,0', 0.35);
            }
        });
        const bandDots = _paintLayer(W, H, (g) => {
            for (let i = 0; i < 420; i++) {
                const [x, y] = along(Math.random(), 0.12);
                g.fillStyle = `rgba(235,240,255,${(0.15 + Math.random() * 0.35).toFixed(3)})`;
                g.fillRect(x, y, 0.9, 0.9);
            }
        });
        _loop(canvas, () => {
            ctx.clearRect(0, 0, W, H);
            _drawLayer(ctx, milky, 0, 0, W, H, 0.9, 'lighter');
            _drawLayer(ctx, bandDots, 0, 0, W, H, 0.8);
            for (const s of stars) {
                s.phase += s.spd;
                const a = s.base + (Math.sin(s.phase) * 0.5 + 0.5) * (0.9 - s.base);
                if (s.hero) {
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${s.tint},${(a * 0.1).toFixed(3)})`;
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${s.tint},${a.toFixed(3)})`;
                ctx.fill();
            }

            // the occasional shooting star
            if (--meteorCd <= 0) {
                meteors.push({ x: Math.random() * W * 0.7, y: Math.random() * H * 0.35,
                               vx: 7 + Math.random() * 4, vy: 2.5 + Math.random() * 2,
                               life: 0, max: 45 + Math.random() * 20 });
                meteorCd = 300 + Math.random() * 420;
            }
            for (let i = meteors.length - 1; i >= 0; i--) {
                const m = meteors[i];
                m.life++; m.x += m.vx; m.y += m.vy;
                if (m.life >= m.max) { meteors.splice(i, 1); continue; }
                const t = m.life / m.max;
                const a = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
                const tx = m.x - m.vx * 10, ty = m.y - m.vy * 10;
                const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
                g.addColorStop(0, `rgba(255,255,255,${(a * 0.9).toFixed(3)})`);
                g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.strokeStyle = g;
                ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
            }
        });
    });
}

function _startSnow(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        // z = depth: near flakes are bigger, faster, sway more, and look a touch softer
        const flakes = Array.from({ length: 160 }, () => {
            const z = Math.random();
            return {
                x: Math.random() * W, y: Math.random() * H, z,
                r: 0.5 + z * 2.4, spd: 0.25 + z * 0.9, amp: 0.2 + z * 0.5,
                a: 0.25 + z * 0.5, phase: Math.random() * Math.PI * 2,
            };
        });
        // snowy hills fading into the distance, pines on the middle ridge, a moon glow
        const moonGlow = _glowLayer(W, H, 8, (g) => _softBlob(g, W * 0.18, H * 0.08, H * 0.35, '190,210,245', 0.25));
        const hills = _paintLayer(W, H, (g) => {
            _ridge(g, W, H, H * 0.74, H * 0.05, 'rgba(120,145,190,0.16)', { freq: 0.8 });
            const mid = { base: H * 0.82, amp: H * 0.045, freq: 1.1, seed: 3.2 };
            const near = { base: H * 0.92, amp: H * 0.035, freq: 1.4, seed: 7.7 };
            // groves on the middle ridge: [centre, spread, count, height] as fractions of the screen
            const grove = (ridge, cx, spread, count, h, fill) => {
                for (let i = 0; i < count; i++) {
                    const x = W * (cx + (i / Math.max(1, count - 1) - 0.5) * spread + (Math.random() - 0.5) * 0.012);
                    const th = H * h * (0.75 + Math.random() * 0.4) * (1 - Math.abs(i / Math.max(1, count - 1) - 0.5) * 0.5);
                    _pine(g, x, _ridgeY(x, W, ridge.base, ridge.amp, ridge.freq, ridge.seed) + th * 0.08, th, fill);
                }
            };
            _ridge(g, W, H, mid.base, mid.amp, 'rgba(70,92,135,0.28)', mid);
            for (const [cx, spread, count] of [[0.08, 0.1, 5], [0.3, 0.07, 3], [0.55, 0.05, 2], [0.78, 0.09, 4], [0.95, 0.06, 3]]) {
                grove(mid, cx, spread, count, 0.07, 'rgba(40,56,88,0.55)');
            }
            _ridge(g, W, H, near.base, near.amp, 'rgba(26,36,60,0.6)', near);
            // a few big near pines framing each side
            grove(near, 0.03, 0.05, 3, 0.13, 'rgba(18,26,44,0.75)');
            grove(near, 0.97, 0.05, 2, 0.12, 'rgba(18,26,44,0.75)');
            // snow catching the moonlight along the nearest crest, fading in softly
            g.globalCompositeOperation = 'source-atop';
            const shine = g.createLinearGradient(0, H * 0.84, 0, H);
            shine.addColorStop(0, 'rgba(200,220,255,0)');
            shine.addColorStop(0.3, 'rgba(200,220,255,0.1)');
            shine.addColorStop(1, 'rgba(200,220,255,0)');
            g.fillStyle = shine;
            g.fillRect(0, H * 0.84, W, H * 0.16);
        });
        _loop(canvas, (t) => {
            ctx.clearRect(0, 0, W, H);
            _drawLayer(ctx, moonGlow, 0, 0, W, H, 1, 'lighter');
            _drawLayer(ctx, hills, 0, 0, W, H);
            const wind = Math.sin(t * 0.00035) * 0.6 + Math.sin(t * 0.0011) * 0.2;
            for (const f of flakes) {
                f.y     += f.spd;
                f.phase += 0.012 + f.z * 0.01;
                f.x     += Math.sin(f.phase) * f.amp * 0.6 + wind * (0.4 + f.z);
                if (f.y > H + 5) { f.y = -5; f.x = Math.random() * W; }
                if (f.x > W + 5) f.x = -5;
                if (f.x < -5)    f.x = W + 5;
                if (f.z > 0.75) {
                    ctx.beginPath();
                    ctx.arc(f.x, f.y, f.r * 1.9, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(210,230,255,${(f.a * 0.18).toFixed(3)})`;
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(215,232,255,${f.a.toFixed(3)})`;
                ctx.fill();
            }
        });
    });
}

function _startArcane(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const COLS = ['150,80,255', '100,130,255', '200,90,255', '80,190,255', '170,50,230'];
        const mk = () => ({
            x:      Math.random() * W,
            y:      H * 0.4 + Math.random() * H * 0.6,
            r:      Math.random() * 1.6 + 0.4,
            spd:    Math.random() * 0.35 + 0.08,
            phase:  Math.random() * Math.PI * 2,
            life:   Math.random(),
            lifeSpd: Math.random() * 0.004 + 0.001,
            col:    COLS[Math.floor(Math.random() * COLS.length)],
        });
        const particles = Array.from({ length: 65 }, mk);
        const glints = [];
        // a vast, faint sigil turning slowly behind the motes
        const R = Math.min(W, H) * 0.42;
        const sigil = _paintLayer(R * 2, R * 2, (g) => {
            g.translate(R, R);
            g.strokeStyle = 'rgba(200,165,255,1)';
            g.lineWidth = 1.6;
            g.beginPath(); g.arc(0, 0, R * 0.98, 0, Math.PI * 2); g.stroke();
            g.beginPath(); g.arc(0, 0, R * 0.86, 0, Math.PI * 2); g.stroke();
            // rune band between the outer rings
            for (let i = 0; i < 36; i++) {
                g.save(); g.rotate((i / 36) * Math.PI * 2); g.translate(0, -R * 0.92);
                g.beginPath();
                const k = i % 4;
                if (k === 0) { g.moveTo(-4, -4); g.lineTo(4, 4); g.moveTo(4, -4); g.lineTo(-4, 4); }
                else if (k === 1) { g.arc(0, 0, 3.5, 0, Math.PI * 2); }
                else if (k === 2) { g.moveTo(0, -5); g.lineTo(0, 5); g.moveTo(-3, 0); g.lineTo(3, 0); }
                else { g.moveTo(-4, 3); g.lineTo(0, -4); g.lineTo(4, 3); }
                g.stroke(); g.restore();
            }
            // hexagram + inner circle
            for (const off of [0, Math.PI / 3]) {
                g.beginPath();
                for (let i = 0; i <= 3; i++) {
                    const a = off + (i / 3) * Math.PI * 2 - Math.PI / 2;
                    i ? g.lineTo(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78) : g.moveTo(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78);
                }
                g.stroke();
            }
            g.beginPath(); g.arc(0, 0, R * 0.38, 0, Math.PI * 2); g.stroke();
        });
        const sigilGlow = _glowLayer(R * 2, R * 2, 6, (g) => _softBlob(g, R, R, R, '150,90,255', 0.22));
        _loop(canvas, (t) => {
            ctx.clearRect(0, 0, W, H);
            ctx.save();
            ctx.translate(W * 0.5, H * 0.46);
            _drawLayer(ctx, sigilGlow, -R, -R, R * 2, R * 2, 0.8, 'lighter');
            ctx.rotate(t * 0.00002);
            _drawLayer(ctx, sigil, -R, -R, R * 2, R * 2, 0.07 + Math.sin(t * 0.0006) * 0.02);
            ctx.restore();
            for (const p of particles) {
                p.life += p.lifeSpd;
                if (p.life >= 1) { Object.assign(p, mk(), { life: 0 }); continue; }
                const t = p.life;
                const a = t < 0.2 ? t * 5 : t > 0.75 ? (1 - t) * 4 : 1;
                p.y     -= p.spd;
                p.phase += 0.022;
                p.x     += Math.sin(p.phase) * 0.45;
                // soft glow: draw wider translucent ring then sharp core
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.col},${(a * 0.18).toFixed(3)})`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.col},${(a * 0.8).toFixed(3)})`;
                ctx.fill();
            }

            // now and then a mote catches the light as a four-point glint
            if (Math.random() < 0.012) {
                const p = particles[Math.floor(Math.random() * particles.length)];
                glints.push({ x: p.x, y: p.y, col: p.col, life: 0, size: 5 + Math.random() * 6 });
            }
            for (let i = glints.length - 1; i >= 0; i--) {
                const g = glints[i];
                if (++g.life > 34) { glints.splice(i, 1); continue; }
                const a = Math.sin((g.life / 34) * Math.PI);
                const s = g.size * (0.6 + a * 0.4);
                ctx.strokeStyle = `rgba(235,220,255,${(a * 0.85).toFixed(3)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(g.x - s, g.y); ctx.lineTo(g.x + s, g.y);
                ctx.moveTo(g.x, g.y - s); ctx.lineTo(g.x, g.y + s);
                ctx.stroke();
            }
        });
    });
}

function _startEmbers(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const mk = () => ({
            x:      Math.random() * W,
            y:      H + Math.random() * H * 0.3,
            r:      Math.random() * 1.8 + 0.5,
            spd:    Math.random() * 0.55 + 0.18,
            phase:  Math.random() * Math.PI * 2,
            life:   Math.random(),
            lifeSpd: Math.random() * 0.003 + 0.001,
        });
        const embers = Array.from({ length: 60 }, mk);
        // a volcanic range on the horizon, with a glowing, smoking crater
        const crater = { x: W * 0.12, y: H * 0.79 };
        const ranges = _paintLayer(W, H, (g) => {
            _ridge(g, W, H, H * 0.82, H * 0.06, 'rgba(70,22,10,0.45)', { freq: 0.9, jag: 4 });
            g.fillStyle = 'rgba(22,7,4,0.95)';
            g.beginPath();
            g.moveTo(crater.x - W * 0.3, H);
            g.lineTo(crater.x - W * 0.035, crater.y);
            g.lineTo(crater.x - W * 0.012, crater.y + H * 0.012);
            g.lineTo(crater.x + W * 0.012, crater.y + H * 0.008);
            g.lineTo(crater.x + W * 0.035, crater.y);
            g.lineTo(crater.x + W * 0.3, H);
            g.closePath(); g.fill();
            _ridge(g, W, H, H * 0.93, H * 0.04, 'rgba(16,5,3,0.97)', { freq: 1.6, jag: 3 });
            // lava glinting in the crater lip
            g.globalCompositeOperation = 'source-atop';
            _softBlob(g, crater.x, crater.y + 4, W * 0.05, '255,120,40', 0.35);
        });
        const plumes = Array.from({ length: 9 }, (_, i) => ({ life: i / 9, x: 0 }));
        _loop(canvas, (time) => {
            ctx.clearRect(0, 0, W, H);
            const throb = 0.75 + Math.sin(time * 0.0011) * 0.15 + Math.sin(time * 0.0031) * 0.1;
            const lava = ctx.createRadialGradient(crater.x, crater.y, 0, crater.x, crater.y, H * 0.45);
            lava.addColorStop(0, `rgba(255,110,30,${(0.16 * throb).toFixed(3)})`);
            lava.addColorStop(1, 'rgba(255,110,30,0)');
            ctx.fillStyle = lava;
            ctx.fillRect(0, 0, W, H);
            // slow smoke rising from the crater, lit from below
            for (const pl of plumes) {
                pl.life += 0.0012;
                if (pl.life > 1) { pl.life = 0; pl.x = (Math.random() - 0.5) * 20; }
                const y = crater.y - pl.life * H * 0.55, r = 20 + pl.life * H * 0.16;
                const a = Math.sin(Math.PI * pl.life) * 0.07;
                const g = ctx.createRadialGradient(crater.x + pl.x + pl.life * 60, y, 0, crater.x + pl.x + pl.life * 60, y, r);
                g.addColorStop(0, `rgba(${Math.round(120 - pl.life * 70)},${Math.round(60 - pl.life * 30)},40,${a.toFixed(3)})`);
                g.addColorStop(1, 'rgba(40,20,15,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(crater.x + pl.x + pl.life * 60, y, r, 0, Math.PI * 2); ctx.fill();
            }
            _drawLayer(ctx, ranges, 0, 0, W, H);
            const gust = Math.sin(time * 0.0006) * 0.35 + Math.sin(time * 0.0017) * 0.15;
            for (const e of embers) {
                e.life += e.lifeSpd;
                if (e.life >= 1) { Object.assign(e, mk(), { life: 0 }); continue; }
                const t = e.life;
                const a = t < 0.18 ? t / 0.18 : t > 0.65 ? (1 - t) / 0.35 : 1;
                // heat: orange at birth → yellow-white as it rises
                const heat = Math.min(1, t * 1.8);
                const g = Math.floor(90 + heat * 165);
                const b = Math.floor(heat * 70);
                const dx = Math.sin(e.phase) * 0.5 + gust;
                e.y     -= e.spd;
                e.phase += 0.028;
                e.x     += dx;
                // short heat trail
                ctx.strokeStyle = `rgba(255,${g},0,${(a * 0.22).toFixed(3)})`;
                ctx.lineWidth = e.r * 0.9;
                ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - dx * 5, e.y + e.spd * 7); ctx.stroke();
                // glow halo
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.r * 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,${g},0,${(a * 0.12).toFixed(3)})`;
                ctx.fill();
                // core
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,${g},${b},${(a * 0.9).toFixed(3)})`;
                ctx.fill();
            }
        });
    });
}

function _startRift(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const rifts = [];
        let spawnCd = 8 + Math.floor(Math.random() * 15);

        function genRift() {
            const ox = W * 0.12 + Math.random() * W * 0.76;
            const oy = H * 0.12 + Math.random() * H * 0.76;
            let angle = Math.random() * Math.PI * 2;
            const segs = [];

            // Spine
            let x = ox, y = oy;
            const spineLen = 28 + Math.random() * 22;
            const spineN   = 5 + Math.floor(Math.random() * 3);
            for (let i = 0; i < spineN; i++) {
                angle += (Math.random() - 0.5) * 0.55;
                const nx = x + Math.cos(angle) * spineLen;
                const ny = y + Math.sin(angle) * spineLen;
                segs.push({ x1: x, y1: y, x2: nx, y2: ny });
                x = nx; y = ny;
            }

            // Branches off the spine
            const spineSnap = segs.slice();
            const numBranches = 2 + Math.floor(Math.random() * 2);
            for (let b = 0; b < numBranches; b++) {
                const pivot = spineSnap[Math.floor(Math.random() * spineSnap.length)];
                let ba = Math.atan2(pivot.y2 - pivot.y1, pivot.x2 - pivot.x1) +
                         (Math.random() < 0.5 ? 1 : -1) * (0.65 + Math.random() * 0.7);
                let bx = pivot.x2, by = pivot.y2;
                const bLen = 18 + Math.random() * 14;
                const bN   = 3 + Math.floor(Math.random() * 2);
                for (let j = 0; j < bN; j++) {
                    ba += (Math.random() - 0.5) * 0.4;
                    const nbx = bx + Math.cos(ba) * bLen;
                    const nby = by + Math.sin(ba) * bLen;
                    segs.push({ x1: bx, y1: by, x2: nbx, y2: nby });
                    bx = nbx; by = nby;
                }
            }

            // Cumulative lengths for progressive draw
            let cum = 0;
            for (const s of segs) {
                s.len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
                cum += s.len;
                s.cum = cum;
            }
            return { segs, total: cum, ox, oy, hue: 200 + Math.random() * 80 };
        }

        // a slow violet vortex swirling behind the cracks
        const VR = Math.min(W, H) * 0.55;
        const vortex = _glowLayer(VR * 2, VR * 2, 9, (g) => {
            for (let arm = 0; arm < 4; arm++) {
                for (let s = 0; s < 220; s++) {
                    const f = s / 220, a = arm * Math.PI / 2 + f * 5.2;
                    _softBlob(g, VR + Math.cos(a) * f * VR, VR + Math.sin(a) * f * VR, 24 + f * 60, f < 0.5 ? '170,120,255' : '90,140,255', 0.035 * (1 - f));
                }
            }
            _softBlob(g, VR, VR, VR * 0.25, '230,210,255', 0.12);
        });
        _loop(canvas, (t) => {
            ctx.clearRect(0, 0, W, H);
            ctx.save();
            ctx.translate(W * 0.5, H * 0.45);
            ctx.rotate(-t * 0.00004);
            _drawLayer(ctx, vortex, -VR, -VR, VR * 2, VR * 2, 0.6 + Math.sin(t * 0.0005) * 0.12, 'lighter');
            ctx.restore();

            if (--spawnCd <= 0 && rifts.length < 6) {
                rifts.push({ ...genRift(), life: 0, maxLife: 160 + Math.floor(Math.random() * 100) });
                spawnCd = 45 + Math.floor(Math.random() * 70);
            }

            for (let i = rifts.length - 1; i >= 0; i--) {
                const r = rifts[i];
                r.life++;
                if (r.life >= r.maxLife) { rifts.splice(i, 1); continue; }

                const GROW = 38, FADE = 38;
                const a = r.life < GROW ? r.life / GROW
                        : r.life > r.maxLife - FADE ? (r.maxLife - r.life) / FADE
                        : 1;

                const drawTo = Math.min(1, r.life / GROW) * r.total;

                // Ambient pulse as the rift tears open
                if (r.life < GROW * 1.5) {
                    const pulse = Math.sin((r.life / (GROW * 1.5)) * Math.PI);
                    const amb = ctx.createRadialGradient(r.ox, r.oy, 0, r.ox, r.oy, 240);
                    amb.addColorStop(0, `hsla(${r.hue},90%,60%,${(pulse * 0.1).toFixed(3)})`);
                    amb.addColorStop(1, `hsla(${r.hue},90%,60%,0)`);
                    ctx.fillStyle = amb;
                    ctx.beginPath(); ctx.arc(r.ox, r.oy, 240, 0, Math.PI * 2); ctx.fill();
                }

                // Origin glow
                const og = ctx.createRadialGradient(r.ox, r.oy, 0, r.ox, r.oy, 18);
                og.addColorStop(0, `hsla(${r.hue},100%,82%,${(a * 0.55).toFixed(3)})`);
                og.addColorStop(1, `hsla(${r.hue},100%,60%,0)`);
                ctx.fillStyle = og;
                ctx.beginPath(); ctx.arc(r.ox, r.oy, 18, 0, Math.PI * 2); ctx.fill();

                ctx.lineJoin = 'round';
                for (const s of r.segs) {
                    const sStart = s.cum - s.len;
                    if (sStart >= drawTo) break;
                    let x2 = s.x2, y2 = s.y2;
                    if (s.cum > drawTo) {
                        const t = (drawTo - sStart) / s.len;
                        x2 = s.x1 + (s.x2 - s.x1) * t;
                        y2 = s.y1 + (s.y2 - s.y1) * t;
                    }
                    // Soft glow pass
                    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(x2, y2);
                    ctx.strokeStyle = `hsla(${r.hue},100%,68%,${(a * 0.28).toFixed(3)})`;
                    ctx.lineWidth = 7; ctx.stroke();
                    // Bright core
                    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(x2, y2);
                    ctx.strokeStyle = `hsla(${r.hue},100%,94%,${(a * 0.9).toFixed(3)})`;
                    ctx.lineWidth = 1.2; ctx.stroke();
                }
            }
        });
    });
}

function _startGlade(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const MAX_SPEED = 0.45;
        const mk = () => ({
            x: Math.random() * W, y: H * 0.2 + Math.random() * H * 0.8,
            vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
            r: 1 + Math.random() * 1.4,
            phase: Math.random() * Math.PI * 2, blink: 0.008 + Math.random() * 0.02,
        });
        const flies = Array.from({ length: 46 }, mk);
        // old trees framing the clearing, grass along the floor, mist drifting between
        const trees = _paintLayer(W, H, (g) => {
            const trunk = (x, w, lean) => {
                g.beginPath();
                g.moveTo(x - w / 2, H);
                g.quadraticCurveTo(x - w * 0.45 + lean * 0.5, H * 0.5, x - w * 0.32 + lean, -10);
                g.lineTo(x + w * 0.32 + lean, -10);
                g.quadraticCurveTo(x + w * 0.45 + lean * 0.5, H * 0.5, x + w / 2, H);
                g.closePath(); g.fill();
            };
            g.fillStyle = 'rgba(8,20,12,0.7)';
            trunk(W * 0.06, 34, 10); trunk(W * 0.94, 30, -8);
            g.fillStyle = 'rgba(5,14,8,0.92)';
            trunk(W * 0.015, 56, 4); trunk(W * 0.985, 60, -6); trunk(W * 0.11, 22, 14);
            // canopy shadows in the top corners
            for (let i = 0; i < 30; i++) {
                const left = i % 2 === 0;
                _softBlob(g, (left ? 0 : W) + (left ? 1 : -1) * Math.random() * W * 0.22, Math.random() * H * 0.18, 40 + Math.random() * 70, '4,12,7', 0.55);
            }
            // grass blades
            g.strokeStyle = 'rgba(10,32,16,0.85)';
            g.lineWidth = 1.4;
            for (let i = 0; i < 520; i++) {
                const x = Math.random() * W, h = 8 + Math.random() * 26, bend = (Math.random() - 0.5) * 10;
                g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + bend * 0.3, H - h * 0.6, x + bend, H - h); g.stroke();
            }
        });
        const mist = [0, 1, 2].map(i => ({ y: H * (0.78 + i * 0.07), speed: 0.006 + i * 0.004, phase: i * 2.3 }));
        _loop(canvas, (t) => {
            ctx.clearRect(0, 0, W, H);
            for (const m of mist) {
                const x = ((t * m.speed + m.phase * 400) % (W * 1.6)) - W * 0.3;
                const g = ctx.createRadialGradient(x, m.y, 0, x, m.y, W * 0.35);
                g.addColorStop(0, 'rgba(150,190,160,0.07)');
                g.addColorStop(1, 'rgba(150,190,160,0)');
                ctx.save(); ctx.scale(1, 0.25);
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(x, m.y * 4, W * 0.35, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
            _drawLayer(ctx, trees, 0, 0, W, H);
            for (const f of flies) {
                // lazy wandering
                f.vx += (Math.random() - 0.5) * 0.03;
                f.vy += (Math.random() - 0.5) * 0.03;
                const sp = Math.hypot(f.vx, f.vy);
                if (sp > MAX_SPEED) { f.vx *= MAX_SPEED / sp; f.vy *= MAX_SPEED / sp; }
                if (f.y < H * 0.12) f.vy += 0.015; // drift back down toward the grass
                f.x += f.vx; f.y += f.vy;
                if (f.x < -20) f.x = W + 20;
                if (f.x > W + 20) f.x = -20;
                if (f.y > H + 20) f.y = H * 0.3;

                f.phase += f.blink;
                const glow = Math.pow(Math.max(0, Math.sin(f.phase)), 2);
                const a = 0.1 + glow * 0.9;
                const halo = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 9);
                halo.addColorStop(0, `rgba(205,255,120,${(a * 0.35).toFixed(3)})`);
                halo.addColorStop(1, 'rgba(205,255,120,0)');
                ctx.fillStyle = halo;
                ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 9, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(240,255,190,${a.toFixed(3)})`;
                ctx.fill();
            }
        });
    });
}

function _startRain(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const SLANT = 0.18; // horizontal travel per unit of fall
        const mkDrop = (anyY) => {
            const z = Math.random();
            return {
                x: Math.random() * (W + 200) - 100,
                y: anyY ? Math.random() * H : -20 - Math.random() * 80,
                z, len: 8 + z * 15, spd: 6 + z * 7, a: 0.07 + z * 0.17,
            };
        };
        const drops = Array.from({ length: 150 }, () => mkDrop(true));
        const splashes = [];

        // Beads of water on the "glass": splat in, sit, then fade or run down the pane.
        const beads = [];
        const MAX_BEADS = 26;
        let beadCd = 20;
        const mkBead = () => ({
            x: Math.random() * W, y: Math.random() * H * 0.9,
            r: 2.5 + Math.random() * 5.5,
            life: 0, max: 360 + Math.random() * 420,
            vy: 0, sliding: false, trail: [],
        });

        function drawBead(b, a) {
            const { x, y, r } = b;
            const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
            body.addColorStop(0,   `rgba(255,255,255,${(0.14 * a).toFixed(3)})`);
            body.addColorStop(0.6, `rgba(180,205,240,${(0.07 * a).toFixed(3)})`);
            body.addColorStop(1,   `rgba(20,30,50,${(0.10 * a).toFixed(3)})`);
            ctx.fillStyle = body;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(215,230,255,${(0.3 * a).toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.fillStyle = `rgba(255,255,255,${(0.5 * a).toFixed(3)})`;
            ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.22, 0, Math.PI * 2); ctx.fill();
        }

        // far hills and a nearer ridge, with low mist drifting between them
        const vista = _paintLayer(W, H, (g) => {
            _ridge(g, W, H, H * 0.8, H * 0.05, 'rgba(45,58,82,0.4)', { freq: 0.7 });
            _ridge(g, W, H, H * 0.9, H * 0.04, 'rgba(14,19,30,0.75)', { freq: 1.3 });
        });
        _loop(canvas, (t) => {
            ctx.clearRect(0, 0, W, H);
            _drawLayer(ctx, vista, 0, 0, W, H);
            const mistX = (t * 0.008) % (W * 1.6) - W * 0.3;
            const mg = ctx.createRadialGradient(mistX, H * 0.84, 0, mistX, H * 0.84, W * 0.4);
            mg.addColorStop(0, 'rgba(150,165,195,0.06)');
            mg.addColorStop(1, 'rgba(150,165,195,0)');
            ctx.save(); ctx.scale(1, 0.22); ctx.fillStyle = mg;
            ctx.beginPath(); ctx.arc(mistX, H * 0.84 / 0.22, W * 0.4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            // falling rain
            ctx.lineCap = 'round';
            for (const d of drops) {
                d.y += d.spd;
                d.x += d.spd * SLANT;
                if (d.y > H) {
                    if (d.z > 0.6 && Math.random() < 0.2) splashes.push({ x: d.x, y: H - 2 - Math.random() * 6, life: 0 });
                    Object.assign(d, mkDrop(false));
                    continue;
                }
                ctx.strokeStyle = `rgba(175,195,235,${d.a.toFixed(3)})`;
                ctx.lineWidth = 0.6 + d.z * 0.8;
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x - d.len * SLANT, d.y - d.len);
                ctx.stroke();
            }
            for (let i = splashes.length - 1; i >= 0; i--) {
                const s = splashes[i];
                if (++s.life > 14) { splashes.splice(i, 1); continue; }
                const t = s.life / 14;
                ctx.strokeStyle = `rgba(180,200,240,${((1 - t) * 0.22).toFixed(3)})`;
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.ellipse(s.x, s.y, 2 + t * 7, 0.8 + t * 1.6, 0, Math.PI, Math.PI * 2);
                ctx.stroke();
            }

            // beads on the glass
            if (--beadCd <= 0 && beads.length < MAX_BEADS) {
                beads.push(mkBead());
                beadCd = 18 + Math.random() * 40;
            }
            for (let i = beads.length - 1; i >= 0; i--) {
                const b = beads[i];
                b.life++;
                // big beads sometimes give way and run down the pane
                if (!b.sliding && b.r > 5.5 && b.life > 90 && Math.random() < 0.004) b.sliding = true;
                if (b.sliding) {
                    b.vy = Math.min(b.vy + 0.05, 1.8);
                    b.y += b.vy;
                    b.x += Math.sin(b.y * 0.05) * 0.25;
                    b.trail.push([b.x, b.y - b.r * 0.6]);
                    if (b.trail.length > 70) b.trail.shift();
                    b.r = Math.max(2.2, b.r - 0.006);
                }
                const fadeIn = Math.min(1, b.life / 8);
                const fadeOut = b.sliding ? 1 : Math.min(1, (b.max - b.life) / 90);
                const a = Math.max(0, Math.min(fadeIn, fadeOut));
                if ((!b.sliding && b.life >= b.max) || b.y - b.r > H) { beads.splice(i, 1); continue; }

                if (b.trail.length > 1) {
                    ctx.strokeStyle = 'rgba(200,220,250,0.07)';
                    ctx.lineWidth = b.r * 0.55;
                    ctx.beginPath();
                    ctx.moveTo(b.trail[0][0], b.trail[0][1]);
                    for (const [tx, ty] of b.trail) ctx.lineTo(tx, ty);
                    ctx.stroke();
                }
                // a quick splat as it lands, then it settles to size
                const scale = b.life < 8 ? 1.35 - (b.life / 8) * 0.35 : 1;
                const r0 = b.r;
                b.r = r0 * scale;
                drawBead(b, a);
                b.r = r0;
            }
        });
    });
}

function _startTavern(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        // Light falls through a window at ~115°: points on one beam share u = x + y·SLOPE.
        const SLOPE = 0.47;
        const SHAFTS = [
            { pos: 0.30, w: 0.045, a: 0.065 },
            { pos: 0.42, w: 0.03,  a: 0.05 },
            { pos: 0.55, w: 0.055, a: 0.06 },
        ];
        const shaftLight = (x, y) => {
            const u = (x + y * SLOPE) / W;
            let best = 0;
            for (const s of SHAFTS) best = Math.max(best, 1 - Math.abs(u - s.pos) / s.w);
            return Math.max(0, best) * (1 - (y / H) * 0.55);
        };
        const mkMote = () => ({
            x: Math.random() * W, y: Math.random() * H,
            r: 0.5 + Math.random() * 1.2,
            vx: (Math.random() - 0.5) * 0.12, vy: -0.02 - Math.random() * 0.07,
            phase: Math.random() * Math.PI * 2,
        });
        const motes = Array.from({ length: 90 }, mkMote);
        const sparks = [];

        // heavy beams and posts, and two lanterns swaying on their chains
        const timbers = _paintLayer(W, H, (g) => {
            const wood = (x, y, w, h, vertical) => {
                const gr = vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
                gr.addColorStop(0, 'rgba(42,25,14,0.95)');
                gr.addColorStop(0.5, 'rgba(58,35,20,0.95)');
                gr.addColorStop(1, 'rgba(30,18,10,0.95)');
                g.fillStyle = gr;
                g.fillRect(x, y, w, h);
                g.fillStyle = 'rgba(255,190,120,0.05)';
                vertical ? g.fillRect(x + w * 0.55, y, 1.5, h) : g.fillRect(x, y + h * 0.3, w, 1.5);
            };
            wood(0, 0, W, 22, false);
            wood(0, 22, 30, H, true);
            wood(W - 30, 22, 30, H, true);
            wood(30, 22, 18, 26, false);
            wood(W - 48, 22, 18, 26, false);
        });
        const lanterns = [{ x: W * 0.2, len: H * 0.12, phase: 0 }, { x: W * 0.8, len: H * 0.1, phase: 2.2 }];
        _loop(canvas, (t) => {
            ctx.clearRect(0, 0, W, H);
            _drawLayer(ctx, timbers, 0, 0, W, H);
            for (const l of lanterns) {
                const swing = Math.sin(t * 0.0009 + l.phase) * 0.05;
                const lx = l.x + Math.sin(swing) * l.len, ly = 22 + Math.cos(swing) * l.len;
                const flick = 0.85 + Math.sin(t * 0.006 + l.phase) * 0.08 + Math.sin(t * 0.017 + l.phase) * 0.05;
                const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 170);
                glow.addColorStop(0, `rgba(255,170,80,${(0.2 * flick).toFixed(3)})`);
                glow.addColorStop(1, 'rgba(255,170,80,0)');
                ctx.fillStyle = glow;
                ctx.fillRect(lx - 170, ly - 170, 340, 340);
                ctx.strokeStyle = 'rgba(25,16,10,0.9)';
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(l.x, 22); ctx.lineTo(lx, ly - 16); ctx.stroke();
                ctx.save(); ctx.translate(lx, ly); ctx.rotate(-swing); ctx.scale(1.8, 1.8);
                ctx.fillStyle = 'rgba(28,18,10,0.95)';
                ctx.fillRect(-7, -10, 14, 3);
                ctx.fillRect(-6, 9, 12, 3);
                ctx.fillStyle = `rgba(255,200,120,${(0.75 * flick).toFixed(3)})`;
                ctx.fillRect(-5, -7, 10, 16);
                ctx.strokeStyle = 'rgba(28,18,10,0.95)';
                ctx.strokeRect(-5, -7, 10, 16);
                ctx.restore();
            }
            // gentle flicker: mostly smooth, with a little life in it
            const flicker = 0.83 + 0.17 * (Math.sin(t * 0.007) * 0.55 + Math.sin(t * 0.017 + 1) * 0.35 + Math.random() * 0.1);

            // hearth glow rising from the bottom centre
            const hearth = ctx.createRadialGradient(W * 0.5, H * 1.08, 0, W * 0.5, H * 1.08, H * 0.8);
            hearth.addColorStop(0, `rgba(255,140,50,${(0.135 * flicker).toFixed(3)})`);
            hearth.addColorStop(1, 'rgba(255,140,50,0)');
            ctx.fillStyle = hearth;
            ctx.fillRect(0, 0, W, H);

            // window light shafts, breathing slowly
            const breathe = 0.85 + Math.sin(t * 0.0005) * 0.15;
            for (const s of SHAFTS) {
                const l = (s.pos - s.w) * W, r = (s.pos + s.w) * W;
                const g = ctx.createLinearGradient(0, 0, 0, H);
                g.addColorStop(0, `rgba(255,214,160,${(s.a * breathe).toFixed(3)})`);
                g.addColorStop(1, 'rgba(255,214,160,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(l, 0); ctx.lineTo(r, 0);
                ctx.lineTo(r - H * SLOPE, H); ctx.lineTo(l - H * SLOPE, H);
                ctx.closePath();
                ctx.fill();
            }

            // dust: barely visible in shadow, glittering inside the beams
            for (const m of motes) {
                m.phase += 0.01;
                m.x += m.vx + Math.sin(m.phase) * 0.08;
                m.y += m.vy;
                if (m.y < -5) { m.y = H + 5; m.x = Math.random() * W; }
                if (m.x < -5) m.x = W + 5;
                if (m.x > W + 5) m.x = -5;
                const a = 0.05 + shaftLight(m.x, m.y) * 0.6;
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,228,185,${a.toFixed(3)})`;
                ctx.fill();
            }

            // a spark pops from the hearth now and then
            if (Math.random() < 0.02) {
                sparks.push({ x: W * (0.44 + Math.random() * 0.12), y: H + 4,
                              vx: (Math.random() - 0.5) * 0.6, vy: -(1 + Math.random() * 1.4),
                              life: 0, max: 50 + Math.random() * 50 });
            }
            for (let i = sparks.length - 1; i >= 0; i--) {
                const s = sparks[i];
                if (++s.life > s.max) { sparks.splice(i, 1); continue; }
                s.x += s.vx + Math.sin(s.life * 0.2) * 0.3;
                s.y += s.vy;
                s.vy *= 0.985;
                const a = (1 - s.life / s.max) * 0.8;
                ctx.beginPath();
                ctx.arc(s.x, s.y, 1.1, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,${Math.floor(150 + a * 80)},70,${a.toFixed(3)})`;
                ctx.fill();
            }
        });
    });
}

function _startAurora(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const stars = Array.from({ length: 150 }, () => ({
            x: Math.random() * W, y: Math.random() * H * 0.8,
            r: Math.random() * 1.1 + 0.2, phase: Math.random() * Math.PI * 2, spd: Math.random() * 0.012 + 0.003,
        }));
        // each curtain is a soft vertical band that ripples along a slow wave
        const curtains = [
            { y: 0.22, amp: 0.06, len: 0.9, hue: 150, speed: 0.00012, phase: 0,   alpha: 0.16 },
            { y: 0.30, amp: 0.05, len: 0.7, hue: 175, speed: 0.00009, phase: 2.1, alpha: 0.12 },
            { y: 0.18, amp: 0.04, len: 0.6, hue: 285, speed: 0.00015, phase: 4.2, alpha: 0.09 },
        ];
        // curtains are drawn small and scaled up: the upscale blurs them into soft light
        const SCALE = 8;
        const glow = document.createElement('canvas');
        glow.width = Math.ceil(W / SCALE);
        glow.height = Math.ceil(H / SCALE);
        const gctx = glow.getContext('2d');
        const gw = glow.width, gh = glow.height;
        _loop(canvas, (t) => {
            ctx.clearRect(0, 0, W, H);
            for (const s of stars) {
                s.phase += s.spd;
                ctx.fillStyle = `rgba(235,240,255,${(0.2 + (Math.sin(s.phase) * 0.5 + 0.5) * 0.55).toFixed(3)})`;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
            }
            gctx.clearRect(0, 0, gw, gh);
            gctx.globalCompositeOperation = 'lighter';
            for (const c of curtains) {
                const breathe = 0.75 + Math.sin(t * 0.0004 + c.phase) * 0.25;
                for (let x = 0; x < gw; x++) {
                    const u = x / gw;
                    const wave = Math.sin(u * 5 + t * c.speed * 10 + c.phase) * 0.6 + Math.sin(u * 11 - t * c.speed * 6) * 0.4;
                    const top = gh * (c.y + wave * c.amp);
                    const height = gh * c.len * (0.35 + 0.25 * (Math.sin(u * 7 + t * c.speed * 4 + c.phase) * 0.5 + 0.5));
                    // fade out towards the screen edges
                    const edge = Math.min(1, u * 4, (1 - u) * 4);
                    const g = gctx.createLinearGradient(0, top, 0, top + height);
                    const a = c.alpha * breathe * edge;
                    g.addColorStop(0, `hsla(${c.hue},90%,65%,0)`);
                    g.addColorStop(0.15, `hsla(${c.hue},90%,65%,${(a * 1.2).toFixed(3)})`);
                    g.addColorStop(1, `hsla(${c.hue + 20},90%,55%,0)`);
                    gctx.fillStyle = g;
                    gctx.fillRect(x, top, 1, height);
                }
            }
            ctx.globalCompositeOperation = 'lighter';
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(glow, 0, 0, W, H);
            ctx.globalCompositeOperation = 'source-over';
        });
    });
}

function _startAutumn(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const COLS = ['214,108,48', '196,72,40', '230,160,60', '168,92,40', '222,132,52'];
        const mk = (anyY) => {
            const z = Math.random();
            return {
                x: Math.random() * W, y: anyY ? Math.random() * H : -20,
                z, size: 4 + z * 7, fall: 0.25 + z * 0.55, sway: 0.4 + z * 0.8,
                phase: Math.random() * Math.PI * 2, rot: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 0.04, flip: Math.random() * Math.PI * 2,
                col: COLS[Math.floor(Math.random() * COLS.length)], a: 0.35 + z * 0.45,
            };
        };
        const leaves = Array.from({ length: 34 }, () => mk(true));
        _loop(canvas, (t) => {
            ctx.clearRect(0, 0, W, H);
            const breeze = Math.sin(t * 0.0003) * 0.35;
            for (const l of leaves) {
                l.phase += 0.015;
                l.flip += 0.03;
                l.rot += l.spin;
                l.y += l.fall;
                l.x += Math.sin(l.phase) * l.sway + breeze;
                if (l.y > H + 20) Object.assign(l, mk(false));
                if (l.x < -20) l.x = W + 20;
                if (l.x > W + 20) l.x = -20;
                ctx.save();
                ctx.translate(l.x, l.y);
                ctx.rotate(l.rot);
                ctx.scale(1, Math.abs(Math.cos(l.flip)) * 0.8 + 0.2); // tumbling
                ctx.fillStyle = `rgba(${l.col},${l.a.toFixed(3)})`;
                ctx.beginPath();
                ctx.moveTo(0, -l.size);
                ctx.quadraticCurveTo(l.size * 0.75, -l.size * 0.2, 0, l.size);
                ctx.quadraticCurveTo(-l.size * 0.75, -l.size * 0.2, 0, -l.size);
                ctx.fill();
                ctx.strokeStyle = `rgba(90,45,20,${(l.a * 0.5).toFixed(3)})`;
                ctx.lineWidth = 0.6;
                ctx.beginPath(); ctx.moveTo(0, -l.size * 0.9); ctx.lineTo(0, l.size * 1.2); ctx.stroke();
                ctx.restore();
            }
        });
    });
}

function _startSubter(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const COLS = ['90,230,210', '150,120,255', '120,200,255', '200,140,255'];
        const mk = (anyY) => ({
            x: Math.random() * W, y: anyY ? H * (0.3 + Math.random() * 0.7) : H + 10,
            r: Math.random() * 1.8 + 0.9, rise: Math.random() * 0.22 + 0.06,
            phase: Math.random() * Math.PI * 2, drift: Math.random() * 0.4 + 0.15,
            life: anyY ? Math.random() : 0, lifeSpd: Math.random() * 0.0025 + 0.0012,
            col: COLS[Math.floor(Math.random() * COLS.length)],
        });
        const spores = Array.from({ length: 80 }, () => mk(true));
        // glowing mushroom clusters climbing the cave walls on both sides, pulsing slowly
        const caps = [];
        for (const side of [0, 1]) {
            for (let i = 0; i < 6; i++) {
                const y = H * (1 - i * 0.09 - Math.random() * 0.04);
                const inset = (i * 0.012 + Math.random() * 0.03) * W;
                caps.push({ x: side ? W - inset - 14 : inset + 14, y, r: 9 + Math.random() * 14 - i,
                    phase: Math.random() * Math.PI * 2, col: COLS[(i + side) % COLS.length] });
            }
        }
        _loop(canvas, (t) => {
            ctx.clearRect(0, 0, W, H);
            for (const c of caps) {
                const pulse = 0.6 + Math.sin(t * 0.0012 + c.phase) * 0.3;
                const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 7);
                g.addColorStop(0, `rgba(${c.col},${(0.22 * pulse).toFixed(3)})`);
                g.addColorStop(1, `rgba(${c.col},0)`);
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 7, 0, Math.PI * 2); ctx.fill();
                // stalk and cap
                ctx.fillStyle = `rgba(${c.col},${(0.25 * pulse).toFixed(3)})`;
                ctx.fillRect(c.x - c.r * 0.12, c.y - c.r * 0.1, c.r * 0.24, c.r * 0.9);
                ctx.fillStyle = `rgba(${c.col},${(0.6 * pulse).toFixed(3)})`;
                ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.5, 0, Math.PI, Math.PI * 2); ctx.fill();
            }
            for (const s of spores) {
                s.life += s.lifeSpd;
                if (s.life >= 1 || s.y < -10) { Object.assign(s, mk(false)); continue; }
                s.phase += 0.012;
                s.y -= s.rise;
                s.x += Math.sin(s.phase) * s.drift;
                const a = (s.life < 0.15 ? s.life / 0.15 : s.life > 0.8 ? (1 - s.life) / 0.2 : 1) * (0.55 + Math.sin(t * 0.003 + s.phase * 3) * 0.25);
                ctx.fillStyle = `rgba(${s.col},${(a * 0.18).toFixed(3)})`;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(${s.col},${(a * 0.85).toFixed(3)})`;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
            }
        });
    });
}

function _startMoonsea(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const horizon = H * 0.42;
        const moon = { x: W * 0.9, y: H * 0.11, r: Math.min(W, H) * 0.035 };
        const stars = Array.from({ length: 90 }, () => ({
            x: Math.random() * W, y: Math.random() * horizon * 0.95,
            r: Math.random() * 1 + 0.2, phase: Math.random() * Math.PI * 2,
        }));
        // short glinting dashes on the water; denser and brighter under the moon
        const glints = Array.from({ length: 140 }, () => {
            const depth = Math.random();
            return { depth, y: horizon + 4 + depth * depth * (H - horizon), off: (Math.random() - 0.5), phase: Math.random() * Math.PI * 2, spd: 0.01 + Math.random() * 0.02 };
        });
        _loop(canvas, (t) => {
            ctx.clearRect(0, 0, W, H);
            for (const s of stars) {
                s.phase += 0.008;
                ctx.fillStyle = `rgba(230,235,255,${(0.15 + (Math.sin(s.phase) * 0.5 + 0.5) * 0.45).toFixed(3)})`;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
            }
            const halo = ctx.createRadialGradient(moon.x, moon.y, moon.r * 0.8, moon.x, moon.y, moon.r * 5);
            halo.addColorStop(0, 'rgba(210,225,255,0.16)');
            halo.addColorStop(1, 'rgba(210,225,255,0)');
            ctx.fillStyle = halo;
            ctx.fillRect(0, 0, W, horizon + moon.r * 3);
            const disc = ctx.createRadialGradient(moon.x - moon.r * 0.3, moon.y - moon.r * 0.3, 0, moon.x, moon.y, moon.r);
            disc.addColorStop(0, 'rgba(250,250,240,0.8)');
            disc.addColorStop(1, 'rgba(205,215,235,0.6)');
            ctx.fillStyle = disc;
            ctx.beginPath(); ctx.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2); ctx.fill();

            // the moon's reflection: a soft column on the water
            ctx.save();
            ctx.translate(moon.x, horizon);
            ctx.scale(1, (H - horizon) / (moon.r * 6));
            const col = ctx.createRadialGradient(0, 0, 0, 0, 0, moon.r * 6);
            col.addColorStop(0, 'rgba(200,215,255,0.12)');
            col.addColorStop(1, 'rgba(200,215,255,0)');
            ctx.fillStyle = col;
            ctx.fillRect(-moon.r * 6, 0, moon.r * 12, moon.r * 6);
            ctx.restore();

            ctx.lineCap = 'round';
            for (const g of glints) {
                g.phase += g.spd;
                const spread = moon.r * (0.8 + g.depth * 6);
                const x = moon.x + g.off * spread * 2 + Math.sin(t * 0.0006 + g.phase) * 6;
                const near = 1 - Math.min(1, Math.abs(g.off) * 1.6);
                const a = (Math.sin(g.phase) * 0.5 + 0.5) * (0.12 + near * 0.5) * (0.5 + g.depth * 0.5);
                const len = 4 + g.depth * 16;
                ctx.strokeStyle = `rgba(225,235,255,${a.toFixed(3)})`;
                ctx.lineWidth = 0.8 + g.depth;
                ctx.beginPath(); ctx.moveTo(x - len / 2, g.y); ctx.lineTo(x + len / 2, g.y); ctx.stroke();
            }
            // a few slow swell lines across the whole sea
            for (let i = 0; i < 5; i++) {
                const y = horizon + (H - horizon) * (0.15 + i * 0.18) + Math.sin(t * 0.0005 + i) * 4;
                ctx.strokeStyle = `rgba(150,175,230,${(0.04 + i * 0.01).toFixed(3)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let x = 0; x <= W; x += 24) {
                    const yy = y + Math.sin(x * 0.012 + t * 0.0007 + i * 2) * (2 + i);
                    x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
                }
                ctx.stroke();
            }
        });
    });
}

function _startSunken(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const rays = Array.from({ length: 6 }, (_, i) => ({
            x: W * (0.1 + i * 0.16 + Math.random() * 0.05), w: W * (0.04 + Math.random() * 0.05),
            phase: Math.random() * Math.PI * 2, a: 0.05 + Math.random() * 0.04,
        }));
        const mkBubble = (anyY) => ({
            x: Math.random() * W, y: anyY ? Math.random() * H : H + 10,
            r: 1 + Math.random() * 3, rise: 0.3 + Math.random() * 0.6, phase: Math.random() * Math.PI * 2,
        });
        const bubbles = Array.from({ length: 34 }, () => mkBubble(true));
        const motes = Array.from({ length: 50 }, () => ({
            x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + 0.3,
            vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.1, phase: Math.random() * Math.PI * 2,
        }));
        _loop(canvas, (t) => {
            ctx.clearRect(0, 0, W, H);
            // light shafts from the surface, swaying with the water
            for (const r of rays) {
                const sway = Math.sin(t * 0.0004 + r.phase) * W * 0.03;
                const a = r.a * (0.7 + Math.sin(t * 0.0009 + r.phase * 2) * 0.3);
                const g = ctx.createLinearGradient(0, 0, 0, H);
                g.addColorStop(0, `rgba(150,230,220,${a.toFixed(3)})`);
                g.addColorStop(1, 'rgba(150,230,220,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(r.x - r.w / 2, 0); ctx.lineTo(r.x + r.w / 2, 0);
                ctx.lineTo(r.x + r.w * 1.6 + sway, H); ctx.lineTo(r.x - r.w * 0.6 + sway, H);
                ctx.closePath(); ctx.fill();
            }
            // rippling caustics near the surface
            for (let i = 0; i < 3; i++) {
                ctx.strokeStyle = `rgba(190,245,235,${(0.05 - i * 0.012).toFixed(3)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let x = 0; x <= W; x += 18) {
                    const y = 14 + i * 22 + Math.sin(x * 0.02 + t * 0.0012 + i * 1.7) * 6 + Math.sin(x * 0.047 - t * 0.0009) * 3;
                    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
            for (const m of motes) {
                m.phase += 0.01;
                m.x += m.vx + Math.sin(m.phase) * 0.08;
                m.y += m.vy;
                if (m.x < 0) m.x = W; if (m.x > W) m.x = 0;
                if (m.y < 0) m.y = H; if (m.y > H) m.y = 0;
                ctx.fillStyle = `rgba(200,240,230,${(0.15 + Math.sin(m.phase) * 0.1).toFixed(3)})`;
                ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
            }
            for (const b of bubbles) {
                b.phase += 0.03;
                b.y -= b.rise;
                b.x += Math.sin(b.phase) * 0.3;
                if (b.y < -10) Object.assign(b, mkBubble(false));
                ctx.strokeStyle = 'rgba(210,250,245,0.35)';
                ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2); ctx.fill();
            }
        });
    });
}

function _startAstral(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const stars = Array.from({ length: 200 }, () => ({
            x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + 0.2,
            phase: Math.random() * Math.PI * 2, spd: Math.random() * 0.01 + 0.003,
        }));
        const clouds = Array.from({ length: 5 }, (_, i) => ({
            x: Math.random() * W, y: Math.random() * H, r: Math.min(W, H) * (0.25 + Math.random() * 0.2),
            vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.5) * 0.04,
            hue: [265, 300, 220, 190, 320][i], a: 0.13 + Math.random() * 0.07,
        }));
        // constellations: a handful of bright stars joined in a chain, drawn in, held, then faded
        const constellations = [];
        let nextIn = 60;
        const mkConstellation = () => {
            const cx = W * (0.15 + Math.random() * 0.7), cy = H * (0.12 + Math.random() * 0.6);
            const pts = [];
            let x = cx, y = cy, ang = Math.random() * Math.PI * 2;
            for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) {
                pts.push([x, y]);
                ang += (Math.random() - 0.5) * 1.6;
                const d = 40 + Math.random() * 60;
                x += Math.cos(ang) * d; y += Math.sin(ang) * d;
            }
            return { pts, life: 0, max: 520 + Math.random() * 200 };
        };
        _loop(canvas, () => {
            ctx.clearRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'lighter';
            for (const c of clouds) {
                c.x += c.vx; c.y += c.vy;
                if (c.x < -c.r) c.x = W + c.r; if (c.x > W + c.r) c.x = -c.r;
                if (c.y < -c.r) c.y = H + c.r; if (c.y > H + c.r) c.y = -c.r;
                const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
                g.addColorStop(0, `hsla(${c.hue},70%,55%,${c.a.toFixed(3)})`);
                g.addColorStop(1, `hsla(${c.hue},70%,45%,0)`);
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
            for (const s of stars) {
                s.phase += s.spd;
                ctx.fillStyle = `rgba(240,235,255,${(0.15 + (Math.sin(s.phase) * 0.5 + 0.5) * 0.5).toFixed(3)})`;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
            }
            if (--nextIn <= 0 && constellations.length < 2) {
                constellations.push(mkConstellation());
                nextIn = 300 + Math.random() * 300;
            }
            for (let i = constellations.length - 1; i >= 0; i--) {
                const k = constellations[i];
                if (++k.life > k.max) { constellations.splice(i, 1); continue; }
                const p = k.life / k.max;
                const a = p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1;
                const drawn = Math.min(1, p / 0.35) * (k.pts.length - 1);
                ctx.strokeStyle = `rgba(200,190,255,${(a * 0.35).toFixed(3)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(k.pts[0][0], k.pts[0][1]);
                for (let j = 1; j <= Math.ceil(drawn); j++) {
                    const f = Math.min(1, drawn - (j - 1));
                    const [x0, y0] = k.pts[j - 1], [x1, y1] = k.pts[j];
                    ctx.lineTo(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
                }
                ctx.stroke();
                k.pts.forEach(([x, y], j) => {
                    if (j > drawn + 0.01) return;
                    const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
                    g.addColorStop(0, `rgba(240,235,255,${(a * 0.9).toFixed(3)})`);
                    g.addColorStop(1, 'rgba(240,235,255,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
                });
            }
        });
    });
}

const SIM_BG_STARTERS = {
    stars: _startStars, snow: _startSnow, arcane: _startArcane, ember: _startEmbers,
    rift: _startRift, glade: _startGlade, rain: _startRain, tavern: _startTavern,
    aurora: _startAurora, autumn: _startAutumn, subter: _startSubter,
    moonsea: _startMoonsea, sunken: _startSunken, astral: _startAstral,
};

function _launchParticles(bg, section) {
    if (prefersReducedMotion.matches || !SIM_BG_STARTERS[bg]) { _clearSimBg(); return; }
    SIM_BG_STARTERS[bg](section);
}

// Canvases are sized once, so rebuild the active one after the window settles at a new size.
let _simBgResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(_simBgResizeTimer);
    _simBgResizeTimer = setTimeout(() => {
        const section = document.getElementById('simulatorSection');
        if (_simBgActive && section.classList.contains('active')) _launchParticles(_simBgActive, section);
    }, 250);
});

function setSimBg(bg) {
    const section = document.getElementById('simulatorSection');
    section.className = section.className.replace(/\bsim-bg-\S+/g, '').trim();
    if (bg) section.classList.add('sim-bg-' + bg);
    localStorage.setItem('DND_TCG_SIM_BG', bg);
    _simBgActive = bg;

    document.querySelectorAll('.sim-bg-swatch').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bg === bg);
    });
    const label = document.getElementById('simBgLabel');
    if (label) label.textContent = SIM_BG_NAMES[bg] ?? 'Default';

    _launchParticles(bg, section);
}

// Pause/resume canvas when sim section is shown/hidden
new MutationObserver((mutations) => {
    for (const m of mutations) {
        const wasActive = (m.oldValue || '').includes('active');
        const isActive  = m.target.classList.contains('active');
        if (!wasActive && isActive && _simBgActive) {
            _launchParticles(_simBgActive, m.target);
        } else if (wasActive && !isActive) {
            _clearSimBg();
        }
    }
}).observe(document.getElementById('simulatorSection'), {
    attributes: true, attributeFilter: ['class'], attributeOldValue: true,
});

// Restore saved background on load
(function () {
    let saved = localStorage.getItem('DND_TCG_SIM_BG') ?? '';
    if (saved === 'storm') saved = 'rain';          // Thunderstorm became Rainstorm
    if (saved === 'underdark') saved = 'subter';    // Underdark became Subter
    setSimBg(saved);
})();

// Swatch click handlers
document.querySelectorAll('.sim-bg-swatch').forEach(btn => {
    btn.addEventListener('click', () => setSimBg(btn.dataset.bg));
    btn.addEventListener('mouseenter', () => {
        const label = document.getElementById('simBgLabel');
        if (label) label.textContent = SIM_BG_NAMES[btn.dataset.bg] ?? 'Default';
    });
    btn.addEventListener('mouseleave', () => {
        const label = document.getElementById('simBgLabel');
        const active = document.querySelector('.sim-bg-swatch.active');
        if (label && active) label.textContent = SIM_BG_NAMES[active.dataset.bg] ?? 'Default';
    });
});

/* ---- Keyboard access ---- */

// Lets a non-button element be focused with Tab and activated with Enter/Space.
function makeActivatable(el, label) {
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    if (label) el.setAttribute("aria-label", label);
    el.addEventListener("keydown", (e) => {
        if (e.target !== el) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            el.click();
        }
    });
}

// Touch: a ~500ms long-press acts as right-click everywhere. Browsers that already fire
// a native contextmenu on long-press (Android) win; we only fill in where they don't (iOS).
(function enableLongPress() {
    const HOLD_MS = 500, SLOP = 10;
    let timer = null, startX = 0, startY = 0, target = null, fired = false;
    const cancel = () => { clearTimeout(timer); timer = null; };

    document.addEventListener("pointerdown", (e) => {
        fired = false;
        if (e.pointerType === "mouse") return;
        target = e.target;
        startX = e.clientX;
        startY = e.clientY;
        cancel();
        timer = setTimeout(() => {
            timer = null;
            if (window.__simDragActive) return;
            fired = true;
            target.dispatchEvent(new MouseEvent("contextmenu", {
                bubbles: true, cancelable: true, view: window, clientX: startX, clientY: startY,
            }));
            navigator.vibrate?.(12);
        }, HOLD_MS);
    }, { passive: true });
    document.addEventListener("pointermove", (e) => {
        if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > SLOP) cancel();
    }, { passive: true });
    document.addEventListener("pointerup", cancel);
    document.addEventListener("pointercancel", cancel);
    document.addEventListener("contextmenu", (e) => {
        if (e.isTrusted && timer) { cancel(); fired = true; } // native long-press got there first
    }, true);
    // swallow the click that follows a long-press so it doesn't also activate the target
    document.addEventListener("click", (e) => {
        if (!fired) return;
        fired = false;
        e.stopPropagation();
        e.preventDefault();
    }, true);
})();

// Escape closes the topmost open popup (confirm dialogs handle their own).
const ESCAPE_HANDLERS = {
    packOpeningModalContainer: null, // mid-reveal; must finish via Confirm
    giftModalContainer: () => dismissGift(),
    summonNotesModalContainer: () => document.getElementById("summonNotesModalClose").click(),
    simulatorConditionalModalContainer: () => closeConditionalModal(),
    simulatorModalContainer: () => {
        simulatorModalContainer.classList.remove("active");
        simulatorModalBody.classList.remove("rearrange-body");
    },
    cardViewModalContainer: () => {
        cardViewModalContainer.classList.remove("active");
        cardViewImg.classList.remove("back");
    },
};

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || document.querySelector(".confirm-overlay")) return;

    if (simulatorContextMenu.classList.contains("active")) {
        simulatorContextMenu.classList.remove("active");
        return;
    }
    if (profileEntry.style.display === "flex") {
        document.body.click(); // runs the dropdown's outside-click close
        profileIcon.focus();
        return;
    }
    // modals inside an inactive section are invisible but may still carry .active
    const open = Array.from(document.querySelectorAll(".modal-container.active"))
        .filter(m => getComputedStyle(m).visibility !== "hidden");
    const top = open[open.length - 1];
    if (!top) {
        if (document.body.classList.contains("sim-fullscreen")) setSimFullscreen(false);
        return;
    }
    const handler = top.id in ESCAPE_HANDLERS ? ESCAPE_HANDLERS[top.id] : () => top.classList.remove("active");
    if (handler) handler();
});

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}