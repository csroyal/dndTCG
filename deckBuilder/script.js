let startContainer = document.getElementById("startContainer");
let createNewDeck = document.getElementById("createNewDeck");
let userDeckList = document.getElementById("userDeckList");
let deckEditor = document.getElementById("deckEditor");
let deckEditorName = document.getElementById("deckEditorName");
let backToDeckList = document.getElementById("backToDeckList");
let currentDeckListing = document.getElementById("currentDeckListing");
let cardCollection = document.getElementById("cardCollection");

let user_collection = JSON.parse(localStorage.getItem("DNDTCG_USER_COLLECTION"));
let user_decks = JSON.parse(localStorage.getItem("DNDTCG_USER_DECKS"));

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

            if (!user_collection) {
                // noCards.style.display = "flex";
            } else {
                user_collection = masterSort(user_collection);
                user_collection.forEach(card => {
                    addToCardCollection(card);
                });
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

    cardCollection.append(newCardDiv);
}