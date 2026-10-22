
let packsWrapper = document.getElementById("packsWrapper");
let packsContainer = document.getElementById("packsContainer");
let packOpeningModalContainer = document.getElementById("packOpeningModalContainer");
let packOpeningPackImage = document.getElementById("packOpeningPackImage");
let packOpeningResults = document.getElementById("packOpeningResults");
let packConfirmButton = document.getElementById("packConfirmButton");
let blisterOpeningPack = document.getElementById("blisterOpeningPack");
makeActivatable(packOpeningPackImage, "Open the pack");
makeActivatable(blisterOpeningPack, "Open the blister pack");
makeActivatable(packOpeningResults, "Reveal the next card");

let packOpeningRarityTable = {
    0: { "Common": 100 },
    1: { "Common": 100 },
    2: { "Common": 100 },
    3: { "Rare": 100 },
    4: { "Rare": 100 },
    5: { "Rare": 80, "Legendary": 15, "Mythic": 5 }
}

let packResults = [];
let lastOpenedPackId = null;
let lastOpenedPackResultsCopy = [];

function buildPacks() {
    packsWrapper.style.display = "flex";
    packsContainer.innerHTML = '';
    packs.forEach(pack => {
        if (!pack.canBuyFromShop) return;

        let packCard = document.createElement("div");
        packCard.classList.add("pack-card");

        let packImg = document.createElement("img");
        packImg.src = `./assets/pack-art/${pack.id}.png`;
        packImg.alt = "";
        packImg.setAttribute("draggable", false);
        packCard.append(packImg);

        let packTitle = document.createElement("h3");
        packTitle.classList.add("pack-title");
        packTitle.textContent = pack.name;
        packCard.append(packTitle);

        let packMeta = document.createElement("div");
        packMeta.classList.add("pack-meta");
        packMeta.innerHTML = `<i class="bi bi-box-seam"></i> ${pack.cardPool.length} cards`;
        if (pack.limited) packMeta.innerHTML += ` · Limited Edition`;

        let ownedCount = 0;
        if (binder) {
            pack.cardPool.forEach(cardID => {
                if (binder[cardID] && binder[cardID] > 0) ownedCount++;
            });
        }
        const total = pack.cardPool.length;
        const isComplete = ownedCount === total;
        const pct = total > 0 ? (ownedCount / total) * 100 : 0;

        packCard.append(packMeta);

        const progressLabel = document.createElement("div");
        progressLabel.className = "pack-progress-label" + (isComplete ? " complete" : "");
        progressLabel.textContent = isComplete ? "✦ Complete set" : `${ownedCount} / ${total} unique`;
        packCard.append(progressLabel);

        const progressBar = document.createElement("div");
        progressBar.className = "pack-progress-bar";
        const progressFill = document.createElement("div");
        progressFill.className = "pack-progress-fill" + (isComplete ? " complete" : "");
        progressFill.style.width = `${pct}%`;
        progressBar.appendChild(progressFill);
        packCard.append(progressBar);

        // Stagger shimmer so cards don't all sweep at once
        packCard.style.setProperty('--shimmer-delay', `${Math.random() * 5}s`);
        if (isComplete) packCard.style.setProperty('--shimmer-dur', '4s');

        // Opening is the main action (the whole card is clickable); Preview sits beside it.
        let packActions = document.createElement("div");
        packActions.classList.add("pack-actions");
        let packCta = document.createElement("button");
        packCta.type = "button";
        packCta.classList.add("pack-cta");
        packCta.innerHTML = `<i class="bi bi-gift-fill"></i> Open Pack`;
        packCta.setAttribute("aria-label", `Open a ${pack.name} booster pack`);
        let previewBtn = document.createElement("button");
        previewBtn.type = "button";
        previewBtn.classList.add("pack-preview-btn");
        previewBtn.innerHTML = `<i class="bi bi-eye"></i> Preview`;
        previewBtn.title = "See every card in this pack and its odds";
        previewBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openPackPreview(pack.id);
        });
        packActions.append(packCta, previewBtn);
        packCard.append(packActions);

        const tickets = goldenTickets[pack.id] || 0;
        if (tickets > 0) {
            let ticketBtn = document.createElement("button");
            ticketBtn.type = "button";
            ticketBtn.classList.add("pack-ticket-badge");
            ticketBtn.innerHTML = `<i class="bi bi-ticket-perforated-fill"></i> ${tickets}`;
            ticketBtn.title = `${tickets} Golden Ticket${tickets === 1 ? "" : "s"}: click to pick a card`;
            ticketBtn.setAttribute("aria-label", ticketBtn.title);
            ticketBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                activeGoldenTicketPackId = pack.id;
                selectedGoldenTicketCardId = null;
                openPackPreview(pack.id);
            });
            packCard.append(ticketBtn);
        }

        packCard.addEventListener("click", () => openPack(pack.id));

        packCard.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            openPackPreview(pack.id);
        });

        packsContainer.append(packCard);
    });
    buildBlisterShelf();
    buildPullHistory();
}

/* ---------- Blister packs ----------
   Every Legendary/Mythic in the promos set has its own blister: a Common and a Rare from any
   non-limited set, plus that promo. A player holds at most one of each (profile.blisters),
   it opens once, and only an admin can hand one out or re-enable it. */

const PROMO_PACK_ID = 'promos';

function blisterPromos() {
    const pool = getObjectById(packs, PROMO_PACK_ID)?.cardPool || [];
    return pool.map(id => getObjectById(cards, id)).filter(c => c && (c.rarity === 'Legendary' || c.rarity === 'Mythic'));
}

function blisterName(promoId) {
    return `${getObjectById(cards, promoId)?.name || promoId} Blister Pack`;
}

// 'locked' (never given), 'ready' (given, unopened), or 'opened'
function blisterState(promoId, owned = blisters) {
    const b = owned?.[promoId];
    return !b ? 'locked' : b.opened ? 'opened' : 'ready';
}

// The blister look, drawn in HTML: cardboard backing with the promo showing through a plastic bubble.
function blisterHTML(promoId, { className = '' } = {}) {
    const card = getObjectById(cards, promoId);
    if (!card) return '';
    return `
        <div class="blister rarity-${card.rarity.toLowerCase()} ${className}">
            <span class="blister-hang" aria-hidden="true"></span>
            <span class="blister-brand">DnD TCG · Promo</span>
            <span class="blister-bubble">
                <img src="./assets/card-art/${card.id}.jpg" alt="${escapeHTML(card.name)}" draggable="false">
                <span class="blister-plastic" aria-hidden="true"></span>
            </span>
            <span class="blister-title">${escapeHTML(card.name)}</span>
            <span class="blister-sub">Blister Pack · 3 cards</span>
        </div>`;
}

function rollBlister(promoId) {
    const pool = new Set();
    packs.filter(p => !p.limited && p.id !== PROMO_PACK_ID).forEach(p => p.cardPool.forEach(id => pool.add(id)));
    const ofRarity = (r) => [...pool].map(id => getObjectById(cards, id)).filter(c => c && c.rarity === r);
    const pick = (list) => list[Math.floor(Math.random() * list.length)].id;
    return [pick(ofRarity('Common')), pick(ofRarity('Rare')), promoId]; // the promo is the finale
}

function buildBlisterShelf() {
    const shelf = document.getElementById('blisterShelf');
    const grid = document.getElementById('blisterContainer');
    const promos = blisterPromos();
    shelf.hidden = !promos.length || !currentProfile;
    if (shelf.hidden) return;
    grid.innerHTML = '';
    const got = promos.filter(c => blisterState(c.id) !== 'locked').length;
    document.getElementById('blisterShelfCount').textContent = `${got} / ${promos.length} collected`;

    for (const card of promos) {
        const state = blisterState(card.id);
        const info = blisters[card.id] || {};
        const item = document.createElement('div');
        item.className = `blister-item state-${state}`;
        const status = state === 'ready'
            ? `<button type="button" class="pack-cta blister-open"><i class="bi bi-scissors"></i> Open</button>`
            : state === 'opened'
                ? `<span class="blister-status"><i class="bi bi-check2-circle"></i> Opened${info.openedAt ? ` ${new Date(info.openedAt).toLocaleDateString()}` : ''}</span>`
                : `<span class="blister-status"><i class="bi bi-lock-fill"></i> A gift from your DM</span>`;
        item.innerHTML = `${blisterHTML(card.id)}<div class="blister-item-name">${escapeHTML(blisterName(card.id))}</div>${status}`;
        if (state === 'ready') {
            item.addEventListener('click', () => openBlister(card.id));
            makeActivatable(item, `Open the ${blisterName(card.id)}`);
        }
        grid.append(item);
    }
}

function openBlister(promoId) {
    if (!currentProfile) return;
    const state = blisterState(promoId);
    if (state !== 'ready') {
        showToast(state === 'opened' ? `You've already opened the ${blisterName(promoId)}.` : `You don't have the ${blisterName(promoId)} yet.`, 'info');
        return;
    }
    openPack(PROMO_PACK_ID, { blister: promoId });
}

let packPreviewModalContainer = document.getElementById("packPreviewModalContainer");
let packPreviewClose = document.getElementById("packPreviewClose");
let packPreviewLogo = document.getElementById("packPreviewLogo");
let packPreviewTitle = document.getElementById("packPreviewTitle");
let packPreviewStats = document.getElementById("packPreviewStats");
let packPreviewList = document.getElementById("packPreviewList");
let packPreviewUseTicketButton = document.getElementById("packPreviewUseTicketButton");
let activeGoldenTicketPackId = null;
let selectedGoldenTicketCardId = null;

function openPackPreview(packId) {
    let pack = getObjectById(packs, packId);
    let uniqueOwned = 0;
    pack.cardPool.forEach(cardID => {
        let card = getObjectById(cards, cardID);
        if (!card) return;
        if (binder[cardID] && binder[cardID] > 0) uniqueOwned++;
    });

    packPreviewLogo.src = `./assets/pack-art/${pack.id}-logo.png`;
    packPreviewLogo.alt = `${pack.name} logo`;
    packPreviewLogo.hidden = false;

    const ticketCount = goldenTickets[pack.id] || 0;
    packPreviewTitle.textContent = pack.name;
    packPreviewStats.innerHTML = `
        <div><i class="bi bi-box-seam"></i> ${pack.cardPool.length} unique cards</div>
        <div><i class="bi bi-check2-circle"></i> ${uniqueOwned} owned</div>
        <div><i class="bi bi-ticket-perforated-fill"></i> ${ticketCount} Golden Ticket${ticketCount === 1 ? "" : "s"}</div>
    `;

    packPreviewUseTicketButton.hidden = ticketCount <= 0;
    packPreviewUseTicketButton.disabled = ticketCount <= 0;
    if (activeGoldenTicketPackId === packId && selectedGoldenTicketCardId) {
        let selectedCard = getObjectById(cards, selectedGoldenTicketCardId);
        packPreviewUseTicketButton.textContent = selectedCard ? `Confirm ${selectedCard.name}` : "Use Golden Ticket";
    } else if (activeGoldenTicketPackId === packId) {
        packPreviewUseTicketButton.textContent = `Pick a card from ${pack.name}`;
    } else {
        packPreviewUseTicketButton.textContent = ticketCount > 0 ? `Use Golden Ticket (${ticketCount})` : "Use Golden Ticket";
    }
    packPreviewUseTicketButton.dataset.packId = packId;

    // precompute rarity counts from the pack for average odds
    let rarityCounts = { Common: 0, Rare: 0, Legendary: 0, Mythic: 0 };
    pack.cardPool.forEach(cardID => {
        let card = getObjectById(cards, cardID);
        if (!card) return;
        if (rarityCounts[card.rarity] === undefined) rarityCounts[card.rarity] = 0;
        rarityCounts[card.rarity]++;
    });

    packPreviewList.innerHTML = '';
    pack.cardPool.forEach(cardID => {
        let card = getObjectById(cards, cardID);
        if (!card) return;
        let cardEl = document.createElement("div");
        cardEl.classList.add("pack-preview-card");
        cardEl.classList.add(`rarity-${card.rarity.toLowerCase()}`);
        let owned = binder[cardID] && binder[cardID] > 0;
        if (!owned) cardEl.classList.add("missing");
        if (activeGoldenTicketPackId === pack.id && selectedGoldenTicketCardId === card.id) {
            cardEl.classList.add("selected");
        }

        let odds = 0;
        if (card.rarity === "Common" && rarityCounts.Common > 0) {
            let p = 1 / rarityCounts.Common;
            odds = 1 - Math.pow(1 - p, 3);
        } else if (card.rarity === "Rare" && rarityCounts.Rare > 0) {
            let p = 1 / rarityCounts.Rare;
            odds = 1 - Math.pow(1 - p, 2) * (1 - 0.8 * p);
        } else if (card.rarity === "Legendary" && rarityCounts.Legendary > 0) {
            odds = 0.15 / rarityCounts.Legendary;
        } else if (card.rarity === "Mythic" && rarityCounts.Mythic > 0) {
            odds = 0.05 / rarityCounts.Mythic;
        }
        let oddsText = odds > 0 ? `${(odds * 100).toFixed(2)}% avg pack odds` : "—";

        cardEl.innerHTML = `
            <button type="button" class="card-info-button pack-preview-info" aria-label="View details for ${escapeHTML(card.name)}" title="View card details"><i class="bi bi-info-lg"></i></button>
            <img src="./assets/card-art/${card.id}.jpg" alt="${escapeHTML(card.name)}" loading="lazy">
            <div class="pack-preview-card-details">
                <div class="pack-preview-card-name">${card.name}</div>
                <div class="pack-preview-card-meta">
                    <span class="pack-preview-card-rarity">${card.rarity}</span>
                    <span class="pack-preview-card-odds">${oddsText}</span>
                </div>
            </div>
        `;

        cardEl.querySelector(".pack-preview-info").addEventListener("click", (e) => {
            e.stopPropagation();
            openInCardViewModal(card.id);
        });
        makeActivatable(cardEl);
        cardEl.addEventListener("click", () => {
            if (activeGoldenTicketPackId === pack.id) {
                selectedGoldenTicketCardId = card.id;
                packPreviewList.querySelectorAll(".pack-preview-card.selected").forEach((el) => {
                    el.classList.remove("selected");
                });
                cardEl.classList.add("selected");
                packPreviewUseTicketButton.textContent = `Confirm ${card.name}`;
                return;
            }
            openInCardViewModal(card.id);
        });

        cardEl.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            openInCardViewModal(card.id);
        });

        packPreviewList.append(cardEl);
    });

    packPreviewModalContainer.classList.add("active");
}

function spendGoldenTicket(packId, cardId) {
    if (!currentProfile) return;
    if (!goldenTickets[packId] || goldenTickets[packId] <= 0) {
        showToast("You don't have a Golden Ticket for this pack.", "error");
        return;
    }

    if (!binder[cardId]) binder[cardId] = 0;
    binder[cardId] += 1;

    goldenTickets[packId] -= 1;
    if (goldenTickets[packId] <= 0) delete goldenTickets[packId];

    db.collection("profiles").doc(toKebabCase(currentProfile)).update({
        binder: binder,
        goldenTickets: goldenTickets
    });

    activeGoldenTicketPackId = null;
    selectedGoldenTicketCardId = null;
    packPreviewUseTicketButton.textContent = "Use Golden Ticket";
    showToast(`Golden Ticket redeemed for ${getObjectById(cards, cardId)?.name ?? cardId}.`, "success");
    openPackPreview(packId);
    buildBinder(cards, packs);
    buildPacks();
}

packPreviewUseTicketButton.addEventListener("click", () => {
    const packId = packPreviewUseTicketButton.dataset.packId;
    if (!packId) return;
    if (!goldenTickets[packId] || goldenTickets[packId] <= 0) {
        showToast("You don't have any Golden Tickets for this pack.", "error");
        return;
    }

    if (activeGoldenTicketPackId === packId && selectedGoldenTicketCardId) {
        spendGoldenTicket(packId, selectedGoldenTicketCardId);
        return;
    }

    activeGoldenTicketPackId = packId;
    selectedGoldenTicketCardId = null;
    packPreviewUseTicketButton.textContent = `Pick a card from ${getObjectById(packs, packId).name}`;
    openPackPreview(packId);
});

packPreviewClose.addEventListener("click", () => {
    packPreviewModalContainer.classList.remove("active");
});

packPreviewModalContainer.addEventListener("click", (event) => {
    if (event.target.id === "packPreviewModalContainer") {
        packPreviewModalContainer.classList.remove("active");
    }
});

const packStage = packOpeningModalContainer.querySelector(".pack-stage");
const RARITY_RANK = { Common: 0, Rare: 1, Legendary: 2, Mythic: 3, GT: 4 };

// Floating motes drift up behind the pack for the whole scene.
(function seedPackStageMotes() {
    const motes = packStage.querySelector(".pack-stage-motes");
    for (let i = 0; i < 22; i++) {
        const m = document.createElement("span");
        m.style.left = `${Math.random() * 100}%`;
        m.style.setProperty("--size", `${2 + Math.random() * 3}px`);
        m.style.setProperty("--drift", `${(Math.random() - 0.5) * 80}px`);
        m.style.animationDuration = `${9 + Math.random() * 9}s`;
        m.style.animationDelay = `${-Math.random() * 18}s`;
        motes.append(m);
    }
})();

function setPackStagePhase(phase) {
    packStage.classList.remove("stage-idle", "stage-torn", "stage-reveal", "stage-done");
    if (phase) packStage.classList.add(`stage-${phase}`);
}

function shakePackStage(strength) {
    const content = packStage.querySelector(".pack-stage-content");
    content.style.setProperty("--shake", `${strength}px`);
    content.classList.remove("stage-shake");
    void content.offsetWidth; // restart the animation
    content.classList.add("stage-shake");
}

function flashScreen(className) {
    if (prefersReducedMotion.matches) return;
    const flash = document.createElement("div");
    flash.className = `particle-flash ${className}`;
    document.body.append(flash);
    setTimeout(() => flash.remove(), 900);
}

function markNextFlipCard() {
    packOpeningResults.querySelectorAll(".flip-card.next-up").forEach(el => el.classList.remove("next-up"));
    const next = packOpeningResults.querySelector(".flip-card-content:not(.flipped)");
    if (next) next.closest(".flip-card").classList.add("next-up");
}

// `blister`: open that promo's blister pack instead of a booster.
function openPack(packId, { blister = null } = {}) {
    packResults = [];
    let pack = getObjectById(packs, packId);
    // the thing on stage: the booster's art, or the drawn blister
    const visual = blister ? blisterOpeningPack : packOpeningPackImage;
    packOpeningPackImage.hidden = !!blister;
    blisterOpeningPack.hidden = !blister;
    blisterOpeningPack.innerHTML = blister ? blisterHTML(blister) : '';

    packStage.dataset.peak = "";
    setPackStagePhase("idle");
    if (!blister) packOpeningPackImage.src = `./assets/pack-art/${pack.id}.png`;
    visual.classList.add("pack-enter");

    setTimeout(() => {
        visual.classList.remove("pack-enter");
        // only start the idle wiggle if the pack hasn't been torn open already
        if (packStage.classList.contains("stage-idle")) visual.classList.add("shake-horizontal");
    }, 900);

    packOpeningResults.innerHTML = '';

    visual.onclick = () => {
        visual.classList.remove("pack-enter", "shake-horizontal");
        if (blister) visual.querySelector('.blister').classList.add('peeled'); // the plastic bubble peels away
        else packOpeningPackImage.src = `./assets/pack-art/${pack.id}-open.png`;
        playSound("pack-open");
        visual.onclick = () => {};

        // The tear: flash, kick, and a spray of sparks from the pack
        setPackStagePhase("torn");
        visual.classList.add("pack-torn");
        flashScreen("tear-flash");
        shakePackStage(7);
        requestAnimationFrame(() => spawnParticlesAtElement(visual, 'tear'));

        packResults = blister ? rollBlister(blister) : generatePack(packId);
        lastOpenedPackId = packId;
        lastOpenedPackResultsCopy = [...packResults];
        for (let idx = 0; idx < packResults.length; idx++) {
            const cardId = packResults[idx];
            const rarity = cardId === "GT" ? "GT" : getObjectById(cards, cardId).rarity;
            let cardEl = document.createElement("div");
            cardEl.classList.add("flip-card");
            cardEl.style.setProperty("--i", idx);
            if (cardId === "GT") goldenTickets[pack.id] = (goldenTickets[pack.id] || 0) + 1;
            const backSrc = cardId === "GT" ? `./assets/GT.png` : `./assets/card-art/${cardId}.jpg`;
            const backAlt = cardId === "GT" ? "Golden Ticket" : escapeHTML(getObjectById(cards, cardId).name);
            cardEl.innerHTML = `
                <div class="flip-card-content" data-card-id="${cardId}" data-rarity="${rarity}">
                    <div class="front">
                        <img src="./assets/card-art/back.png" alt="Face-down card">
                    </div>
                    <div class="back">
                        <img src="${backSrc}" alt="${backAlt}">
                    </div>
                </div>
            `;

            cardEl.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                if (cardId !== "GT") openInCardViewModal(cardId);
            });

            if (cardId !== "GT") {
                // stops propagation itself, so it won't flip the next card
                cardEl.querySelector(".back").append(createCardInfoButton(getObjectById(cards, cardId)));
            }

            packOpeningResults.append(cardEl);

            // mark newly acquired cards (previously 0 -> now 1) with a NEW badge on the back
            if (cardId !== 'GT') {
                const prevCount = binder[cardId] || 0;
                binder[cardId] = prevCount + 1;
                if (prevCount === 0) {
                    const badge = document.createElement('div');
                    badge.classList.add('new-badge');
                    badge.textContent = 'NEW!';
                    cardEl.querySelector('.back').appendChild(badge);
                }
            }
        }
        const save = { binder: binder, goldenTickets: goldenTickets };
        if (blister) {
            // spent the moment it's opened, even if the reveal is skipped
            blisters[blister] = { ...(blisters[blister] || {}), opened: true, openedAt: Date.now() };
            save[`blisters.${blister}`] = blisters[blister];
        }
        db.collection("profiles").doc(toKebabCase(currentProfile)).update(save);

        packOpeningResults.onclick = () => {
            let nextCardEl = packOpeningResults.querySelector(".flip-card .flip-card-content:not(.flipped)");
            if (!nextCardEl) return;
            nextCardEl.classList.add("flipped");
            revealPackCard(nextCardEl);

            packResults.shift();
            markNextFlipCard();
            if (packResults.length === 0) {
                packOpeningResults.onclick = () => {};
                setTimeout(() => setPackStagePhase("done"), 700);
                setTimeout(() => {
                    packConfirmButton.classList.add("active");
                    packConfirmButton.focus({ preventScroll: true });
                }, 1300);
            }
        };

        // Deal: cards fly out of where the pack was and fan into place
        setTimeout(() => {
            setPackStagePhase("reveal");
            visual.classList.remove("pack-torn"); // its #id rule would outrank the exit animation
            visual.classList.add("slide-out-bottom");
            packOpeningResults.classList.remove("slide-out-bottom");
            const rowRect = packOpeningResults.getBoundingClientRect();
            const rowCenter = rowRect.left + rowRect.width / 2;
            packOpeningResults.querySelectorAll('.flip-card').forEach((card, idx, all) => {
                const r = card.getBoundingClientRect();
                card.style.setProperty('--deal-x', `${rowCenter - (r.left + r.width / 2)}px`);
                card.style.setProperty('--deal-rot', `${(idx - (all.length - 1) / 2) * -9}deg`);
                card.style.animationDelay = `${idx * 110}ms`;
            });
            packOpeningResults.classList.add("dealt", "cards-stagger");
            setTimeout(markNextFlipCard, 110 * packResults.length + 400);
            packOpeningResults.focus({ preventScroll: true });
        }, 900);
    }

    packOpeningModalContainer.classList.add("active");
    setTimeout(() => visual.focus({ preventScroll: true }), 500);
}

function revealPackCard(contentEl) {
    const rarity = contentEl.dataset.rarity;
    const cardWrapper = contentEl.closest('.flip-card');
    playSound("flip");
    playSound(`pull-${rarity === 'GT' ? 'mythic' : rarity.toLowerCase()}`);

    // The stage glow follows the best pull so far
    if ((RARITY_RANK[rarity] ?? 0) > (RARITY_RANK[packStage.dataset.peak] ?? -1)) {
        packStage.dataset.peak = rarity;
    }

    const glowColors = { Common: 'rgba(180,180,180,0.45)', Rare: 'rgba(55,135,255,0.65)', Legendary: 'rgba(255,175,30,0.82)', Mythic: 'rgba(175,75,255,0.85)', GT: 'rgba(255,200,30,0.85)' };
    cardWrapper.style.setProperty('--reveal-glow', glowColors[rarity] || 'rgba(255,255,255,0.4)');
    cardWrapper.classList.remove('just-revealed');
    void cardWrapper.offsetWidth; // force reflow to restart animation
    cardWrapper.classList.add('just-revealed', `revealed-${rarity.toLowerCase()}`);
    setTimeout(() => cardWrapper.classList.remove('just-revealed'), 750);

    if (RARITY_RANK[rarity] >= RARITY_RANK.Legendary) {
        const rays = document.createElement('div');
        rays.className = 'reveal-rays';
        cardWrapper.prepend(rays);
        setTimeout(() => rays.remove(), 1600);
        flashScreen(rarity === 'Legendary' ? 'legendary-flash' : 'mythic-flash');
        shakePackStage(rarity === 'Legendary' ? 5 : 9);
    }

    try {
        const particleType = { Rare: 'rare', Legendary: 'legendary', Mythic: 'mythic', GT: 'mythic' }[rarity];
        if (particleType) requestAnimationFrame(() => spawnParticlesAtElement(contentEl, particleType));
    } catch (err) { console.warn('particle spawn failed', err); }
}

function generatePack(packId) {
    let pack = getObjectById(packs, packId);
    let results = [];

    const cardsByRarity = {};
    for (const card of cards) {
        if (!cardsByRarity[card.rarity]) {
            cardsByRarity[card.rarity] = [];
        }
        cardsByRarity[card.rarity].push(card);
    }

    function pickWeighted(weights) {
        const entries = Object.entries(weights);
        const total = entries.reduce((sum, [, w]) => sum + w, 0);
        let rand = Math.random() * total;

        for (const [key, weight] of entries) {
            if (rand < weight) return key;
            rand -= weight;
        }
    }

    const GOLDEN_TICKET_ID = "GT";

    for (let i = 0; i < Object.keys(packOpeningRarityTable).length; i++) {
        // Admin override: force a specific result in slot 5
        if (i === 5 && adminOverrideSlot5) {
            const forced = adminOverrideSlot5;
            adminOverrideSlot5 = null;
            if (adminPanel) updateAdminOverrideStatus();
            if (forced === 'GT') { results.push('GT'); continue; }
            const forcedCards = (cardsByRarity[forced] || []).filter(c => pack.cardPool.includes(c.id));
            if (forcedCards.length > 0) {
                results.push(forcedCards[Math.floor(Math.random() * forcedCards.length)].id);
                continue;
            }
        }

        const rarityWeights = packOpeningRarityTable[i];
        const rarity = pickWeighted(rarityWeights);
        const validCards = cardsByRarity[rarity].filter(card => pack.cardPool.includes(card.id));
        const chosen = validCards[Math.floor(Math.random() * validCards.length)];
        const resultId = rarity === "Mythic" && Math.random() < 0.25
            ? GOLDEN_TICKET_ID
            : chosen.id;
        results.push(resultId);
    }

    return results;
}

    function ensureParticleLayer() {
        let layer = document.getElementById('particleLayer');
        if (!layer) {
            layer = document.createElement('div');
            layer.id = 'particleLayer';
            layer.className = 'particle-layer';
            document.body.appendChild(layer);
        }
        return layer;
    }

    const LEGENDARY_COLORS = ['#ffd700','#ffb700','#fff0a0','#ff9500','#ffe066','#ffdb4d','#ffffff'];
    const MYTHIC_COLORS    = ['#ff44ff','#44ffff','#ff0099','#9944ff','#44ff99','#ff9900','#00aaff','#ff66cc','#ccffee','#ffffff'];

    function spawnParticle(layer, cx, cy, rectW, rectH, shape, color, distMin, distMax, sizeMin, sizeMax, durMs, delayMs) {
        const p = document.createElement('div');
        p.className = `particle ${shape}`;

        const angle = Math.random() * Math.PI * 2;
        const dist  = distMin + Math.random() * (distMax - distMin);
        const size  = sizeMin + Math.random() * (sizeMax - sizeMin);
        const spin  = (Math.random() < 0.5 ? 1 : -1) * (180 + Math.random() * 540);
        const ox    = cx + (Math.random() - 0.5) * rectW * 0.22;
        const oy    = cy + (Math.random() - 0.5) * rectH * 0.22;

        p.style.left   = `${ox}px`;
        p.style.top    = `${oy}px`;
        p.style.width  = `${size}px`;
        p.style.height = shape === 'p-spark' ? `${size * 2.8}px` : `${size}px`;
        p.style.animationDuration = `${durMs}ms`;
        p.style.animationDelay    = `${delayMs}ms`;
        p.style.setProperty('--dx',    `${Math.cos(angle) * dist}px`);
        p.style.setProperty('--dy',    `${Math.sin(angle) * dist}px`);
        p.style.setProperty('--spin',  `${spin}deg`);
        p.style.setProperty('--color', color);

        layer.appendChild(p);
        setTimeout(() => { if (p.parentNode) p.remove(); }, durMs + delayMs + 50);
    }

    function spawnWave(layer, cx, cy, rectW, rectH, count, colors, shapes, distMin, distMax, sizeMin, sizeMax, durMin, durMax, baseDelay) {
        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const dur   = durMin + Math.random() * (durMax - durMin);
            const delay = baseDelay + i * (50 / count) + Math.random() * 30;
            spawnParticle(layer, cx, cy, rectW, rectH, shape, color, distMin, distMax, sizeMin, sizeMax, dur, delay);
        }
    }

    function spawnParticlesAtElement(el, type) {
        if (prefersReducedMotion.matches) return;
        const rect = el.getBoundingClientRect();
        const layer = ensureParticleLayer();
        const cx = rect.left + rect.width  / 2;
        const cy = rect.top  + rect.height / 2;

        if (type === 'tear') {
            // Pack rip — warm sparks plus a few bright flecks
            spawnWave(layer, cx, cy, rect.width, rect.height,
                34, ['#fff4d6','#ffd27a','#ffb347','#ffffff'], ['p-spark','p-spark','p-dot'],
                90, 260, 4, 9, 600, 1000, 0);
            spawnWave(layer, cx, cy, rect.width, rect.height,
                10, ['#ffffff','#fff0c0'], ['p-diamond'],
                40, 120, 6, 12, 500, 800, 40);

        } else if (type === 'rare') {
            // Small cool sparkle
            spawnWave(layer, cx, cy, rect.width, rect.height,
                20, ['#9fd0ff','#5aa8ff','#e6f3ff','#ffffff'], ['p-dot','p-diamond'],
                45, 120, 4, 9, 550, 850, 0);

        } else if (type === 'legendary') {
            // Core pop — bright tight burst from center
            spawnWave(layer, cx, cy, rect.width, rect.height,
                8, ['#ffffff','#fff5b0','#ffd700'], ['p-dot','p-diamond'],
                18, 55, 8, 18, 380, 560, 0);
            // Main radial burst
            spawnWave(layer, cx, cy, rect.width, rect.height,
                42, LEGENDARY_COLORS, ['p-dot','p-dot','p-diamond','p-spark'],
                75, 185, 5, 14, 680, 1050, 20);
            // Outer floating flares
            spawnWave(layer, cx, cy, rect.width, rect.height,
                14, ['#ffffff','#fffbe6','#ffd700','#ffb300'], ['p-dot','p-diamond'],
                55, 135, 7, 16, 820, 1250, 55);

        } else if (type === 'mythic') {
            // Shockwave rings — 4 rings, slightly larger
            for (let w = 0; w < 4; w++) {
                const ring = document.createElement('div');
                ring.className = 'particle-shockwave';
                ring.style.left  = `${cx}px`;
                ring.style.top   = `${cy}px`;
                ring.style.animationDelay = `${w * 110}ms`;
                ring.style.setProperty('--ring-size', `${rect.width * 0.32}px`);
                layer.appendChild(ring);
                setTimeout(() => ring.remove(), 850 + w * 110);
            }
            // Wave 1 — main rainbow burst, widest spread
            spawnWave(layer, cx, cy, rect.width, rect.height,
                52, MYTHIC_COLORS, ['p-dot','p-dot','p-diamond','p-spark'],
                85, 240, 6, 16, 950, 1500, 0);
            // Wave 2 — secondary fill
            spawnWave(layer, cx, cy, rect.width, rect.height,
                30, MYTHIC_COLORS, ['p-dot','p-spark'],
                55, 155, 4, 10, 750, 1100, 150);
            // Wave 3 — large glowing accents
            spawnWave(layer, cx, cy, rect.width, rect.height,
                12, ['#ffffff','#ee88ff','#88eeff','#ffee88','#ff88dd'], ['p-dot'],
                95, 210, 12, 26, 1100, 1650, 60);
            // Wave 4 — late-trail sparkles
            spawnWave(layer, cx, cy, rect.width, rect.height,
                18, MYTHIC_COLORS, ['p-dot','p-diamond'],
                40, 120, 4, 10, 600, 950, 280);
        }
    }

packConfirmButton.addEventListener("click", () => {
    packOpeningModalContainer.classList.remove("active");

    for (const visual of [packOpeningPackImage, blisterOpeningPack]) visual.classList.remove("slide-out-bottom", "shake-horizontal", "pack-enter", "pack-torn");
    packOpeningResults.classList.remove("dealt", "cards-stagger");
    packOpeningResults.classList.add("slide-out-bottom");
    packConfirmButton.classList.remove("active");
    setPackStagePhase(null);

    buildBinder(cards, packs);
    buildPacks();
    if (lastOpenedPackId) savePullToHistory(lastOpenedPackId, lastOpenedPackResultsCopy);
});

// ── Pull History ──────────────────────────────────────────────────────────────
const PULL_HISTORY_KEY   = 'DND_TCG_PULL_HISTORY';
const PULL_HISTORY_LIMIT = 48;

// Each profile has its own history. The old shared list moves to the first profile that logs in.
function pullHistoryKey() {
    if (!currentProfile) return null;
    const key = `${PULL_HISTORY_KEY}:${toKebabCase(currentProfile)}`;
    try {
        const legacy = localStorage.getItem(PULL_HISTORY_KEY);
        if (legacy !== null) {
            if (localStorage.getItem(key) === null) localStorage.setItem(key, legacy);
            localStorage.removeItem(PULL_HISTORY_KEY);
        }
    } catch { /* storage blocked */ }
    return key;
}

function loadPullHistory() {
    const key = pullHistoryKey();
    if (!key) return [];
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
}

function savePullToHistory(packId, cardIds) {
    const history = loadPullHistory();
    const newEntries = cardIds.map(id => ({
        id,
        rarity: id === 'GT' ? 'GT' : (getObjectById(cards, id)?.rarity || 'Common'),
        packId,
        ts: Date.now()
    }));
    const updated = [...newEntries, ...history].slice(0, PULL_HISTORY_LIMIT);
    const key = pullHistoryKey();
    if (key) {
        try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* storage full or blocked */ }
    }
    buildPullHistory();
}

function buildPullHistory() {
    const strip = document.getElementById('pullHistoryStrip');
    const section = document.getElementById('pullHistory');
    if (!strip || !section) return;

    const history = loadPullHistory();
    if (history.length === 0) { section.style.display = 'none'; return; }

    section.style.display = '';
    strip.innerHTML = '';

    history.slice(0, 24).forEach(entry => {
        const rarityLower = entry.rarity === 'GT' ? 'gt' : entry.rarity.toLowerCase();
        const cardName = entry.id === 'GT' ? 'Golden Ticket'
            : (cards ? getObjectById(cards, entry.id)?.name : null) || entry.id;

        const thumb = document.createElement('div');
        thumb.className = `pull-thumb rarity-${rarityLower}`;
        thumb.title = cardName;

        const img = document.createElement('img');
        if (entry.id === 'GT') {
            img.src = './assets/GT.png';
            img.style.objectFit = 'contain';
            img.style.background = '#b8820a';
        } else {
            img.src = `./assets/card-art/${entry.id}.jpg`;
        }
        img.alt = `${cardName} (${entry.rarity === 'GT' ? 'Golden Ticket' : entry.rarity})`;
        img.setAttribute('draggable', false);
        thumb.appendChild(img);

        if (entry.id !== 'GT') {
            thumb.addEventListener('click', () => { if (cards) openInCardViewModal(entry.id); });
            makeActivatable(thumb, `View ${cardName}`);
        }

        strip.appendChild(thumb);
    });
}

document.getElementById('pullHistoryToggle')?.addEventListener('click', () => {
    const strip = document.getElementById('pullHistoryStrip');
    const btn = document.getElementById('pullHistoryToggle');
    if (!strip || !btn) return;
    const hiding = strip.style.display !== 'none';
    strip.style.display = hiding ? 'none' : '';
    btn.textContent = hiding ? 'Show' : 'Hide';
});

buildPullHistory();

// ── Admin Panel ───────────────────────────────────────────────────────────────
let adminPanel = null;
let adminOverrideSlot5 = null; // 'Legendary' | 'Mythic' | 'GT' | null
const RARITY_TABLE_DEFAULTS = JSON.parse(JSON.stringify(packOpeningRarityTable));

document.addEventListener('keydown', (e) => {
    if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === '`' || e.key === '~')) {
        e.preventDefault();
        if (!isAdmin) return;
        if (!adminPanel) buildAdminPanel();
        adminPanel.classList.toggle('active');
        if (adminPanel.classList.contains('active')) refreshAdminBinderStats();
    }
});

function buildAdminPanel() {
    adminPanel = document.createElement('div');
    adminPanel.id = 'adminPanel';
    adminPanel.innerHTML = `
        <div class="admin-header">
            <span><i class="bi bi-shield-lock-fill"></i> Admin Panel</span>
            <span class="admin-header-hint">Shift + &#96;</span>
            <button class="admin-close" title="Close">✕</button>
        </div>
        <div class="admin-body">

            <div class="admin-section">
                <div class="admin-section-title">Force Slot 5 (Mythic slot) — next pack only</div>
                <div class="admin-btn-row" id="adminOvRow">
                    <button data-ov="Legendary">Force Legendary</button>
                    <button data-ov="Mythic">Force Mythic</button>
                    <button data-ov="GT">Force GT</button>
                    <button data-ov="">Clear</button>
                </div>
                <div id="adminOvStatus" class="admin-status">No override active</div>
            </div>

            <div class="admin-section">
                <div class="admin-section-title">Pack Rarity Weights</div>
                <div class="admin-rarity-table" id="adminRarityTable"></div>
                <div class="admin-btn-row">
                    <button id="adminRarityReset" class="btn-ghost">Reset to Defaults</button>
                </div>
            </div>

            <div class="admin-section">
                <div class="admin-section-title">Golden Tickets</div>
                <div class="admin-util-row">
                    <select id="adminTicketPack"></select>
                    <button id="adminGrantTicket">Grant Ticket</button>
                </div>
            </div>

            <div class="admin-section">
                <div class="admin-section-title">Add Card to Binder</div>
                <div class="admin-util-row">
                    <input id="adminCardId" type="text" placeholder="Card ID (number)" />
                    <button id="adminAddCard">Add</button>
                </div>
            </div>

            <div class="admin-section">
                <div class="admin-section-title">Test Particle Effects</div>
                <div class="admin-btn-row">
                    <button id="adminTestLegendary">Legendary</button>
                    <button id="adminTestMythic">Mythic</button>
                </div>
            </div>

            <div class="admin-section">
                <div class="admin-section-title">Card Effects Preview</div>
                <div class="admin-util-row">
                    <input id="adminFxCard" type="text" list="adminFxCardList" placeholder="Card name" />
                    <datalist id="adminFxCardList"></datalist>
                    <button id="adminFxPlay">Play</button>
                </div>
                <div id="adminFxInfo" class="admin-status">Pick a card to see which effect it uses</div>
            </div>

            <div class="admin-section">
                <div class="admin-section-title">Binder Stats</div>
                <div id="adminBinderStats" class="admin-stats"></div>
            </div>

        </div>
    `;
    document.body.appendChild(adminPanel);

    // Close button
    adminPanel.querySelector('.admin-close').addEventListener('click', () => {
        adminPanel.classList.remove('active');
    });

    // Override buttons
    adminPanel.querySelector('#adminOvRow').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ov]');
        if (!btn) return;
        adminOverrideSlot5 = btn.dataset.ov || null;
        updateAdminOverrideStatus();
    });

    // Rarity table
    buildAdminRarityTable();
    adminPanel.querySelector('#adminRarityReset').addEventListener('click', () => {
        Object.keys(RARITY_TABLE_DEFAULTS).forEach(slot => {
            packOpeningRarityTable[slot] = JSON.parse(JSON.stringify(RARITY_TABLE_DEFAULTS[slot]));
        });
        buildAdminRarityTable();
    });

    // Pack select for tickets
    const packSel = adminPanel.querySelector('#adminTicketPack');
    if (packs) packs.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        packSel.appendChild(opt);
    });

    adminPanel.querySelector('#adminGrantTicket').addEventListener('click', () => {
        const packId = packSel.value;
        if (!packId) return;
        goldenTickets[packId] = (goldenTickets[packId] || 0) + 1;
        if (currentProfile) {
            db.collection("profiles").doc(toKebabCase(currentProfile)).update({ goldenTickets });
        }
        const packName = packs ? (getObjectById(packs, packId)?.name || packId) : packId;
        adminPanel.querySelector('#adminGrantTicket').textContent = `Granted!`;
        setTimeout(() => { adminPanel.querySelector('#adminGrantTicket').textContent = 'Grant Ticket'; }, 1500);
    });

    // Add card
    adminPanel.querySelector('#adminAddCard').addEventListener('click', () => {
        const id = adminPanel.querySelector('#adminCardId').value.trim();
        if (!id) return;
        if (!currentProfile) { showToast('No profile loaded.', 'error'); return; }
        if (!cards || !getObjectById(cards, id)) { showToast(`Card ID "${id}" not found.`, 'error'); return; }
        binder[id] = (binder[id] || 0) + 1;
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({ binder });
        buildBinder(cards, packs);
        buildPacks();
        refreshAdminBinderStats();
        adminPanel.querySelector('#adminCardId').value = '';
    });

    // Particle tests — spawn off the panel itself
    adminPanel.querySelector('#adminTestLegendary').addEventListener('click', () => {
        spawnParticlesAtElement(adminPanel, 'legendary');
    });
    adminPanel.querySelector('#adminTestMythic').addEventListener('click', () => {
        spawnParticlesAtElement(adminPanel, 'mythic');
    });

    // Card effects preview: see which effect a card resolves to, and play it
    const fxInput = adminPanel.querySelector('#adminFxCard');
    const fxInfo = adminPanel.querySelector('#adminFxInfo');
    const playable = cards.filter(c => c.class !== 'Sleeve');
    adminPanel.querySelector('#adminFxCardList').innerHTML = playable.map(c => `<option value="${escapeHTML(c.name)}"></option>`).join('');
    const fxCard = () => playable.find(c => c.name.toLowerCase() === fxInput.value.trim().toLowerCase());
    fxInput.addEventListener('input', () => {
        const card = fxCard();
        const spec = card && resolveCardEffect(card);
        fxInfo.textContent = spec ? `${card.rarity} ${card.class} → ${spec.label}${card.rarity === 'Legendary' ? ' + gold flourish' : ''}` : 'Pick a card to see which effect it uses';
        fxInfo.className = spec ? 'admin-status on' : 'admin-status';
    });
    adminPanel.querySelector('#adminFxPlay').addEventListener('click', (e) => {
        const card = fxCard();
        if (!card) { showToast('Pick a card first.', 'error'); return; }
        if (cardFxMode === 'off') { showToast('Card effects are turned off in your account menu.', 'info'); return; }
        // aim at the newest summon on the board if there is one, so type effects have a card to play from
        const onBoard = simulatorSummonZone.querySelector('.summon-card-wrap:last-of-type img');
        e.stopPropagation();
        setTimeout(() => playCardEffect(card, onBoard), 0); // after this click, which would otherwise skip it
    });

    updateAdminOverrideStatus();
    refreshAdminBinderStats();
}

function buildAdminRarityTable() {
    const container = adminPanel.querySelector('#adminRarityTable');
    if (!container) return;
    container.innerHTML = '';
    Object.entries(packOpeningRarityTable).forEach(([slot, weights]) => {
        const row = document.createElement('div');
        row.className = 'admin-rarity-row';
        row.innerHTML = `<span class="admin-slot-label">Slot ${slot}</span>`;
        Object.entries(weights).forEach(([rarity, weight]) => {
            const field = document.createElement('label');
            field.className = 'admin-weight-field';
            field.innerHTML = `<span>${rarity.slice(0,3)}</span>`;
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.value = weight;
            inp.min = 0;
            inp.max = 9999;
            inp.addEventListener('change', () => {
                packOpeningRarityTable[slot][rarity] = Math.max(0, Number(inp.value));
            });
            field.appendChild(inp);
            row.appendChild(field);
        });
        container.appendChild(row);
    });
}

function updateAdminOverrideStatus() {
    if (!adminPanel) return;
    const statusEl = adminPanel.querySelector('#adminOvStatus');
    adminPanel.querySelectorAll('#adminOvRow [data-ov]').forEach(btn => {
        btn.classList.toggle('on', adminOverrideSlot5 && btn.dataset.ov === adminOverrideSlot5);
    });
    if (adminOverrideSlot5) {
        statusEl.textContent = `Next pack slot 5 → ${adminOverrideSlot5}`;
        statusEl.className = 'admin-status on';
    } else {
        statusEl.textContent = 'No override active';
        statusEl.className = 'admin-status';
    }
}

function refreshAdminBinderStats() {
    if (!adminPanel) return;
    const el = adminPanel.querySelector('#adminBinderStats');
    if (!el || !binder || !cards) return;
    const counts = {};
    let total = 0;
    Object.keys(binder).forEach(id => {
        const card = getObjectById(cards, id);
        if (!card) return;
        counts[card.rarity] = (counts[card.rarity] || 0) + (binder[id] || 0);
        total += (binder[id] || 0);
    });
    const order = ['Common','Rare','Legendary','Mythic'];
    const sorted = [...order.filter(r => counts[r]), ...Object.keys(counts).filter(r => !order.includes(r))];
    el.innerHTML = sorted.map(r => `<span>${r}: ${counts[r]}</span>`).join('') +
        (total ? `<span style="margin-left:4px;opacity:0.6">Total: ${total}</span>` : '<span>No cards</span>');
}