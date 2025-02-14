let deckSelectModalContainer = document.getElementById("deckSelectModalContainer");
let deckSelect = document.getElementById("deckSelect");
let deckSelectConfirmBtn = document.getElementById("deckSelectConfirmBtn");
let goToDeckBuilderBtn = document.getElementById("goToDeckBuilderBtn");

let user_decks = JSON.parse(localStorage.getItem("DNDTCG_USER_DECKS"));
let currentDeck;

if (user_decks) {
    user_decks.forEach(deck => {
        addDeckToDeckSelect(deck);
    });
} else {
    deckSelect.innerHTML = "You do not have any valid decks. Please construct one using the Deck Builder.";
    deckSelectConfirmBtn.style.display = "none";
    goToDeckBuilderBtn.style.display = "flex";
}

function addDeckToDeckSelect(deck) {
    console.log(deck);
    let deckDiv = document.createElement("div");
    deckDiv.classList.add("user-deck");
    deckDiv.innerHTML = deck.name;
    deckDiv.addEventListener("click", (e) => {
        if (e.target.classList.contains("user-deck")) {
            console.log("open deck", deck.name);
            if (document.querySelector(".selected") && !e.target.classList.contains("selected")) {
                document.querySelector(".selected").classList.toggle("selected");
            }
            e.target.classList.toggle("selected");
        }
    });
    deckSelect.append(deckDiv);
}

deckSelectConfirmBtn.addEventListener("click", () => {
    if (document.querySelector(".selected")) {
        console.log("a deck is selected:", document.querySelector(".selected").innerHTML);
        for (d in user_decks) {
            if (user_decks[d].name === document.querySelector(".selected").innerHTML) {
                currentDeck = user_decks[d].deckList;
                break;
            }
        }
        deckSelectModalContainer.style.display = "none";
    }
});