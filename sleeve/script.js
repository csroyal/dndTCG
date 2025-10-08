let cardCollection = document.getElementById("cardCollection");
let sleeve = document.getElementById("sleeve");
let addCardToSleeveBtn = document.getElementById("addCardToSleeveBtn");
let removeCardFromSleeveBtn = document.getElementById("removeCardFromSleeveBtn");

let user_collection = JSON.parse(localStorage.getItem("DNDTCG_USER_COLLECTION"));
let user_sleeve = JSON.parse(localStorage.getItem("DNDTCG_USER_SLEEVE"));

let currentCard = null;

console.log(user_collection);
console.log(user_sleeve);

if (!user_collection) {
    noCards.style.display = "flex";
    user_collection = [];
} else {
    user_collection = masterSort(user_collection);
    user_collection.forEach(card => {
        addToCardCollection(card);
    });
}

if (!user_sleeve) {
    user_sleeve = [];
} else {
    user_sleeve = masterSort(user_sleeve);
    user_sleeve.forEach(card => {
        addToSleeve(card);
    });
}

function addToCardCollection(card) {
    let newCardDiv = document.createElement("div");
    newCardDiv.classList.add("card-collection-card");
    newCardDiv.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    newCardDiv.addEventListener("contextmenu", (e) => {
        currentCard = card;
        addCardToSleeveBtn.click();
    }); 
    newCardDiv.addEventListener("click", () => {
        addCardToSleeveBtn.style.display = "flex";
        removeCardFromSleeveBtn.style.display = "none";
        openCardPopup(card);
        currentCard = card;
    });

    cardCollection.append(newCardDiv);
}

function addToSleeve(card) {
    let newCardDiv = document.createElement("div");
    newCardDiv.classList.add("sleeve-card");
    newCardDiv.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    newCardDiv.addEventListener("click", () => {
        addCardToSleeveBtn.style.display = "none";
        removeCardFromSleeveBtn.style.display = "flex";
        openCardPopup(card);
        currentCard = card;
    });
    newCardDiv.addEventListener("contextmenu", (e) => {
        if (newCardDiv.classList.contains("activated")) {
            alert("This card has already been activated.");
            return;
        }
        activateCard(card);
    });

    sleeve.append(newCardDiv);
}

function removeFromSleeve(card) {
    let sleeveCards = document.querySelectorAll(".sleeve-card");
    sleeveCards.forEach(cardDiv => {
        let bgImage = cardDiv.style.backgroundImage;
        if (bgImage.includes(cardNameToImageName(card.name))) {
            cardDiv.remove();
        }
    });
}

function activateCard(card) {
    let sleeveCards = document.querySelectorAll(".sleeve-card");
    sleeveCards.forEach(cardDiv => {
        let bgImage = cardDiv.style.backgroundImage;
        if (bgImage.includes(cardNameToImageName(card.name))) {
            cardDiv.classList.add("activated");
        }
    });
}

addCardToSleeveBtn.addEventListener("click", () => {
    if (currentCard) {
        // Only add if not already in sleeve and sleeve has less than 6 cards
        let alreadyInSleeve = user_sleeve.some(card => card.name === currentCard.name);
        if (alreadyInSleeve) {
            alert("This card is already in your sleeve.");
            closeCardPopup();
            return;
        }

        if (user_sleeve.length >= 6) {
            alert("You are only allowed up to 6 cards in a sleeve.");
            closeCardPopup();
            return;
        }

        user_sleeve.push(currentCard);
        addToSleeve(currentCard);
        localStorage.setItem("DNDTCG_USER_SLEEVE", JSON.stringify(user_sleeve));
        closeCardPopup();
    }
});

removeCardFromSleeveBtn.addEventListener("click", () => {
    if (currentCard) {
        let index = user_sleeve.findIndex(card => card.name === currentCard.name);
        if (index !== -1) {
            user_sleeve.splice(index, 1);
            localStorage.setItem("DNDTCG_USER_SLEEVE", JSON.stringify(user_sleeve));
            removeFromSleeve(currentCard);
            closeCardPopup();
        }
    }
});