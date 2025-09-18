let addToCollection = document.getElementById("addToCollection");
let addToCollectionModalContainer = document.getElementById("addToCollectionModalContainer");
let addAllToCollection = document.getElementById("addAllToCollection");
let saveToCollection = document.getElementById("saveToCollection");
let cardCollection = document.getElementById("cardCollection");
let noCards = document.getElementById("noCards");
let cardList = document.getElementById("cardList");
let removeFromCollectionBtn = document.getElementById("removeFromCollection");

fetch('../card-data.json')
    .then((response) => response.json())
    .then((json) => {
        cardData = json;
        console.log(cardData);

        cardData.forEach(card => {
            let alreadyInCollection = false;
            for (c in user_collection) {
                if (user_collection[c].name === card.name) {
                    alreadyInCollection = true;
                }
            }
            if (!alreadyInCollection) addToCardList(card);
        });
    }
);

let user_collection = JSON.parse(localStorage.getItem("DNDTCG_USER_COLLECTION"));

console.log(user_collection);

if (!user_collection) {
    noCards.style.display = "flex";
    user_collection = [];
} else {
    user_collection = masterSort(user_collection);
    user_collection.forEach(card => {
        addToCardCollection(card);
    });
    cardCollection.style.display = "flex";
}

addToCollection.addEventListener("click", () => {
    addToCollectionModalContainer.style.display = "flex";
})

function addToCardCollection(card) {
    let newCardDiv = document.createElement("div");
    newCardDiv.classList.add("card-collection-card");
    newCardDiv.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    newCardDiv.addEventListener("click", () => {
        openCardPopup(card);
        currentCard = card;
    });

    cardCollection.append(newCardDiv);
}

let addingToCollectionArr = [];
function addToCardList(card) {
    let cardListCard = document.createElement("div");
    cardListCard.classList.add("card-list-card");
    cardListCard.id = "cardListCard" + cardNameToImageName(card.name);
    cardListCard.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    cardListCard.addEventListener("click", () => {
        if (cardOverlay.style.display === "flex") {
            cardOverlay.style.display = "none";
            addingToCollectionArr.splice(addingToCollectionArr.indexOf(card), 1);
        } else {
            cardOverlay.style.display = "flex";
            addingToCollectionArr.push(card)
        }
    });

    let cardOverlay = document.createElement("div");
    cardOverlay.classList.add("card-list-card-overlay");
    cardOverlay.innerHTML = "<i class='bi bi-check-circle-fill'></i>"
    cardListCard.append(cardOverlay);

    cardList.append(cardListCard);
}

saveToCollection.addEventListener("click", () => {
    if (!addingToCollectionArr.length) {
        alert("No cards selected.");
        return;
    }
    if (confirm("Add selected cards to collection?")) {
        saveAndDisplayCollection();
    }
});

addAllToCollection.addEventListener("click", () => {
    if (confirm("Add all cards to collection?")) {
        cardData.forEach(card => {
            if (!user_collection.some(c => c.name === card.name)) {
                user_collection.push(card);
            }
        });
        saveAndDisplayCollection();
    }
});

addToCollectionModalContainer.addEventListener("click", (e) => {
    if (e.target.id === "addToCollectionModalContainer") {
        addToCollectionModalContainer.style.display = "none";
    }
});

document.getElementById("clearCollection").addEventListener("click", () => {
    if (!user_collection || !user_collection.length) {
        alert("There is nothing in your collection to clear.");
        return;
    }
    if (confirm("Are you sure you want to clear your collection? This cannot be undone.")) {
        while (cardCollection.firstChild) {
            cardCollection.removeChild(cardCollection.firstChild);
        }
        while (cardList.firstChild) {
            cardList.removeChild(cardList.firstChild);
        }
        cardData.forEach(card => {
            addToCardList(card);
        });
        localStorage.clear();
        
        cardCollection.style.display = "none";
        noCards.style.display = "flex";
        user_collection = [];
    }
});

function saveAndDisplayCollection() {
    addToCollectionModalContainer.style.display = "none";
    for (c in addingToCollectionArr) {
        user_collection.push(addingToCollectionArr[c]);
        document.getElementById("cardListCard" + cardNameToImageName(addingToCollectionArr[c].name)).remove();
    }
    user_collection = masterSort(user_collection);
    while (cardCollection.firstChild) {
        cardCollection.removeChild(cardCollection.firstChild);
    }
    user_collection.forEach(card => {
        addToCardCollection(card);
    });
    localStorage.setItem("DNDTCG_USER_COLLECTION", JSON.stringify(user_collection));

    cardCollection.style.display = "flex";
    noCards.style.display = "none";
    addingToCollectionArr = [];
}

function removeFromCollection(card) {
    user_collection = user_collection.filter(obj => obj !== card);
    saveAndDisplayCollection();
    closeCardPopup();
}

let currentCard = null;

removeFromCollectionBtn.addEventListener("click", () => {
    if (cardPopupModal.style.display === "flex") {
        if (confirm("Are you sure you want to remove this card from your collection?")) {
            removeFromCollection(currentCard);
        }
    }
});

document.getElementById("backToTop").addEventListener("click", backToTop);