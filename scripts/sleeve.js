let currentSleeve = document.getElementById("currentSleeve");
let activeSleeve = document.getElementById("activeSleeve");
let sleeveCountSpan = document.querySelector("#sleeveCount span");
let createActiveSleeveButton = document.getElementById("createActiveSleeveButton");

const SLEEVE_LIMIT = 12;
const ACTIVE_SLEEVE_COUNT = 6;
let sleeveRarityRestrictions = { "Legendary": 1, "Mythic": 1 };

function buildSleeve() {
    currentSleeve.innerHTML = "";

    let sleeveCardCount = 0;
    for (const id in binder) {
        const card = getObjectById(cards, id);
        if (!card || card.class !== "Sleeve") continue;
        sleeveCardCount++;
        currentSleeve.append(createCardEl(card, (e) => {
            addCardToSleeve(card, e.target.parentElement.querySelector(".sleeve-overlay"));
        }, true, true, true));
    }
    sortCurrentSleeve();

    if (sleeveCardCount === 0) {
        const empty = document.createElement("p");
        empty.id = "sleeveEmptyState";
        empty.className = "empty-state";
        empty.textContent = currentProfile
            ? "You don't own any sleeve cards yet. Open packs to find them!"
            : "Log in to manage your sleeve.";
        currentSleeve.append(empty);
    }

    for (const id in sleeve) {
        const cardWrapper = currentSleeve.querySelector(`.card-wrapper:has(img[data-card-id="${id}"])`);
        if (!cardWrapper) continue; // sleeved card no longer in the binder
        cardWrapper.querySelector(".sleeve-overlay span").innerHTML = sleeve[id];
        cardWrapper.querySelector(".sleeve-overlay").style.display = "flex";
    }

    refreshSleeveStats();
}

function addCardToSleeve(card, sleeveOverlay) {
    if (!checkSleeveRestrictions(card)) return;
    const span = sleeveOverlay.querySelector("span");
    if (Number(span.innerHTML) >= binder[card.id]) {
        showToast("No more copies of this card available.", "error");
        return;
    }
    span.innerHTML = Number(span.innerHTML) + 1;
    sleeve[card.id] = (sleeve[card.id] || 0) + 1;
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({
        sleeve: sleeve
    });
    sleeveOverlay.style.display = "flex";
    refreshSleeveStats();
}

// Keeps the count pill, the rule meters, and the shuffle button in sync with `sleeve`.
function refreshSleeveStats() {
    const total = getCountCurrentSleeve();
    sleeveCountSpan.textContent = total;
    document.getElementById("sleeveCount").classList.toggle("full", total >= SLEEVE_LIMIT);

    document.querySelectorAll("#sleeveRules .sleeve-rule").forEach(row => {
        const rarity = row.dataset.rarity;
        const used = getRarityCountFromSleeve(rarity);
        const max = sleeveRarityRestrictions[rarity];
        row.querySelector(".sleeve-rule-val").textContent = `${used} / ${max}`;
        row.classList.toggle("full", used >= max);
    });

    const canShuffle = total >= ACTIVE_SLEEVE_COUNT;
    createActiveSleeveButton.disabled = !canShuffle;
    createActiveSleeveButton.title = canShuffle ? "" : `Add at least ${ACTIVE_SLEEVE_COUNT} cards to your sleeve first`;
}

function sortCurrentSleeve() {
    const container = document.querySelector("#currentSleeve");

    const cards = Array.from(container.querySelectorAll('.card-wrapper'));

    cards
        .sort((a, b) => {
            const idA = parseInt(a.querySelector('img').dataset.cardId, 10);
            const idB = parseInt(b.querySelector('img').dataset.cardId, 10);
            return idA - idB;
        })
        .forEach(card => container.appendChild(card));
}

function sortActiveSleeve() {
    const container = document.querySelector("#activeSleeve");

    const cards = Array.from(container.querySelectorAll('.card-wrapper'));

    cards
        .sort((a, b) => {
            const idA = parseInt(a.querySelector('img').dataset.cardId, 10);
            const idB = parseInt(b.querySelector('img').dataset.cardId, 10);
            return idA - idB;
        })
        .forEach(card => container.appendChild(card));
}

let sleeveA = [], sleeveReserve = [];
createActiveSleeveButton.addEventListener("click", () => {
    if (getCountCurrentSleeve() < ACTIVE_SLEEVE_COUNT) {
        showToast(`Add at least ${ACTIVE_SLEEVE_COUNT} cards to your sleeve first.`, "error");
        return;
    }
    activeSleeve.innerHTML = "";
    sleeveA = getRandomElementsFromArray(createSleeveArray(), ACTIVE_SLEEVE_COUNT);
    sleeveReserve = createSleeveArray();

    sleeveA.forEach((cardID, i) => {
        const card = getObjectById(cards, cardID);
        sleeveReserve.splice(sleeveReserve.indexOf(cardID), 1);
        const cardEl = createCardEl(card, (e) => {
            activateSleeveCard(e.target.parentElement, cardID);
        }, false, false, true);
        cardEl.classList.add("sleeve-enter");
        cardEl.style.animationDelay = (i * 55) + "ms";
        activeSleeve.append(cardEl);
    });
    sortActiveSleeve();
});

function activateSleeveCard(el, cardID) {
    playSound("activate");
    el.classList.remove("sleeve-enter");
    el.classList.add("sleeve-use");
    const idx = sleeveA.indexOf(cardID);
    if (idx !== -1) sleeveA.splice(idx, 1);
    setTimeout(() => {
        el.remove();
        if (sleeveReserve.length === 0) {
            showToast("Sleeve exhausted — no cards left in reserve.", "info");
            return;
        }
        let newCard = getRandomElementsFromArray(sleeveReserve, 1)[0];
        sleeveReserve.splice(sleeveReserve.indexOf(newCard), 1);
        const newCardEl = createCardEl(getObjectById(cards, newCard), (e) => {
            activateSleeveCard(e.target.parentElement, newCard);
        }, false, false, true);
        newCardEl.classList.add("sleeve-enter");
        activeSleeve.append(newCardEl);
    }, 400);
}

function createSleeveArray() {
    let arr = [];
    for (const c in sleeve) {
        for (var i = 0; i < sleeve[c]; i++) {
            arr.push(c);
        }
    }
    return arr;
}

function checkSleeveRestrictions(card) {
    if (getCountCurrentSleeve() + 1 > SLEEVE_LIMIT) {
        showToast(`Sleeve is full (${SLEEVE_LIMIT} cards max).`, "error");
        return false;
    }
    if (card.rarity !== "Common" && getRarityCountFromSleeve(card.rarity) + 1 > sleeveRarityRestrictions[card.rarity]) {
        showToast(`Max ${sleeveRarityRestrictions[card.rarity]} ${card.rarity} card${sleeveRarityRestrictions[card.rarity] !== 1 ? 's' : ''} per sleeve.`, "error");
        return false;
    }
    if ((card.rarity === "Mythic" || card.rarity === "Legendary") && sleeve[card.id]) {
        showToast("Only 1 copy of this card allowed in your sleeve.", "error");
        return false;
    }
    return true;
}

function getRarityCountFromSleeve(rarity) {
    let count = 0;
    for (const id in sleeve) {
        const card = getObjectById(cards, id);
        if (card && card.rarity === rarity) count += sleeve[id];
    }
    return count;
}

function getCountCurrentSleeve() {
    let count = 0;
    for (const c in sleeve) {
        count += sleeve[c];
    }
    return count;
}

function getRandomElementsFromArray(arr, count) {
    if (count > arr.length) {
        throw new Error("Count cannot be greater than array length");
    }

    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}