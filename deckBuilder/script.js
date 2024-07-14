let cardData;
let createNewDeck = document.getElementById("createNewDeck");
let userDeckList = document.getElementById("userDeckList");

fetch('../card-data.json')
    .then((response) => response.json())
    .then((json) => {
        cardData = json;
        console.log(cardData);

        cardData.forEach(card => {
        });
    }
);

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