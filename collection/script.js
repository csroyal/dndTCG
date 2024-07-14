let cardData;
let addToCollection = document.getElementById("addToCollection");
let addToCollectionModalContainer = document.getElementById("addToCollectionModalContainer");
let saveToCollection = document.getElementById("saveToCollection");
let cardCollection = document.getElementById("cardCollection");
let noCards = document.getElementById("noCards");
let cardList = document.getElementById("cardList");

const rarityOrder = { 'R': 1, 'SR': 2, 'SSR': 3 };
const cardTypeOrder = { 'Monster': 1, 'Spell': 2, 'Reaction': 3, 'Utility': 4 };

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
        addToCollectionModalContainer.style.display = "none";
        console.log(addingToCollectionArr);
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
});

function cardNameToImageName(input) {
    let lowerCaseString = input.toLowerCase();
    let result = lowerCaseString
        .replace(/\s+/g, '-')
        .replace(/'/g, '')
        .replace(/\//g, '-');
    return result;
}

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

function sortByName(cards) {
    cards.sort((a, b) => a.name.localeCompare(b.name));
    return cards;
}

function sortByRarity(cards) {
    cards.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);
    return cards;
}

function sortByCardType(cards) {
    cards.sort((a, b) => cardTypeOrder[a.cardType] - cardTypeOrder[b.cardType]);
    return cards;
}

function masterSort(cards) {
    cards.sort((a, b) => {
        const cardTypeComparison = cardTypeOrder[a.cardType] - cardTypeOrder[b.cardType];
        if (cardTypeComparison !== 0) return cardTypeComparison;
      
        const rarityComparison = rarityOrder[a.rarity] - rarityOrder[b.rarity];
        if (rarityComparison !== 0) return rarityComparison;
      
        return a.name.localeCompare(b.name);
    });
    return cards;
}