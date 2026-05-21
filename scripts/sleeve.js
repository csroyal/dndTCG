let currentSleeve = document.getElementById("currentSleeve");
let activeSleeve = document.getElementById("activeSleeve");
let sleeveCountSpan = document.querySelector("#sleeveCount span");
let createActiveSleeveButton = document.getElementById("createActiveSleeveButton");

const SLEEVE_LIMIT = 12;
const ACTIVE_SLEEVE_COUNT = 6;
let sleeveRarityRestrictions = { "Legendary": 1, "Mythic": 1 };

function buildSleeve() {
    for (c in binder) {
        if (c === "undefined") continue;
        let card = getObjectById(cards, c);
        if (card && card.class && card.class !== "Sleeve") continue;
        currentSleeve.append(createCardEl(card, (e) => {
            if (!checkSleeveRestrictions(card)) return;
            let sleeveOverlay = e.target.parentElement.querySelector(".sleeve-overlay");
            let span = sleeveOverlay.querySelector("span");
            if (Number(span.innerHTML) >= binder[c]) {
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
        }, true, true));
    }
    sortCurrentSleeve();

    let sleeveCount = 0;
    for (c in sleeve) {
        let cardWrapper = document.querySelector(`#currentSleeve .card-wrapper:has(img[data-card-id="${c}"])`);
        cardWrapper.querySelector(".sleeve-overlay span").innerHTML = sleeve[c];
        cardWrapper.querySelector(".sleeve-overlay").style.display = "flex";

        sleeveCount += sleeve[c];
    }

    sleeveCountSpan.innerHTML = sleeveCount;
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
    activeSleeve.innerHTML = "";
    sleeveA = getRandomElementsFromArray(createSleeveArray(), ACTIVE_SLEEVE_COUNT);
    sleeveReserve = createSleeveArray();

    for (c in sleeveA) {
        let card = getObjectById(cards, sleeveA[c]);
        sleeveReserve.splice(sleeveReserve.indexOf(sleeveA[c]), 1);
        activeSleeve.append(createCardEl(card, (e) => {
            activateSleeveCard(e.target.parentElement, c);
        }, false));
        sortActiveSleeve();
    }
    console.log(sleeveA, sleeveReserve);
});

function activateSleeveCard(el, sleeveIndex) {
    playSound("activate");
    el.classList.add("puff-out-center");
    sleeveA.splice(sleeveIndex, 1);
    setTimeout(() => {
        el.remove();
        if (sleeveReserve.length === 0) return;
        let newCard = getRandomElementsFromArray(sleeveReserve, 1)[0];
        sleeveReserve.splice(sleeveReserve.indexOf(newCard), 1);
        activeSleeve.append(createCardEl(getObjectById(cards, newCard), (e) => {
            activateSleeveCard(e.target.parentElement, sleeveA.indexOf(newCard));
        }, false));
    }, 1500);
}

function createSleeveArray() {
    let arr = [];
    for (c in sleeve) {
        for (var i = 0; i < sleeve[c]; i++) {
            arr.push(c);
        }
    }
    return arr;
}

function checkSleeveRestrictions(card) {
    if (getCountCurrentSleeve() + 1 > SLEEVE_LIMIT) {
        alert(`Can not have more than ${SLEEVE_LIMIT} cards in your sleeve.`);
        return false;
    }
    if (card.rarity !== "Common" && getRarityCountFromSleeve(card.rarity) + 1 > sleeveRarityRestrictions[card.rarity]) {
        alert(`Can not have more than ${sleeveRarityRestrictions[card.rarity]} ${card.rarity} cards in your sleeve.`)
        return false;
    }
    if ((card.rarity === "Mythic" || card.rarity === "Legendary") && sleeve[card.id]) {
        alert("Can only have 1 copy of this card in your sleeve.");
        return false;
    }
    return true;
}

function getRarityCountFromSleeve(rarity) {
    let count = 0;
    for (c in sleeve) {
        let card = getObjectById(cards, c);
        if (card.rarity === rarity) count += sleeve[c];
    }
    return count;
}

function getCountCurrentSleeve() {
    let count = 0;
    for (c in sleeve) {
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