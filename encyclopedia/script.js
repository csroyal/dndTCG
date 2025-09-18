fetch('../card-data.json')
    .then((response) => response.json())
    .then((json) => {
        cardData = json;
        console.log(cardData);
        
        cardData.forEach(card => {
            createCard(card);
            if (card.cardType !== "Utility") { preloadImage(`../assets/cards/${cardNameToImageName(card.name)}-back.png`) }
        });
    }
);

function createCard(card) {
    let newCard = document.createElement("div");
    
    newCard.classList.add("encyclopedia-card");
    newCard.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;

    newCard.addEventListener("click", openCardPopup.bind(this, card));

    document.getElementById("encyclopediaContainer").append(newCard);
}

document.getElementById("backToTop").addEventListener("click", backToTop);