let cards;
let packs;
let binder = {};
let decks = [];
let sleeve = {};

fetch("./data/cards.json")
    .then(res => res.json())
    .then(data => {
        cards = data;
        fetch("./data/packs.json")
            .then(res => res.json())
            .then(data2 => {
                packs = data2;
                buildBinder(data, data2);
            });
    });


let menuButtons = document.querySelectorAll("#menu .menu-button");
let cardViewModalContainer = document.getElementById("cardViewModalContainer");
let cardViewImg = cardViewModalContainer.querySelector("img");

if (localStorage.getItem("DND_TCG_LATEST_SECTION")) {
    document.querySelector("#sectionsContainer .section.active").classList.remove("active");
    document.querySelector(`#sectionsContainer #${localStorage.getItem("DND_TCG_LATEST_SECTION")}`).classList.add("active");
}

menuButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelector("#sectionsContainer .section.active").classList.remove("active");
        document.querySelector(`#sectionsContainer #${btn.dataset.section}`).classList.add("active");
        localStorage.setItem("DND_TCG_LATEST_SECTION", btn.dataset.section);
    });
});

function loadProfile(profileName) {
    currentProfile = profileName;
    localStorage.setItem("DND_TCG_LATEST_PROFILE", profileName);

    document.querySelector("#profileInfo p span").innerHTML = profileName;
    document.querySelector("#profileInfo").style.display = "flex";
    document.querySelector("#profileLogin").style.display = "none";
    db.collection("profiles").doc(toKebabCase(profileName)).get().then((doc) => {
        if (doc.data().profilePictureURL) {
            document.querySelector("#profileIcon i").style.display = "none";
            document.querySelector("#profilePictureImage").src = doc.data().profilePictureURL;
            document.querySelector("#profilePictureImage").style.display = "block";
        }
        if (doc.data().binder) {
            binder = doc.data().binder;
            buildBinder(cards, packs);
        }
        if (doc.data().decks) {
            decks = doc.data().decks;
        }
        if (doc.data().sleeve) {
            sleeve = doc.data().sleeve;
        }
        buildPacks();
        buildDecks();
        buildSleeve();
        buildDeckSelect();
    }).catch((error) => {
        console.error("Error getting document:", error);
    });
}

function createProfile(profileName) {
    db.collection("profiles").doc(toKebabCase(profileName)).set({
        name: profileName
    }).then(() => {
        console.log("New profile created:", profileName);
    })
    .catch((error) => {
        console.error("Error writing document: ", error);
    });
}

function unloadProfile() {
    document.querySelector("#profileInfo").style.display = "none";
    document.querySelector("#profileLogin").style.display = "flex";
    document.querySelector("#profileIcon i").style.display = "block";
    document.querySelector("#profilePictureImage").style.display = "none";
    binder = {};
    buildBinder(cards, packs);
    decksContainer.innerHTML = '';
    decksContainer.querySelector("p").style.display = "none";
}

function createCardEl(card, func, includeBadge = true, sleeveCount = false) {
    let cardWrapper = document.createElement("div");
    cardWrapper.classList.add("card-wrapper");

    let cardEl = document.createElement("img");
    cardEl.src = "./assets/card-art/" + card.id + ".jpg";
    cardEl.classList.add("card");
    cardEl.setAttribute("draggable", false);
    cardEl.setAttribute("data-card-id", card.id);
    cardEl.setAttribute("data-name", card.name.toLowerCase());
    cardEl.setAttribute("data-card-class", card.class);
    cardEl.setAttribute("data-rarity", card.rarity);

    let ownershipBadge = document.createElement("div");
    ownershipBadge.classList.add("badge");
    ownershipBadge.innerHTML = "0";

    if (includeBadge) {
        if (binder && binder[card.id] && binder[card.id] >= 1) {
            cardEl.classList.add("owned");
            ownershipBadge.innerHTML = binder[card.id];
        }
        cardWrapper.append(ownershipBadge);
    } else {
        cardEl.classList.add("owned");
    }

    if (sleeveCount) {
        let sleeveOverlay = document.createElement("div");
        sleeveOverlay.classList.add("sleeve-overlay");
        sleeveOverlay.innerHTML = `
            <div>
                <span>0</span> / ${binder[card.id]}
            </div>
            <div class='plus-minus-button'>
                <div>-</div>
                <div>+</div>
            </div>
        `;

        sleeveOverlay.querySelector(".plus-minus-button div:nth-child(1)").addEventListener("click", () => {
            let span = sleeveOverlay.querySelector("span");
            span.innerHTML = Number(span.innerHTML) - 1;
            sleeveCountSpan.innerHTML = Number(sleeveCountSpan.innerHTML) - 1;

            if (sleeve[card.id]) sleeve[card.id] = sleeve[card.id] - 1;
            if (sleeve[card.id] === 0) delete sleeve[card.id];
            db.collection("profiles").doc(toKebabCase(currentProfile)).update({
                sleeve: sleeve
            });

            if (Number(span.innerHTML) === 0) {
                sleeveOverlay.style.display = "none";
            }
        });

        sleeveOverlay.querySelector(".plus-minus-button div:nth-child(2)").addEventListener("click", () => {
            if (!checkSleeveRestrictions(card)) return;
            let span = sleeveOverlay.querySelector("span");
            if (Number(span.innerHTML) >= binder[card.id]) {
                alert("You don't have any more copies of this card.");
                return;
            }
            if (Number(sleeveCountSpan.innerHTML) >= SLEEVE_LIMIT) {
                alert("You can only have up to 12 cards in your current sleeve.");
                return;
            }
            span.innerHTML = Number(span.innerHTML) + 1;
            sleeveCountSpan.innerHTML = Number(sleeveCountSpan.innerHTML) + 1;

            if (sleeve[card.id]) sleeve[card.id] = sleeve[card.id] + 1;
            else sleeve[card.id] = 1;
            db.collection("profiles").doc(toKebabCase(currentProfile)).update({
                sleeve: sleeve
            });

            sleeveOverlay.style.display = "flex";
        });


        cardWrapper.append(sleeveOverlay);
    }

    cardEl.addEventListener("click", func);

    cardEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openInCardViewModal(card.id);
    });

    cardWrapper.append(cardEl);

    return cardWrapper;
}

function openInCardViewModal(cardID) {
    playSound("draw");
    cardViewImg.src = "./assets/card-art/" + cardID + ".jpg";
    cardViewImg.setAttribute("data-card-id", cardID);
    cardViewImg.setAttribute("data-rarity", getObjectById(cards, cardID).rarity);
    if (binder && binder[cardID] && binder[cardID] >= 1) {
        cardViewImg.classList.add("owned");
    } 
    else cardViewImg.classList.remove("owned");

    cardViewModalContainer.classList.add("active");
}

cardViewModalContainer.addEventListener("click", (e) => {
    if (e.target.id !== "cardViewModalContainer") return;
    if ((cardViewModalContainer).classList.contains("active")) {
        cardViewModalContainer.classList.remove("active");
        cardViewImg.classList.remove("back");
    }
});

cardViewImg.addEventListener("click", () => {
    let card = getObjectById(cards, cardViewImg.dataset.cardId);
    if (card.class !== "Utility") {
        playSound("flip");
        if (cardViewImg.classList.contains("back")) {
            cardViewImg.src = "./assets/card-art/" + card.id + ".jpg";
        } else {
            cardViewImg.src = "./assets/card-art/" + card.id + "-back.jpg";
        }
        cardViewImg.classList.toggle("back");
    }
});

function playSound(soundName) {
    var sound = new Audio(`./assets/sounds/${soundName}.mp3`);
    sound.volume = 0.75;
    sound.play();
}

function getObjectById(arr, id) {
    return arr.find(obj => obj.id === id);
}

function toKebabCase(str) {
    return str
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-");
}

function generateUID() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function isNumeric(str) {
  if (typeof str != "string") return false
  return !isNaN(str) &&
         !isNaN(parseFloat(str))
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}