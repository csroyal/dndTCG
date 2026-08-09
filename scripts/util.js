let cards;
let packs;
let binder = {};
let goldenTickets = {};
let decks = [];
let sleeve = {};

fetch("./data/cards.json")
    .then(res => res.json())
    .then(data => {
        cards = data;
        fetch("./data/packs.json")
            .then(res => res.json())
            .then(data2 => {
                packs = data2;
                buildBinder(data, data2);
            });
    });


let menuButtons = document.querySelectorAll("#menu .menu-button");
let cardViewModalContainer = document.getElementById("cardViewModalContainer");
let cardViewImg = cardViewModalContainer.querySelector("img");
let cardViewControls = document.querySelector(".card-view-controls");

function setActiveNav(sectionId) {
    menuButtons.forEach(btn => {
        btn.classList.toggle("active-nav", btn.dataset.section === sectionId);
    });
}

const storedSection = localStorage.getItem("DND_TCG_LATEST_SECTION");
if (storedSection) {
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

function loadProfile(profileName) {
    currentProfile = profileName;
    localStorage.setItem("DND_TCG_LATEST_PROFILE", profileName);

    document.querySelector("#profileInfo p span").innerHTML = profileName;
    document.querySelector("#profileInfo").style.display = "flex";
    document.querySelector("#profileLogin").style.display = "none";
    db.collection("profiles").doc(toKebabCase(profileName)).get().then((doc) => {
        if (doc.data().profilePictureURL) {
            document.querySelector("#profileIcon i").style.display = "none";
            document.querySelector("#profilePictureImage").src = doc.data().profilePictureURL;
            document.querySelector("#profilePictureImage").style.display = "block";
        }
        if (doc.data().binder) {
            binder = doc.data().binder;
            buildBinder(cards, packs);
        }
        if (doc.data().goldenTickets) {
            goldenTickets = doc.data().goldenTickets;
        } else {
            goldenTickets = {};
        }
        if (doc.data().decks) {
            decks = doc.data().decks;
        }
        if (doc.data().sleeve) {
            sleeve = doc.data().sleeve;
        }
        buildPacks();
        buildDecks();
        buildSleeve();
        buildDeckSelect();
    }).catch((error) => {
        console.error("Error getting document:", error);
    });
}

function createProfile(profileName) {
    db.collection("profiles").doc(toKebabCase(profileName)).set({
        name: profileName,
        goldenTickets: {}
    }).then(() => {
        console.log("New profile created:", profileName);
    })
    .catch((error) => {
        console.error("Error writing document: ", error);
    });
}

function unloadProfile() {
    document.querySelector("#profileInfo").style.display = "none";
    document.querySelector("#profileLogin").style.display = "flex";
    document.querySelector("#profileIcon i").style.display = "block";
    document.querySelector("#profilePictureImage").style.display = "none";
    binder = {};
    goldenTickets = {};
    buildBinder(cards, packs);
    decksContainer.innerHTML = '';
    decksContainer.querySelector("p").style.display = "none";
}

function createCardEl(card, func, includeBadge = true, sleeveCount = false, deckIconSelectable = false) {
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
    cardEl.classList.add("card");
    cardEl.setAttribute("draggable", false);
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

    if (deckIconSelectable) {
        let iconButton = document.createElement("button");
        iconButton.type = "button";
        iconButton.classList.add("deck-icon-select-button");
        iconButton.innerHTML = `<i class="bi bi-pin-angle-fill"></i>`;
        iconButton.title = "Set this card as deck icon";
        if (typeof isDeckIconSelected === "function" && isDeckIconSelected(card.id)) {
            iconButton.classList.add("selected");
        }
        iconButton.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof setDeckIcon === "function") setDeckIcon(card.id);
        });
        cardWrapper.append(iconButton);
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
            sleeveCountSpan.innerHTML = Number(sleeveCountSpan.innerHTML) - 1;

            if (sleeve[card.id]) sleeve[card.id] = sleeve[card.id] - 1;
            if (sleeve[card.id] === 0) delete sleeve[card.id];
            db.collection("profiles").doc(toKebabCase(currentProfile)).update({
                sleeve: sleeve
            });

            if (Number(span.innerHTML) === 0) {
                sleeveOverlay.style.display = "none";
            }
        });

        sleeveOverlay.querySelector(".plus-minus-button div:nth-child(2)").addEventListener("click", () => {
            if (!checkSleeveRestrictions(card)) return;
            let span = sleeveOverlay.querySelector("span");
            if (Number(span.innerHTML) >= binder[card.id]) {
                alert("You don't have any more copies of this card.");
                return;
            }
            if (Number(sleeveCountSpan.innerHTML) >= SLEEVE_LIMIT) {
                alert("You can only have up to 12 cards in your current sleeve.");
                return;
            }
            span.innerHTML = Number(span.innerHTML) + 1;
            sleeveCountSpan.innerHTML = Number(sleeveCountSpan.innerHTML) + 1;

            if (sleeve[card.id]) sleeve[card.id] = sleeve[card.id] + 1;
            else sleeve[card.id] = 1;
            db.collection("profiles").doc(toKebabCase(currentProfile)).update({
                sleeve: sleeve
            });

            sleeveOverlay.style.display = "flex";
        });


        cardWrapper.append(sleeveOverlay);
    }

    cardEl.addEventListener("click", func);

    cardEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openInCardViewModal(card.id);
    });

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

let _cardFormForms = null;
let _cardFormIdx   = 0;

function getCardForms(cardID) {
    const card = getObjectById(cards, cardID);
    if (card && card.forms) return card.forms;
    const base = cards.find(c => c.forms && c.forms.includes(cardID));
    return base ? base.forms : null;
}

function _applyCardViewCard(cardID) {
    cardViewImg.src = "./assets/card-art/" + cardID + ".jpg";
    cardViewImg.setAttribute("data-card-id", cardID);
    cardViewImg.setAttribute("data-rarity", getObjectById(cards, cardID).rarity);
    const ownedCount = binder && binder[cardID] ? binder[cardID] : 0;
    cardViewCountDisplay.textContent = ownedCount;
    updateCardViewButtons(ownedCount, cardID);
    cardViewImg.classList.toggle("owned", ownedCount >= 1);
}

function openInCardViewModal(cardID) {
    playSound("draw");
    _applyCardViewCard(cardID);

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
    let cardID = cardViewImg.dataset.cardId;
    let currentCount = binder[cardID] || 0;
    if (currentCount <= 0) return;
    currentCount--;
    if (currentCount > 0) binder[cardID] = currentCount;
    else delete binder[cardID];
    cardViewCountDisplay.textContent = currentCount;
    updateCardViewButtons(currentCount, cardID);
    cardViewImg.classList.toggle("owned", currentCount > 0);
    updateBinderCardDisplay(cardID, currentCount);
    if (currentProfile) {
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({ binder: binder });
    }
});

cardViewCountIncrease.addEventListener("click", () => {
    let cardID = cardViewImg.dataset.cardId;
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
            cardViewImg.src = "./assets/card-art/" + card.id + "-back.jpg";
        }
        cardViewImg.classList.toggle("back");
    }
});

function playSound(soundName) {
    var sound = new Audio(`./assets/sounds/${soundName}.mp3`);
    sound.volume = 0.75;
    sound.play();
}

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
    const icons = { error: 'bi-exclamation-circle-fill', success: 'bi-check-circle-fill', info: 'bi-info-circle-fill' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.append(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    }, 3200);
}

function showConfirm(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <p>${message}</p>
                <div class="confirm-buttons">
                    <button class="btn-ghost confirm-cancel">Cancel</button>
                    <button class="danger confirm-ok">Confirm</button>
                </div>
            </div>`;
        document.body.append(overlay);
        const close = (result) => { overlay.remove(); resolve(result); };
        overlay.querySelector('.confirm-cancel').onclick = () => close(false);
        overlay.querySelector('.confirm-ok').onclick    = () => close(true);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
    });
}

function showInput(message, placeholder = '', defaultValue = '') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <p>${message}</p>
                <input class="input-modal-field" type="number" placeholder="${placeholder}" value="${defaultValue}" min="1" step="1">
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
            if (e.key === 'Escape') close(null);
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
    'rift': 'Rift',
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

function _makeCanvas(section, cb) {
    _clearSimBg();
    const gen = _simBgGen;
    const c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1;';
    section.insertBefore(c, section.firstChild);
    requestAnimationFrame(() => {
        if (_simBgGen !== gen) { c.remove(); return; }
        c.width  = section.clientWidth  || window.innerWidth  - 80;
        c.height = section.clientHeight || window.innerHeight - 52;
        _simBgCanvas = c;
        cb(c.getContext('2d'), c.width, c.height, c);
    });
}

function _startStars(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const stars = Array.from({ length: 220 }, () => ({
            x:     Math.random() * W,
            y:     Math.random() * H,
            r:     Math.random() * 1.4 + 0.2,
            phase: Math.random() * Math.PI * 2,
            spd:   Math.random() * 0.016 + 0.003,
            base:  Math.random() * 0.35 + 0.08,
        }));
        // A handful of large bright "hero" stars
        for (let i = 0; i < 12; i++) {
            stars.push({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.2+1.4,
                         phase: Math.random()*Math.PI*2, spd: Math.random()*0.01+0.002, base: 0.55 });
        }
        function draw() {
            if (_simBgCanvas !== canvas) return;
            ctx.clearRect(0, 0, W, H);
            for (const s of stars) {
                s.phase += s.spd;
                const a = s.base + (Math.sin(s.phase) * 0.5 + 0.5) * (0.9 - s.base);
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
                ctx.fill();
            }
            _simBgFrame = requestAnimationFrame(draw);
        }
        _simBgFrame = requestAnimationFrame(draw);
    });
}

function _startSnow(section) {
    _makeCanvas(section, (ctx, W, H, canvas) => {
        const flakes = Array.from({ length: 140 }, () => ({
            x:     Math.random() * W,
            y:     Math.random() * H,
            r:     Math.random() * 2.4 + 0.5,
            spd:   Math.random() * 0.75 + 0.2,
            phase: Math.random() * Math.PI * 2,
            a:     Math.random() * 0.45 + 0.3,
        }));
        function draw() {
            if (_simBgCanvas !== canvas) return;
            ctx.clearRect(0, 0, W, H);
            for (const f of flakes) {
                f.y     += f.spd;
                f.phase += 0.015;
                f.x     += Math.sin(f.phase) * 0.38;
                if (f.y > H + 5) { f.y = -5; f.x = Math.random() * W; }
                if (f.x > W + 5) f.x = -5;
                if (f.x < -5)    f.x = W + 5;
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(210,230,255,${f.a.toFixed(3)})`;
                ctx.fill();
            }
            _simBgFrame = requestAnimationFrame(draw);
        }
        _simBgFrame = requestAnimationFrame(draw);
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
        function draw() {
            if (_simBgCanvas !== canvas) return;
            ctx.clearRect(0, 0, W, H);
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
            _simBgFrame = requestAnimationFrame(draw);
        }
        _simBgFrame = requestAnimationFrame(draw);
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
        const embers = Array.from({ length: 55 }, mk);
        function draw() {
            if (_simBgCanvas !== canvas) return;
            ctx.clearRect(0, 0, W, H);
            for (const e of embers) {
                e.life += e.lifeSpd;
                if (e.life >= 1) { Object.assign(e, mk(), { life: 0 }); continue; }
                const t = e.life;
                const a = t < 0.18 ? t / 0.18 : t > 0.65 ? (1 - t) / 0.35 : 1;
                // heat: orange at birth → yellow-white as it rises
                const heat = Math.min(1, t * 1.8);
                const g = Math.floor(90 + heat * 165);
                const b = Math.floor(heat * 70);
                e.y     -= e.spd;
                e.phase += 0.028;
                e.x     += Math.sin(e.phase) * 0.5;
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
            _simBgFrame = requestAnimationFrame(draw);
        }
        _simBgFrame = requestAnimationFrame(draw);
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

        function draw() {
            if (_simBgCanvas !== canvas) return;
            ctx.clearRect(0, 0, W, H);

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

            _simBgFrame = requestAnimationFrame(draw);
        }
        _simBgFrame = requestAnimationFrame(draw);
    });
}

function _launchParticles(bg, section) {
    if (bg === 'stars')  _startStars(section);
    else if (bg === 'snow')   _startSnow(section);
    else if (bg === 'arcane') _startArcane(section);
    else if (bg === 'ember')  _startEmbers(section);
    else if (bg === 'rift')   _startRift(section);
    else _clearSimBg();
}

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
    const saved = localStorage.getItem('DND_TCG_SIM_BG') ?? '';
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

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}