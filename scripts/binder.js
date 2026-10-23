let binderContainer    = document.getElementById("binderContainer");
let binderFlatView     = document.getElementById("binderFlatView");
let binderSearch       = document.getElementById("binderSearch");
let binderMissingBtn   = document.getElementById("binderMissingToggle");
let binderClassFilter  = document.getElementById("binderClassFilter");
let binderRarityFilter = document.getElementById("binderRarityFilter");
let binderTypeFilter   = document.getElementById("binderTypeFilter");
let binderCollectionTotal = document.getElementById("binderCollectionTotal");

let binderMissingOnly  = false;
let binderViewMode     = 'pack'; // 'pack' | 'rarity'

const RARITY_ORDER = ['Mythic', 'Legendary', 'Rare', 'Common'];

// Collapsed packs are remembered, since the binder is rebuilt after every pack opening.
const BINDER_COLLAPSED_KEY = 'DND_TCG_BINDER_COLLAPSED';
const binderCollapsed = new Set((() => {
    try { return JSON.parse(localStorage.getItem(BINDER_COLLAPSED_KEY) || '[]'); }
    catch { return []; }
})());

function setPackCollapsed(packContainer, packAccordion, collapsed, animate) {
    const grid = packContainer.querySelector('.cards-container');
    const packId = packContainer.dataset.packId;
    if (collapsed) binderCollapsed.add(packId); else binderCollapsed.delete(packId);
    localStorage.setItem(BINDER_COLLAPSED_KEY, JSON.stringify([...binderCollapsed]));
    packAccordion.setAttribute('aria-expanded', String(!collapsed));

    if (!animate || prefersReducedMotion.matches) {
        packContainer.classList.toggle('collapse', collapsed);
        return;
    }
    grid.getAnimations().forEach(a => a.cancel());
    if (collapsed) {
        const h = grid.offsetHeight;
        grid.style.overflow = 'hidden';
        const anim = grid.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' }],
            { duration: 260, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
        packContainer.classList.add('collapse');
        grid.style.display = 'grid'; // stay visible until the animation ends
        anim.onfinish = anim.oncancel = () => { grid.style.display = ''; grid.style.overflow = ''; };
    } else {
        packContainer.classList.remove('collapse');
        const h = grid.offsetHeight;
        grid.style.overflow = 'hidden';
        const anim = grid.animate([{ height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' }, { height: `${h}px`, opacity: 1 }],
            { duration: 280, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
        anim.onfinish = anim.oncancel = () => { grid.style.overflow = ''; };
    }
}

function buildBinder(cards, packs) {
    binderContainer.innerHTML = '';

    packs.forEach(pack => {
        if (!pack.showInBinder) return;
        let packContainer = document.createElement("div");
        packContainer.classList.add("pack-container");
        packContainer.dataset.packId = pack.id;

        let packHeader = document.createElement("div");
        packHeader.classList.add("pack-header");

        let packLogo = document.createElement("img");
        packLogo.src = "./assets/pack-art/" + pack.id + "-logo.png";
        packLogo.alt = pack.name;
        packLogo.setAttribute("draggable", false);
        packHeader.append(packLogo);

        let packAccordion = document.createElement("div");
        packAccordion.classList.add("pack-accordion");
        packAccordion.innerHTML = `<i class="bi bi-chevron-up"></i>`;
        packAccordion.onclick = () => {
            setPackCollapsed(packContainer, packAccordion, !packContainer.classList.contains("collapse"), true);
        };
        makeActivatable(packAccordion, `Show or hide ${pack.name}`);
        packAccordion.setAttribute("aria-expanded", "true");
        packHeader.append(packAccordion);

        let cardsContainer = document.createElement("div");
        cardsContainer.classList.add("cards-container");

        let amountOwned = 0;
        pack.cardPool.forEach(cardID => {
            let card = getObjectById(cards, cardID);
            if (!card) return;
            cardsContainer.append(createCardEl(card, () => openInCardViewModal(cardID)));
            if (binder && binder[cardID] && binder[cardID] >= 1) amountOwned++;
        });

        let packCount = document.createElement("div");
        packCount.innerHTML = `<i class="bi bi-file-richtext"></i> <span>${amountOwned}</span> / ${pack.cardPool.length}`;
        packHeader.append(packCount);

        packContainer.append(packHeader);
        packContainer.append(cardsContainer);
        binderContainer.append(packContainer);
        if (binderCollapsed.has(pack.id)) setPackCollapsed(packContainer, packAccordion, true, false);
    });

    buildFlatView(cards, packs);
    populateBinderTypeFilter(cards);
    refreshCollectionTotal();
    applyBinderFilters();
}

function binderCardIds() {
    const ids = new Set();
    packs.forEach(pack => { if (pack.showInBinder) pack.cardPool.forEach(id => ids.add(id)); });
    return [...ids].filter(id => getObjectById(cards, id));
}

// "142 / 179 collected" across every card shown in the binder.
function refreshCollectionTotal() {
    if (!binderCollectionTotal || !cards || !packs) return;
    const ids = binderCardIds();
    const owned = ids.filter(id => binder && binder[id] >= 1).length;
    const pct = ids.length ? Math.round((owned / ids.length) * 100) : 0;
    binderCollectionTotal.innerHTML = `<i class="bi bi-collection"></i> <strong>${owned}</strong> / ${ids.length} collected <span>${pct}%</span>`;
    binderCollectionTotal.classList.toggle('complete', ids.length > 0 && owned === ids.length);
}

function populateBinderTypeFilter(cards) {
    if (binderTypeFilter.options.length > 1) return;
    [...new Set(cards.map(c => c.type).filter(Boolean))].sort()
        .forEach(type => binderTypeFilter.add(new Option(type, type)));
}

function buildFlatView(cards, packs) {
    binderFlatView.innerHTML = '';
    const allCards = [];
    const seen = new Set();

    packs.forEach(pack => {
        if (!pack.showInBinder) return;
        pack.cardPool.forEach(cardID => {
            if (seen.has(cardID)) return;
            seen.add(cardID);
            const card = getObjectById(cards, cardID);
            if (card) allCards.push(card);
        });
    });

    RARITY_ORDER.forEach(rarity => {
        const rarityCards = allCards
            .filter(c => c.rarity === rarity)
            .sort((a, b) => a.name.localeCompare(b.name));
        if (rarityCards.length === 0) return;

        const owned = rarityCards.filter(c => binder && binder[c.id] && binder[c.id] >= 1).length;

        const section = document.createElement("div");
        section.className = "binder-rarity-section";
        section.dataset.rarity = rarity;

        const header = document.createElement("div");
        header.className = "binder-rarity-header";

        const nameEl = document.createElement("span");
        nameEl.className = `binder-rarity-name rarity-${rarity.toLowerCase()}`;
        nameEl.textContent = rarity;

        const countEl = document.createElement("span");
        countEl.className = "binder-rarity-count";
        countEl.innerHTML = `<i class="bi bi-file-richtext"></i> ${owned} / ${rarityCards.length}`;

        header.append(nameEl, countEl);

        const grid = document.createElement("div");
        grid.className = "cards-container";

        rarityCards.forEach(card => {
            grid.append(createCardEl(card, () => openInCardViewModal(card.id)));
        });

        section.append(header, grid);
        binderFlatView.append(section);
    });
}

function binderCardMatches(img, search) {
    const card = getObjectById(cards, img.dataset.cardId);
    if (!card) return false;
    return cardMatchesSearch(card, search)
        && (!binderMissingOnly || !img.classList.contains('owned'))
        && (!binderClassFilter.value  || card.class === binderClassFilter.value)
        && (!binderRarityFilter.value || card.rarity === binderRarityFilter.value)
        && (!binderTypeFilter.value   || card.type === binderTypeFilter.value);
}

function applyBinderFilters() {
    const search = binderSearch.value.trim().toLowerCase();

    if (binderViewMode === 'pack') {
        document.querySelectorAll('#binderContainer .pack-container').forEach(pack => {
            let visible = 0;
            pack.querySelectorAll('.card-wrapper').forEach(wrapper => {
                const show      = binderCardMatches(wrapper.querySelector('.card'), search);
                wrapper.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            pack.style.display = visible > 0 ? '' : 'none';
        });
    } else {
        document.querySelectorAll('#binderFlatView .binder-rarity-section').forEach(section => {
            let visible = 0;
            section.querySelectorAll('.card-wrapper').forEach(wrapper => {
                const show      = binderCardMatches(wrapper.querySelector('.card'), search);
                wrapper.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            section.style.display = visible > 0 ? '' : 'none';
        });
    }
}

function setBinderView(mode) {
    binderViewMode = mode;
    binderContainer.style.display = mode === 'pack'   ? '' : 'none';
    binderFlatView.style.display  = mode === 'rarity' ? 'block' : 'none';
    document.querySelectorAll('.binder-view-toggle button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });
    applyBinderFilters();
}

// View toggle buttons
document.querySelectorAll('.binder-view-toggle button').forEach(btn => {
    btn.addEventListener('click', () => setBinderView(btn.dataset.view));
});

// Missing-only toggle
binderMissingBtn.addEventListener('click', () => {
    binderMissingOnly = !binderMissingOnly;
    binderMissingBtn.classList.toggle('active', binderMissingOnly);
    binderMissingBtn.querySelector('i').className = binderMissingOnly ? 'bi bi-eye' : 'bi bi-eye-slash';
    applyBinderFilters();
});

// Search + filters
binderSearch.addEventListener("input", applyBinderFilters);
[binderClassFilter, binderRarityFilter, binderTypeFilter].forEach(sel => sel.addEventListener("change", applyBinderFilters));
