
let packsWrapper = document.getElementById("packsWrapper");
let packsContainer = document.getElementById("packsContainer");
let packOpeningModalContainer = document.getElementById("packOpeningModalContainer");
let packOpeningPackImage = document.getElementById("packOpeningPackImage");
let packOpeningResults = document.getElementById("packOpeningResults");
let packConfirmButton = document.getElementById("packConfirmButton");

let packOpeningRarityTable = {
    0: { "Common": 100 },
    1: { "Common": 100 },
    2: { "Common": 100 },
    3: { "Rare": 100 },
    4: { "Rare": 100 },
    5: { "Rare": 5, "Legendary": 5, "Mythic": 90 }
}

let packResults = [];

function buildPacks() {
    packsWrapper.style.display = "flex";
    packsContainer.innerHTML = '';
    packs.forEach(pack => {
        if (!pack.canBuyFromShop) return;

        let packCard = document.createElement("div");
        packCard.classList.add("pack-card");

        let packImg = document.createElement("img");
        packImg.src = `./assets/pack-art/${pack.id}.png`;
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
        let uniqueOwned = document.createElement("div");
        uniqueOwned.classList.add("pack-meta");
        uniqueOwned.textContent = ownedCount === pack.cardPool.length ? "Complete set" : `${ownedCount} owned`;

        packCard.append(packMeta);
        packCard.append(uniqueOwned);

        let packCta = document.createElement("div");
        packCta.classList.add("pack-cta");
        packCta.innerHTML = `<i class="bi bi-gift-fill"></i> Open Pack`;
        packCard.append(packCta);

        packCard.addEventListener("click", () => {
            if (confirm(`Open a ${pack.name} booster pack?`)) {
                openPack(pack.id);
            }
        });

        packCard.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            openPackPreview(pack.id);
        });

        packsContainer.append(packCard);
    });
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
            <img src="./assets/card-art/${card.id}.jpg" alt="${card.name}">
            <div class="pack-preview-card-details">
                <div class="pack-preview-card-name">${card.name}</div>
                <div class="pack-preview-card-meta">
                    <span class="pack-preview-card-rarity">${card.rarity}</span>
                    <span class="pack-preview-card-odds">${oddsText}</span>
                </div>
            </div>
        `;

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
        alert("You do not have a Golden Ticket for this pack.");
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
    openPackPreview(packId);
    buildBinder(cards, packs);
    buildPacks();
}

packPreviewUseTicketButton.addEventListener("click", () => {
    const packId = packPreviewUseTicketButton.dataset.packId;
    if (!packId) return;
    if (!goldenTickets[packId] || goldenTickets[packId] <= 0) {
        alert("You do not have any Golden Tickets for this pack.");
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

function openPack(packId) {
    packResults = [];
    let pack = getObjectById(packs, packId);
    // console.log(pack);

    packOpeningPackImage.src = `./assets/pack-art/${pack.id}.png`;
    packOpeningPackImage.classList.add("slide-in-bottom");

    setTimeout(() => {
        packOpeningPackImage.classList.remove("slide-in-bottom");
        packOpeningPackImage.classList.add("shake-horizontal");
    }, 500);

    packOpeningResults.innerHTML = '';

    packOpeningPackImage.onclick = () => {
        packOpeningPackImage.classList.remove("shake-horizontal");
        packOpeningPackImage.src = `./assets/pack-art/${pack.id}-open.png`;
        playSound("pack-open");
        packOpeningPackImage.onclick = () => {};
        packResults = generatePack(packId);
        console.log(packResults);
        for (let idx = 0; idx < packResults.length; idx++) {
            const c = idx;
            // console.log(getObjectById(cards, packResults[c]));
            let cardEl = document.createElement("div");
            cardEl.classList.add("flip-card");
            if (packResults[c] === "GT") {
                goldenTickets[pack.id] = (goldenTickets[pack.id] || 0) + 1;
                cardEl.innerHTML = `
                    <div class="flip-card-content" data-card-id="${packResults[c]}" data-rarity="GT">
                        <div class="front">
                            <img src="./assets/card-art/back.png">
                        </div>
                        <div class="back">
                            <img src="./assets/${packResults[c]}.png">
                        </div>
                    </div>
                `;
            } else {
                cardEl.innerHTML = `
                    <div class="flip-card-content" data-card-id="${packResults[c]}" data-rarity="${getObjectById(cards, packResults[c]).rarity}">
                        <div class="front">
                            <img src="./assets/card-art/back.png">
                        </div>
                        <div class="back">
                            <img src="./assets/card-art/${packResults[c]}.jpg">
                        </div>
                    </div>
                `;
            }

            cardEl.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                let content = cardEl.querySelector(".flip-card-content");
                if (content && content.dataset.cardId) {
                    openInCardViewModal(content.dataset.cardId);
                }
            });

            // detect newly acquired card (previously 0 -> now 1)
            const cardId = packResults[c];
            const content = cardEl.querySelector('.flip-card-content');
            let prevCount = 0;
            if (cardId !== 'GT') prevCount = binder[cardId] || 0;

            // append card element to DOM
            packOpeningResults.append(cardEl);

            if (cardId !== 'GT') {
                binder[cardId] = prevCount + 1;
                if (prevCount === 0) {
                    // mark as NEW on the back side of the flip card (visible after flipping)
                    const badge = document.createElement('div');
                    badge.classList.add('new-badge');
                    badge.textContent = 'NEW!';
                    const backEl = cardEl.querySelector('.back');
                    if (backEl) backEl.appendChild(badge);
                }
            }
        }
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({
            binder: binder,
            goldenTickets: goldenTickets
        });
        packOpeningResults.onclick = (e) => {
            // console.log(packResults);
            let nextCardEl = packOpeningResults.querySelector(".flip-card .flip-card-content:not(.flipped)");
            // console.log(nextCardEl);
            nextCardEl.classList.add("flipped");
            playSound("flip");
            // use mythic sound for Golden Ticket (GT)
            const soundRarity = nextCardEl.dataset.rarity === 'GT' ? 'mythic' : nextCardEl.dataset.rarity.toLowerCase();
            playSound(`pull-${soundRarity}`)

            // spawn particle burst on high rarity pulls
            try {
                const rarity = nextCardEl.dataset.rarity;
                if (rarity === 'Legendary' || rarity === 'Mythic' || rarity === 'GT') {
                    // map GT to mythic particle effects (more spectacular)
                    const particleType = (rarity === 'GT') ? 'mythic' : rarity.toLowerCase();
                    spawnParticlesAtElement(nextCardEl, particleType);
                }
            } catch (err) { console.warn('particle spawn failed', err); }

            packResults.shift();
            if (packResults.length === 0) {
                packOpeningResults.onclick = () => {}
                setTimeout(() => {
                    packConfirmButton.classList.add("active");
                }, 1000);
            }
        }
        setTimeout(() => {
            packOpeningPackImage.classList.add("slide-out-bottom");
            packOpeningResults.classList.remove("slide-out-bottom");
            packOpeningResults.classList.add("slide-in-bottom");
        }, 1000);
    }

    packOpeningModalContainer.classList.add("active");
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
        const rarityWeights = packOpeningRarityTable[i];

        const rarity = pickWeighted(rarityWeights);

        const validCards = cardsByRarity[rarity].filter(card =>
            pack.cardPool.includes(card.id)
        );

        const chosen = validCards[Math.floor(Math.random() * validCards.length)];
        const resultId = rarity === "Mythic" && Math.random() < 0.5
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

    function spawnParticlesAtElement(el, type) {
        const rect = el.getBoundingClientRect();
        const layer = ensureParticleLayer();
            const count = type === 'legendary' ? 22 : 18;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle ' + (type === 'legendary' ? 'legendary' : type === 'mythic' ? 'mythic' : '');
            // slight spread from center
            const rx = rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width * 1.6;
            const ry = rect.top + rect.height / 2 + (Math.random() - 0.5) * rect.height * 1.6;
            p.style.left = rx + 'px';
            p.style.top = ry + 'px';
            const size = (type === 'mythic' ? 8 + Math.random() * 18 : 6 + Math.random() * 12);
            p.style.width = size + 'px';
            p.style.height = size + 'px';
            // random rotation for variety
            p.style.transform = `translate(-50%, -50%) rotate(${Math.random()*360}deg)`;
            layer.appendChild(p);
                // no extra mythic-only sparkles; mythic uses same particle behavior as legendary
            setTimeout(() => { if (p && p.parentNode) p.remove(); }, 1200);
        }
    }

packConfirmButton.addEventListener("click", () => {
    packOpeningModalContainer.classList.remove("active");

    packOpeningPackImage.classList.remove("slide-out-bottom");
    packOpeningPackImage.classList.remove("shake-horizontal");
    packOpeningResults.classList.remove("slide-in-bottom");
    packOpeningResults.classList.add("slide-out-bottom");
    packConfirmButton.classList.remove("active");

    buildBinder(cards, packs);
    buildPacks();
});