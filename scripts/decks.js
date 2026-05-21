let decksContainer = document.getElementById("decksContainer");
let deckBuilderContainer = document.getElementById("deckBuilderContainer");
let deckBuilderNameEntry = document.getElementById("deckBuilderNameEntry");
let deckBuilderSaveButton = document.getElementById("deckBuilderSaveButton");
let deckBuilderDeleteButton = document.getElementById("deckBuilderDeleteButton");
let deckBuilderCount = document.getElementById("deckBuilderCount");
let deckBuilderDeckList = document.getElementById("deckBuilderDeckList");
let deckBuilderBinder = document.getElementById("deckBuilderBinder");
let deckBuilderBinderList = document.getElementById("deckBuilderBinderList");
let deckBuilderBinderSearch = document.getElementById("deckBuilderBinderSearch");
let deckBuilderBinderFilter = document.getElementById("deckBuilderBinderFilter");

let activeDeck;
const DECK_LIMIT = 30;
let deckRarityRestrictions = { "Rare": 15, "Legendary": 5, "Mythic": 2 };

function buildDecks() {
    decksContainer.innerHTML = '';
    document.querySelector("#decksSection p").style.display = "none";
    
    let addNewDeckButton = document.createElement("div");
    addNewDeckButton.innerHTML = `<i class="bi bi-plus-square"></i> Create New Deck`;
    addNewDeckButton.classList.add("add-new-deck");
    addNewDeckButton.onclick = () => {
        activeDeck = {
            "id": generateUID(),
            "name": "New Deck " + (Number(decks.length) + 1),
            "deckList": {}
        }

        loadDeck(activeDeck);

        decks.push(activeDeck);
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({
            decks: decks
        });
    };

    decksContainer.append(addNewDeckButton);

    decks.forEach(deck => {
        let deckPreview = document.createElement("div");
        deckPreview.innerHTML = deck.name;

        deckPreview.onclick = () => {
            activeDeck = deck;
            loadDeck(deck);
            sortDeckBuilderBinder(); 
        };

        decksContainer.append(deckPreview);
    });
}

function loadDeck(deck) {
    console.log(deck);
    decksContainer.style.display = "none";
    deckBuilderContainer.style.display = "flex";
    deckBuilderNameEntry.value = deck.name;
    deckBuilderDeckList.innerHTML = "";
    deckBuilderBinderList.innerHTML = "";

    for (c in deck.deckList) {
        for (let i = 0; i < deck.deckList[c]; i++) {
            deckBuilderDeckList.append(createCardEl(getObjectById(cards, c), (e) => {
                removeCardFromDeckList(e.target);
            }, false));
        }
    }
    sortDeckBuilderDeckList();

    for (b in binder) {
        // console.log(b, binder[b]); 
        if (getObjectById(cards, b).class === "Sleeve") continue;
        let cardEl = createCardEl(getObjectById(cards, b), (e) => {
            let cardID = e.target.dataset.cardId;
            if (!checkDeckRestrictions(getObjectById(cards, cardID))) { return; }
            console.log(e.target.dataset.cardId);
            if (e.target.classList.contains("owned")) {
                if (activeDeck.deckList[cardID]) {
                    activeDeck.deckList[`${cardID}`] = activeDeck.deckList[`${cardID}`] + 1;
                } else {
                    activeDeck.deckList[`${cardID}`] = 1;
                }
                let badge = e.target.previousElementSibling
                badge.innerHTML = Number(badge.innerHTML) - 1;
                if (badge.innerHTML == 0) {
                    e.target.classList.remove("owned");
                }
                addToDeckList(cardID);
                sortDeckBuilderDeckList();
            } else {
                alert("No more copies of this card in your binder.");
            }
        });
        if (deck.deckList[b]) {
            cardEl.querySelector(".badge").innerHTML = Number(cardEl.querySelector(".badge").innerHTML) - deck.deckList[b];
            if (cardEl.querySelector(".badge").innerHTML == 0) {
                cardEl.querySelector(".card").classList.remove("owned");
            }
        }
        deckBuilderBinderList.append(cardEl);
    }
    
    deckBuilderCount.innerHTML = deckBuilderDeckList.childElementCount;
}

function addToDeckList(cardID) {
    console.log(cardID);
    deckBuilderDeckList.append(createCardEl(getObjectById(cards, cardID), (e) => {
        removeCardFromDeckList(e.target);
    }, false));
    deckBuilderCount.innerHTML = deckBuilderDeckList.childElementCount;
}

function removeCardFromDeckList(el) {
    let binderCard = deckBuilderBinderList.querySelector(`.card-wrapper:has(img[data-card-id="${el.dataset.cardId}"])`);
    console.log(binderCard);
    binderCard.querySelector(".badge").innerHTML = Number(binderCard.querySelector(".badge").innerHTML) + 1;
    binderCard.querySelector(".card").classList.add("owned");

    activeDeck.deckList[el.dataset.cardId] = activeDeck.deckList[el.dataset.cardId] - 1;
    if (activeDeck.deckList[el.dataset.cardId] === 0) delete activeDeck.deckList[el.dataset.cardId];

    el.parentElement.remove();

    deckBuilderCount.innerHTML = deckBuilderDeckList.childElementCount;
}

function sortDeckBuilderBinder() {
    const container = document.querySelector("#deckBuilderBinderList");

    const cards = Array.from(container.querySelectorAll('.card-wrapper'));

    cards
        .sort((a, b) => {
            const idA = parseInt(a.querySelector('img').dataset.cardId, 10);
            const idB = parseInt(b.querySelector('img').dataset.cardId, 10);
            return idA - idB;
        })
        .forEach(card => container.appendChild(card));
}

function sortDeckBuilderDeckList() {
    const container = document.querySelector("#deckBuilderDeckList");

    const cards = Array.from(container.querySelectorAll('.card-wrapper'));

    cards
        .sort((a, b) => {
            const idA = parseInt(a.querySelector('img').dataset.cardId, 10);
            const idB = parseInt(b.querySelector('img').dataset.cardId, 10);
            return idA - idB;
        })
        .forEach(card => container.appendChild(card));
}

function checkDeckRestrictions(card) {
    if (getCountActiveDeck() + 1 > DECK_LIMIT) {
        alert(`Can not have more than ${DECK_LIMIT} cards in a deck.`);
        return false;
    }
    if (card.rarity !== "Common" && getRarityCountFromDeckList(card.rarity) + 1 > deckRarityRestrictions[card.rarity]) {
        alert(`Can not have more than ${deckRarityRestrictions[card.rarity]} ${card.rarity} cards in your deck.`)
        return false;
    }
    if ((card.rarity === "Mythic" || card.rarity === "Legendary") && activeDeck.deckList[card.id]) {
        alert("Can only have 1 copy of this card in your deck.");
        return false;
    }
    return true;
}

function getRarityCountFromDeckList(rarity) {
    let count = 0;
    for (c in activeDeck.deckList) {
        let card = getObjectById(cards, c);
        if (card.rarity === rarity) count += activeDeck.deckList[c];
    }
    return count;
}

deckBuilderNameEntry.addEventListener("input", () => {
    activeDeck.name = deckBuilderNameEntry.value;
});

deckBuilderBackButton.addEventListener("click", () => {
    buildDecks();

    decksContainer.style.display = "flex";
    deckBuilderContainer.style.display = "none";
});

deckBuilderSaveButton.addEventListener("click", () => {
    for (d in decks) {
        if (decks[d].id === activeDeck.id) decks[d] = activeDeck;
        break;
    }
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({
        decks: decks
    });
});

deckBuilderDeleteButton.addEventListener("click", () => {
    if (confirm(`Delete ${activeDeck.name}?`)) {
        for (d in decks) {
            if (decks[d].id === activeDeck.id) {
                decks.splice(d, 1);
                break;
            } 
        }
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({
            decks: decks
        });

        buildDecks();

        decksContainer.style.display = "flex";
        deckBuilderContainer.style.display = "none";
    }
});

deckBuilderBinderSearch.addEventListener("input", () => {
    let searchInput = deckBuilderBinderSearch.value.toLowerCase();
    let cardEls = document.querySelectorAll("#deckBuilderBinderList .card");
    cardEls.forEach(card => {
        if (card.dataset.name.includes(searchInput) || !searchInput) {
            card.parentElement.style.display = "block";
        } else {
            card.parentElement.style.display = "none";
        }
    });
});

deckBuilderBinderFilter.addEventListener("change", () => {
    let filter = deckBuilderBinderFilter.value;
    let cardEls = document.querySelectorAll("#deckBuilderBinderList .card");
    cardEls.forEach(card => {
        if (card.dataset.cardClass === filter || !filter) {
            card.parentElement.style.display = "block";
        } else {
            card.parentElement.style.display = "none";
        }
    });
});

function getCountActiveDeck() {
    let count = 0;
    for (c in activeDeck.deckList) {
        count += activeDeck.deckList[c];
    }
    return count;
}

function deleteAllDecks() {
    decks = [];
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({
        decks: decks
    });
}