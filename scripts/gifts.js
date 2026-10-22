/* ============================================================
   GIFTS — the player's side of an admin gift.

   Admin gifts land in the profile's `gifts` list (see adminApply in admin.js); the cards are
   already in the binder by then. This shows each gift as a pop-up, one at a time, and removes
   it from the list once it's been collected.
============================================================ */

const giftModalContainer = document.getElementById('giftModalContainer');
const giftModal = giftModalContainer.querySelector('.gift-modal');
const GIFT_RARITY_RANK = { Common: 0, Rare: 1, Legendary: 2, Mythic: 3 };
const GIFT_MAX_TILES = 10;

let giftQueue = [];
let giftShowing = null;
const giftSeen = new Set();

// Returns true if any of `list` is new (and so will pop up).
function queueGifts(list) {
    let added = false;
    for (const gift of list || []) {
        if (!gift || giftSeen.has(gift.id)) continue;
        giftSeen.add(gift.id);
        giftQueue.push(gift);
        added = true;
    }
    if (added) showNextGift();
    return added;
}

function clearGifts() {
    giftQueue = [];
    giftShowing = null;
    giftSeen.clear();
    giftModalContainer.classList.remove('active');
}

function showNextGift() {
    if (giftShowing || !giftQueue.length || !currentProfile) return;
    // wait for a quiet moment: not over a pack opening or a confirm dialog
    if (packOpeningModalContainer.classList.contains('active') || document.querySelector('.confirm-overlay')) {
        setTimeout(showNextGift, 1500);
        return;
    }
    giftShowing = giftQueue.shift();
    renderGift(giftShowing);
    giftModalContainer.classList.add('active');
}

function renderGift(gift) {
    const changes = gift.changes || {};
    const cardsGiven = Object.entries(changes.binder || {})
        .filter(([, n]) => n > 0)
        .map(([id, n]) => ({ card: getObjectById(cards, id), n }))
        .filter(x => x.card)
        .sort((a, b) => (GIFT_RARITY_RANK[b.card.rarity] ?? 0) - (GIFT_RARITY_RANK[a.card.rarity] ?? 0) || a.card.name.localeCompare(b.card.name));
    const tickets = Object.entries(changes.goldenTickets || {}).filter(([, n]) => n > 0);
    const blistersGiven = Object.entries(changes.blisters || {}).filter(([, [, after]]) => after === 'ready').map(([id]) => id);
    const totalCards = cardsGiven.reduce((a, x) => a + x.n, 0);
    const totalTickets = tickets.reduce((a, [, n]) => a + n, 0);

    const tiles = [
        ...blistersGiven.map(id => `
            <div class="gift-tile gift-blister" title="${escapeHTML(blisterName(id))}">
                ${blisterHTML(id, { className: 'mini' })}
                <span class="gift-tile-name">${escapeHTML(blisterName(id))}</span>
            </div>`),
        ...tickets.map(([packId, n]) => `
            <div class="gift-tile gift-ticket rarity-gt" title="${escapeHTML(getObjectById(packs, packId)?.name || packId)} Golden Ticket">
                <img src="./assets/GT.png" alt="Golden Ticket">
                ${n > 1 ? `<span class="gift-qty">×${n}</span>` : ''}
                <span class="gift-tile-name">${escapeHTML(getObjectById(packs, packId)?.name || packId)}</span>
            </div>`),
        ...cardsGiven.slice(0, GIFT_MAX_TILES).map(({ card, n }) => `
            <div class="gift-tile rarity-${card.rarity.toLowerCase()}" title="${escapeHTML(card.name)}">
                <img src="./assets/card-art/${card.id}.jpg" alt="${escapeHTML(card.name)}">
                ${n > 1 ? `<span class="gift-qty">×${n}</span>` : ''}
            </div>`),
    ];
    const hidden = cardsGiven.length - GIFT_MAX_TILES;
    if (hidden > 0) tiles.push(`<div class="gift-tile gift-more"><span>+${hidden}<small>more</small></span></div>`);

    const summary = [
        totalCards ? `${totalCards} card${totalCards === 1 ? '' : 's'}` : '',
        totalTickets ? `${totalTickets} Golden Ticket${totalTickets === 1 ? '' : 's'}` : '',
        blistersGiven.length ? (blistersGiven.length === 1 ? 'a Blister Pack' : `${blistersGiven.length} Blister Packs`) : '',
    ].filter(Boolean).join(' and ').replace(/^./, ch => ch.toUpperCase());

    giftModal.innerHTML = `
        <div class="gift-ribbon" aria-hidden="true"><i class="bi bi-gift-fill"></i></div>
        <h2 id="giftTitle">A gift from ${escapeHTML(gift.from || 'the DM')}</h2>
        ${gift.message ? `<blockquote class="gift-message">${escapeHTML(gift.message)}</blockquote>` : ''}
        <div class="gift-cards">${tiles.join('')}</div>
        <p class="gift-summary">${summary} added to your collection.${blistersGiven.length ? ' Open blister packs from the Home page.' : ''}</p>
        <button type="button" class="btn-accent gift-ok">${giftQueue.length ? `Collect (${giftQueue.length} more gift${giftQueue.length === 1 ? '' : 's'})` : 'Collect'}</button>`;

    giftModal.querySelectorAll('.gift-tile').forEach((tile, i) => { tile.style.animationDelay = `${120 + i * 70}ms`; });
    giftModal.querySelector('.gift-ok').addEventListener('click', dismissGift);
    setTimeout(() => giftModal.querySelector('.gift-ok')?.focus({ preventScroll: true }), 50);

    // celebrate the best thing in the box
    const best = blistersGiven.length || tickets.length ? 'GT' : cardsGiven[0]?.card.rarity;
    playSound(best === 'GT' || best === 'Mythic' ? 'pull-mythic' : best === 'Legendary' ? 'pull-legendary' : 'pull-rare');
    if (best === 'GT' || best === 'Mythic' || best === 'Legendary') {
        setTimeout(() => {
            const tile = giftModal.querySelector('.gift-tile');
            if (tile && giftModalContainer.classList.contains('active')) spawnParticlesAtElement(tile, best === 'Legendary' ? 'legendary' : 'mythic');
        }, 450);
    }
}

async function dismissGift() {
    const gift = giftShowing;
    if (!gift) return;
    giftShowing = null;
    giftModalContainer.classList.remove('active');
    try {
        const ref = profileDoc(currentProfile);
        const doc = await ref.get();
        const remaining = (doc.data()?.gifts || []).filter(g => g.id !== gift.id);
        await ref.update({ gifts: remaining });
    } catch (err) {
        console.warn('Couldn\'t clear the gift; it will show again next time.', err);
        giftSeen.delete(gift.id);
    }
    setTimeout(showNextGift, 350);
}

giftModalContainer.addEventListener('click', (e) => { if (e.target === giftModalContainer) dismissGift(); });
