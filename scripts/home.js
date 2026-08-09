
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
    buildPullHistory();
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
        lastOpenedPackId = packId;
        lastOpenedPackResultsCopy = [...packResults];
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
            playSound(`pull-${soundRarity}`);

            // Rarity glow pulse on the card wrapper
            const glowColors = { Common: 'rgba(180,180,180,0.45)', Rare: 'rgba(55,135,255,0.65)', Legendary: 'rgba(255,175,30,0.82)', Mythic: 'rgba(175,75,255,0.85)', GT: 'rgba(255,200,30,0.85)' };
            const cardWrapper = nextCardEl.closest('.flip-card');
            if (cardWrapper) {
                cardWrapper.style.setProperty('--reveal-glow', glowColors[nextCardEl.dataset.rarity] || 'rgba(255,255,255,0.4)');
                cardWrapper.classList.remove('just-revealed');
                void cardWrapper.offsetWidth; // force reflow to restart animation
                cardWrapper.classList.add('just-revealed');
                setTimeout(() => cardWrapper.classList.remove('just-revealed'), 750);
            }

            // spawn particle burst on high rarity pulls
            try {
                const rarity = nextCardEl.dataset.rarity;
                if (rarity === 'Legendary' || rarity === 'Mythic' || rarity === 'GT') {
                    const particleType = (rarity === 'GT') ? 'mythic' : rarity.toLowerCase();
                    requestAnimationFrame(() => spawnParticlesAtElement(nextCardEl, particleType));
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
            // Staggered card entrance
            packOpeningResults.classList.add("cards-stagger");
            packOpeningResults.querySelectorAll('.flip-card').forEach((card, idx) => {
                card.style.animationDelay = `${idx * 85}ms`;
            });
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
        const rect = el.getBoundingClientRect();
        const layer = ensureParticleLayer();
        const cx = rect.left + rect.width  / 2;
        const cy = rect.top  + rect.height / 2;

        if (type === 'legendary') {
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

    packOpeningPackImage.classList.remove("slide-out-bottom");
    packOpeningPackImage.classList.remove("shake-horizontal");
    packOpeningResults.classList.remove("slide-in-bottom");
    packOpeningResults.classList.remove("cards-stagger");
    packOpeningResults.classList.add("slide-out-bottom");
    packConfirmButton.classList.remove("active");

    buildBinder(cards, packs);
    buildPacks();
    if (lastOpenedPackId) savePullToHistory(lastOpenedPackId, lastOpenedPackResultsCopy);
});

// ── Pull History ──────────────────────────────────────────────────────────────
const PULL_HISTORY_KEY   = 'DND_TCG_PULL_HISTORY';
const PULL_HISTORY_LIMIT = 48;

function loadPullHistory() {
    try { return JSON.parse(localStorage.getItem(PULL_HISTORY_KEY) || '[]'); }
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
    localStorage.setItem(PULL_HISTORY_KEY, JSON.stringify(updated));
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
        img.alt = entry.rarity;
        img.setAttribute('draggable', false);
        thumb.appendChild(img);

        if (entry.id !== 'GT') {
            thumb.addEventListener('click', () => { if (cards) openInCardViewModal(entry.id); });
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
            <span class="admin-header-hint">Ctrl+Shift+A</span>
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
        if (!currentProfile) { alert('No profile loaded'); return; }
        if (!cards || !getObjectById(cards, id)) { alert(`Card ID "${id}" not found`); return; }
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