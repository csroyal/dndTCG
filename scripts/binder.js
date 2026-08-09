let binderContainer    = document.getElementById("binderContainer");
let binderFlatView     = document.getElementById("binderFlatView");
let binderSearch       = document.getElementById("binderSearch");
let binderMissingBtn   = document.getElementById("binderMissingToggle");

let binderMissingOnly  = false;
let binderViewMode     = 'pack'; // 'pack' | 'rarity'

const RARITY_ORDER = ['Mythic', 'Legendary', 'Rare', 'Common'];

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
        packLogo.setAttribute("draggable", false);
        packHeader.append(packLogo);

        let packAccordion = document.createElement("div");
        packAccordion.classList.add("pack-accordion");
        packAccordion.innerHTML = `<i class="bi bi-chevron-down"></i>`;
        packAccordion.onclick = () => {
            packContainer.classList.toggle("collapse");
            packAccordion.innerHTML = packContainer.classList.contains("collapse")
                ? `<i class="bi bi-chevron-up"></i>`
                : `<i class="bi bi-chevron-down"></i>`;
        };
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
    });

    buildFlatView(cards, packs);
    applyBinderFilters();
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

function applyBinderFilters() {
    const search = binderSearch.value.toLowerCase();

    if (binderViewMode === 'pack') {
        document.querySelectorAll('#binderContainer .pack-container').forEach(pack => {
            let visible = 0;
            pack.querySelectorAll('.card-wrapper').forEach(wrapper => {
                const card     = wrapper.querySelector('.card');
                const nameMatch = !search || card.dataset.name.includes(search);
                const isOwned   = card.classList.contains('owned');
                const show      = nameMatch && (!binderMissingOnly || !isOwned);
                wrapper.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            pack.style.display = visible > 0 ? '' : 'none';
        });
    } else {
        document.querySelectorAll('#binderFlatView .binder-rarity-section').forEach(section => {
            let visible = 0;
            section.querySelectorAll('.card-wrapper').forEach(wrapper => {
                const card     = wrapper.querySelector('.card');
                const nameMatch = !search || card.dataset.name.includes(search);
                const isOwned   = card.classList.contains('owned');
                const show      = nameMatch && (!binderMissingOnly || !isOwned);
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

// Search
binderSearch.addEventListener("input", applyBinderFilters);
