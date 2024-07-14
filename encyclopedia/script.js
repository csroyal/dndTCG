let cardData;
let cardPopupModal = document.getElementById("cardPopupModal");
let cardPopupImage = document.getElementById("cardPopupImage");
let cardPopupDescription = document.getElementById("cardPopupDescription");

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

    newCard.addEventListener("click", () => {
        var drawSound = new Audio('../assets/draw.mp3');
        drawSound.volume = 0.75;
        drawSound.play();

        console.log("show", card);
        cardPopupModal.style.display = "flex";
        cardPopupImage.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
        cardPopupDescription.innerHTML = card.description;

        if (card.cardType !== "Utility") {
            let cardPopupImageFacingFront = true;
            cardPopupImage.onclick = () => {
                var flipSound = new Audio('../assets/flip.mp3');
                flipSound.volume = 0.55;
                flipSound.play();
                if (cardPopupImageFacingFront) {
                    cardPopupImage.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}-back.png)`;
                } else {
                    cardPopupImage.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
                }
                cardPopupImageFacingFront = !cardPopupImageFacingFront;
            };
        } else {
            cardPopupImage.onclick = () => {};
        }
    });

    document.getElementById("encyclopediaContainer").append(newCard);
}

function cardNameToImageName(input) {
    let lowerCaseString = input.toLowerCase();
    let result = lowerCaseString
        .replace(/\s+/g, '-')
        .replace(/'/g, '')
        .replace(/\//g, '-');
    return result;
}

cardPopupModal.addEventListener("click", (e) => {
    if (e.target.id === "cardPopupModal") {
        cardPopupModal.style.display = "none";
    }
});

function preloadImage(url) {
    const img = new Image();
    img.src = url;
}

document.getElementById("backToTop").addEventListener("click", backToTop);

function backToTop() {
    // Smooth scroll to the top of the document
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}