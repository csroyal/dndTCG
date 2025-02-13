let startContainer = document.getElementById("startContainer");
let createNewDeck = document.getElementById("createNewDeck");
let userDeckList = document.getElementById("userDeckList");
let deckEditor = document.getElementById("deckEditor");
let deckEditorName = document.getElementById("deckEditorName");
let backToDeckList = document.getElementById("backToDeckList");
let currentDeckListing = document.getElementById("currentDeckListing");
let cardCollection = document.getElementById("cardCollection");
let noCards = document.getElementById("noCards");
let currentDeckCount = document.getElementById("currentDeckCount");
let saveDeck = document.getElementById("saveDeck");

let user_collection = JSON.parse(localStorage.getItem("DNDTCG_USER_COLLECTION"));
let user_decks = JSON.parse(localStorage.getItem("DNDTCG_USER_DECKS"));
let currentDeck;

if (user_decks) {
    user_decks.forEach(deck => {
        addDeckToDecklist(deck);
    });
} else {
    user_decks = [];
}

createNewDeck.addEventListener("click", () => {
    let deckName = prompt("Enter a name for your new deck:");
    if (!deckName) {
        alert("Please enter a name when creating a new deck.");
        return;
    }
    for (d in user_decks) {
        if (deckName === user_decks[d].name) {
            alert("A deck with that name already exists.");
            return;
        }
    }
    let deckObj = {
        "name": deckName,
        "deckList": []
    }
    user_decks.push(deckObj);
    localStorage.setItem("DNDTCG_USER_DECKS", JSON.stringify(user_decks));

    addDeckToDecklist(deckObj);
});

function addDeckToDecklist(deck) {
    let deckDiv = document.createElement("div");
    deckDiv.classList.add("user-deck");
    deckDiv.innerHTML = deck.name;
    deckDiv.addEventListener("click", (e) => {
        if (e.target.classList.contains("user-deck")) {
            console.log("open deck", deck.name);
            startContainer.style.display = "none";
            deckEditor.style.display = "flex";
            deckEditorName.innerHTML = deck.name;
            currentDeck = deck;

            if (!user_collection) {
                noCards.style.display = "flex";
            } else {
                noCards.style.display = "none";
                user_collection = masterSort(user_collection);
                user_collection.forEach(card => {
                    addToCardCollection(card);
                });
                displayDecklist();
            }
        }
    });

    let delBtn = document.createElement("div");
    delBtn.classList.add("deck-del-btn");
    delBtn.innerHTML = "<i class='bi bi-trash'></i>";

    delBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete this deck? This cannot be undone.")) {
            for (d in user_decks) {
                if (user_decks[d].name === deck.name) {
                    user_decks.splice(d, 1);
                    localStorage.setItem("DNDTCG_USER_DECKS", JSON.stringify(user_decks));

                    deckDiv.remove();
                    break;
                }
            }
        }
    });

    deckDiv.append(delBtn);

    userDeckList.append(deckDiv);
}

backToDeckList.addEventListener("click", () => {
    startContainer.style.display = "flex";
    deckEditor.style.display = "none";
});

function addToCardCollection(card) {
    let newCardDiv = document.createElement("div");
    newCardDiv.classList.add("card-collection-card");
    newCardDiv.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    newCardDiv.addEventListener("click", () => {
        if (currentDeck.deckList.length >= 30) {
            alert("You are only allowed up to 30 cards in a deck.");
            return;
        }

        let currentCount = 0;
        for (c in currentDeck.deckList) {
            if (currentDeck.deckList[c].name === card.name) {
                currentCount++;
            }
        }

        if (card.rarity === "R" && currentCount === 3) {
            alert("You are only allowed 3 copies of an R rarity card in a deck.");
            return;
        }
        else if (card.rarity === "SR" && currentCount === 2) {
            alert("You are only allowed 2 copies of an SR rarity card in a deck.");
            return;
        }
        else if (card.rarity === "SSR" && currentCount === 1) {
            alert("You are only allowed 1 copy of an SSR rarity card in a deck.");
            return;
        }

        currentDeck.deckList.push(card);
        displayDecklist();
    });

    cardCollection.append(newCardDiv);
}

function addCardToDecklist(card) {
    // console.log(card);
    let newCardDiv = document.createElement("div");
    newCardDiv.classList.add("card-decklist-card");
    newCardDiv.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    newCardDiv.addEventListener("click", () => {
        // console.log(card);
        for (c in currentDeck.deckList) {
            if (currentDeck.deckList[c].name === card.name) {
                currentDeck.deckList.splice(c, 1);
                break;
            }
        }
        displayDecklist();
    });

    currentDeckListing.append(newCardDiv);
}

function displayDecklist() {
    while (currentDeckListing.firstChild) {
        currentDeckListing.removeChild(currentDeckListing.firstChild);
    }
    currentDeck.deckList = masterSort(currentDeck.deckList);
    for (c in currentDeck.deckList) {
        addCardToDecklist(currentDeck.deckList[c]);
    }
    currentDeckCount.innerHTML = currentDeck.deckList.length;
}

saveDeck.addEventListener("click", () => {
    for (d in user_decks) {
        if (user_decks[d].name === currentDeck.name) {
            user_decks[d] = currentDeck;
            break;
        }
    }
    localStorage.setItem("DNDTCG_USER_DECKS", JSON.stringify(user_decks));
    alert("Deck saved.");
});