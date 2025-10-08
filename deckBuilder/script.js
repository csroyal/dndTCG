let startContainer = document.getElementById("startContainer");
let createNewDeck = document.getElementById("createNewDeck");
let userDeckList = document.getElementById("userDeckList");
let deckPreviewPanel = document.getElementById("deckPreviewPanel");
let deckPreviewName = document.getElementById("deckPreviewName");
let deckPreviewCards = document.getElementById("deckPreviewCards");
let deckPreviewEditBtn = document.getElementById("deckPreviewEditBtn");
let deckEditor = document.getElementById("deckEditor");
let deckEditorName = document.getElementById("deckEditorName");
let backToDeckList = document.getElementById("backToDeckList");
let currentDeckListing = document.getElementById("currentDeckListing");
let cardCollection = document.getElementById("cardCollection");
let noCards = document.getElementById("noCards");
let goToCollectionBtn = document.getElementById("goToCollectionBtn");
let currentDeckCount = document.getElementById("currentDeckCount");
let saveDeck = document.getElementById("saveDeck");
let addCardToDeckBtn = document.getElementById("addCardToDeckBtn");
let rarityR = document.getElementById("rarityR");
let raritySR = document.getElementById("raritySR");
let raritySSR = document.getElementById("raritySSR");
let typeMonster = document.getElementById("typeMonster");
let typeSpell = document.getElementById("typeSpell");
let typeReaction = document.getElementById("typeReaction");
let typeUtility = document.getElementById("typeUtility");
let typeArtifact = document.getElementById("typeArtifact");

let user_collection = JSON.parse(localStorage.getItem("DNDTCG_USER_COLLECTION"));
let user_decks = JSON.parse(localStorage.getItem("DNDTCG_USER_DECKS"));
let currentDeck;

let maxRcards = 30, maxSRcards = 10, maxSSRcards = 5;

if (user_decks) {
    user_decks.forEach(deck => {
        addDeckToDecklist(deck);
    });
} else {
    user_decks = [];
}

createNewDeck.addEventListener("click", () => {
    let deckName = prompt("Enter a name for your new deck:");
    if (!deckName) return;
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
    deckDiv.classList.add("user-deck", "btn", "btn-primary");
    deckDiv.innerHTML = deck.name;
    deckDiv.addEventListener("click", (e) => {
        if (e.target.classList.contains("user-deck")) {
            // Show deck preview panel to the right
            deckPreviewPanel.style.display = "flex";
            deckPreviewName.textContent = deck.name;
            deckPreviewCards.innerHTML = "";
            currentDeck = deck;
            if (deck.deckList && deck.deckList.length > 0) {
                deck.deckList.forEach(card => {
                    let cardImg = document.createElement("img");
                    cardImg.className = "deck-preview-card-img";
                    cardImg.src = `../assets/cards/${cardNameToImageName(card.name)}.png`;
                    cardImg.alt = card.name;
                    cardImg.title = card.name;
                    deckPreviewCards.appendChild(cardImg);
                });
            } else {
                deckPreviewCards.innerHTML = "<i>No cards in deck</i>";
            }
            // Set up preview panel actions
            deckPreviewEditBtn.onclick = function() {
                startContainer.style.display = "none";
                deckEditor.style.display = "flex";
                deckEditorName.innerHTML = deck.name;
                if (!user_collection) {
                    noCards.style.display = "flex";
                    goToCollectionBtn.style.display = "flex";
                } else {
                    noCards.style.display = "none";
                    goToCollectionBtn.style.display = "none";
                    cardCollection.innerHTML = "";
                    user_collection = masterSort(user_collection);
                    user_collection.forEach(card => {
                        addToCardCollection(card);
                    });
                    displayDecklist();
                }
            };
            // Delete button logic
            let deckPreviewDeleteBtn = document.getElementById("deckPreviewDeleteBtn");
            deckPreviewDeleteBtn.onclick = function() {
                if (confirm("Are you sure you want to delete this deck? This cannot be undone.")) {
                    for (d in user_decks) {
                        if (user_decks[d].name === deck.name) {
                            user_decks.splice(d, 1);
                            localStorage.setItem("DNDTCG_USER_DECKS", JSON.stringify(user_decks));
                            deckDiv.remove();
                            deckPreviewPanel.style.display = "none";
                            break;
                        }
                    }
                }
            };
            // Export button logic
            let deckPreviewExportBtn = document.getElementById("deckPreviewExportBtn");
            deckPreviewExportBtn.onclick = function() {
                // Export format: JSON with name and deckList
                let exportObj = {
                    name: deck.name,
                    deckList: deck.deckList.map(card => ({ name: card.name, rarity: card.rarity }))
                };
                let exportStr = JSON.stringify(exportObj, null, 2);
                // Download as file
                let blob = new Blob([exportStr], { type: "application/json" });
                let url = URL.createObjectURL(blob);
                let a = document.createElement("a");
                a.href = url;
                a.download = `${deck.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_deck.json`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            };
        }
    });
    userDeckList.append(deckDiv);
}

backToDeckList.addEventListener("click", () => {
    if (confirm("Are you sure you want to go back to the deck list? Any unsaved changes will be lost.")) {
        startContainer.style.display = "flex";
        deckEditor.style.display = "none";
    }
});

function addToCardCollection(card) {
    let newCardDiv = document.createElement("div");
    newCardDiv.classList.add("card-collection-card");
    newCardDiv.rarity = card.rarity;
    newCardDiv.cardType = card.cardType;
    newCardDiv.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    newCardDiv.addEventListener("click", () => {
        openCardPopup(card);
        addCardToDeckBtn.cardData = card;
    });
    newCardDiv.addEventListener("contextmenu", () => {
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

        let currentRarityCount = 0;
        for (c in currentDeck.deckList) {
            if (currentDeck.deckList[c].rarity === card.rarity) {
                currentRarityCount++;
            }
        }

        if (card.rarity === "R" && currentCount >= 3) {
            alert("You are only allowed 3 copies of an R rarity card in a deck.");
            return;
        }
        else if (card.rarity === "SR" && currentCount >= 2) {
            alert("You are only allowed 2 copies of an SR rarity card in a deck.");
            return;
        }
        else if ((card.name === "Mouth of the Beholder" || card.name === "Tentacles of the Beholder") && currentCount >= 1) {
            alert("You are only allowed 1 copy of this card in a deck.");
            return;
        }
        else if (card.rarity === "SSR" && currentCount >= 1) {
            alert("You are only allowed 1 copy of an SSR rarity card in a deck.");
            return;
        }

        if (card.rarity === "R" && currentRarityCount >= maxRcards) {
            alert(`You can only have up to ${maxRcards} R rarity cards in a deck.`);
            return;
        }
        else if (card.rarity === "SR" && currentRarityCount >= maxSRcards) {
            alert(`You can only have up to ${maxSRcards} SR rarity cards in a deck.`);
            return;
        }
        else if (card.rarity === "SSR" && currentRarityCount >= maxSSRcards) {
            alert(`You can only have up to ${maxSSRcards} SSR rarity cards in a deck.`);
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
    newCardDiv.rarity = card.rarity;
    newCardDiv.cardType = card.cardType;
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
    // Deck count
    currentDeckCount.innerHTML = currentDeck.deckList.length;
    // Rarity counts
    let rCount = 0, srCount = 0, ssrCount = 0;
    // Card type counts
    let monsterCount = 0, spellCount = 0, reactionCount = 0, utilityCount = 0, artifactCount = 0;
    currentDeck.deckList.forEach(card => {
        if (card.rarity === "R") rCount++;
        if (card.rarity === "SR") srCount++;
        if (card.rarity === "SSR") ssrCount++;
        switch (card.cardType) {
            case "Monster": monsterCount++; break;
            case "Spell": spellCount++; break;
            case "Reaction": reactionCount++; break;
            case "Utility": utilityCount++; break;
            case "Artifact": artifactCount++; break;
        }
    });
    document.getElementById("rarityR").innerHTML = `R<br>${rCount}`;
    document.getElementById("raritySR").innerHTML = `SR<br>${srCount}`;
    document.getElementById("raritySSR").innerHTML = `SSR<br>${ssrCount}`;
    document.getElementById("typeMonster").innerHTML = `Monster<br>${monsterCount}`;
    document.getElementById("typeSpell").innerHTML = `Spell<br>${spellCount}`;
    document.getElementById("typeReaction").innerHTML = `Reaction<br>${reactionCount}`;
    document.getElementById("typeUtility").innerHTML = `Utility<br>${utilityCount}`;
    document.getElementById("typeArtifact").innerHTML = `Artifact<br>${artifactCount}`;
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

addCardToDeckBtn.addEventListener("click", () => {
    if (currentDeck.deckList.length >= 30) {
        alert("You are only allowed up to 30 cards in a deck.");
        return;
    }

    let card = addCardToDeckBtn.cardData;

    let currentCount = 0;
    for (c in currentDeck.deckList) {
        if (currentDeck.deckList[c].name === card.name) {
            currentCount++;
        }
    }

    let currentRarityCount = 0;
    for (c in currentDeck.deckList) {
        if (currentDeck.deckList[c].rarity === card.rarity) {
            currentRarityCount++;
        }
    }

    if (card.rarity === "R" && currentCount >= 3) {
        alert("You are only allowed 3 copies of an R rarity card in a deck.");
        return;
    }
    else if (card.rarity === "SR" && currentCount >= 2) {
        alert("You are only allowed 2 copies of an SR rarity card in a deck.");
        return;
    }
    else if ((card.name === "Mouth of the Beholder" || card.name === "Tentacles of the Beholder") && currentCount >= 1) {
        alert("You are only allowed 1 copy of this card in a deck.");
        return;
    }
    else if (card.rarity === "SSR" && currentCount >= 1) {
        alert("You are only allowed 1 copy of an SSR rarity card in a deck.");
        return;
    }

    if (card.rarity === "R" && currentRarityCount >= maxRcards) {
        alert(`You can only have up to ${maxRcards} R rarity cards in a deck.`);
        return;
    }
    else if (card.rarity === "SR" && currentRarityCount >= maxSRcards) {
        alert(`You can only have up to ${maxSRcards} SR rarity cards in a deck.`);
        return;
    }
    else if (card.rarity === "SSR" && currentRarityCount >= maxSSRcards) {
        alert(`You can only have up to ${maxSSRcards} SSR rarity cards in a deck.`);
        return;
    }
    addCardToDecklist(card);
    currentDeck.deckList.push(card);
    displayDecklist();
    closeCardPopup();
});

let activeRarityFilter = "All";
let activeTypeFilter = "All";

function filter(rarity, cardType) {
    let cards = document.querySelectorAll(".card-collection-card");
    cards.forEach(card => {
        if ((rarity === "All" || card.rarity === rarity) &&
            (cardType === "All" || card.cardType === cardType)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });

    let deckCards = document.querySelectorAll(".card-decklist-card");
    deckCards.forEach(card => {
        if ((rarity === "All" || card.rarity === rarity) &&
            (cardType === "All" || card.cardType === cardType)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

rarityR.addEventListener("click", () => {
    if (activeRarityFilter === "R") {
        activeRarityFilter = "All";
        filter(activeRarityFilter, activeTypeFilter);
        rarityR.classList.remove("active-filter");
    } else {
        activeRarityFilter = "R";
        filter(activeRarityFilter, activeTypeFilter);
        rarityR.classList.add("active-filter");
        raritySR.classList.remove("active-filter");
        raritySSR.classList.remove("active-filter");
    }
});
raritySR.addEventListener("click", () => {
    if (activeRarityFilter === "SR") {
        activeRarityFilter = "All";
        filter(activeRarityFilter, activeTypeFilter);
        raritySR.classList.remove("active-filter");
    } else {
        activeRarityFilter = "SR";
        filter(activeRarityFilter, activeTypeFilter);
        rarityR.classList.remove("active-filter");
        raritySR.classList.add("active-filter");
        raritySSR.classList.remove("active-filter");
    }
});
raritySSR.addEventListener("click", () => {
    if (activeRarityFilter === "SSR") {
        activeRarityFilter = "All";
        filter(activeRarityFilter, activeTypeFilter);
        raritySSR.classList.remove("active-filter");
    } else {
        activeRarityFilter = "SSR";
        filter(activeRarityFilter, activeTypeFilter);
        rarityR.classList.remove("active-filter");
        raritySR.classList.remove("active-filter");
        raritySSR.classList.add("active-filter");
    }
});
typeMonster.addEventListener("click", () => {
    if (activeTypeFilter === "Monster") {
        activeTypeFilter = "All";
        filter(activeRarityFilter, activeTypeFilter);
        typeMonster.classList.remove("active-filter");
    } else {
        activeTypeFilter = "Monster";
        filter(activeRarityFilter, activeTypeFilter);
        typeMonster.classList.add("active-filter");
        typeSpell.classList.remove("active-filter");
        typeReaction.classList.remove("active-filter");
        typeUtility.classList.remove("active-filter");
        typeArtifact.classList.remove("active-filter");
    }
});
typeSpell.addEventListener("click", () => {
    if (activeTypeFilter === "Spell") {
        activeTypeFilter = "All";
        filter(activeRarityFilter, activeTypeFilter);
        typeSpell.classList.remove("active-filter");
    } else {
        activeTypeFilter = "Spell";
        filter(activeRarityFilter, activeTypeFilter);
        typeMonster.classList.remove("active-filter");
        typeSpell.classList.add("active-filter");
        typeReaction.classList.remove("active-filter");
        typeUtility.classList.remove("active-filter");
        typeArtifact.classList.remove("active-filter");
    }
});
typeReaction.addEventListener("click", () => {
    if (activeTypeFilter === "Reaction") {
        activeTypeFilter = "All";
        filter(activeRarityFilter, activeTypeFilter);
        typeReaction.classList.remove("active-filter");
    } else {
        activeTypeFilter = "Reaction";
        filter(activeRarityFilter, activeTypeFilter);
        typeMonster.classList.remove("active-filter");
        typeSpell.classList.remove("active-filter");
        typeReaction.classList.add("active-filter");
        typeUtility.classList.remove("active-filter");
        typeArtifact.classList.remove("active-filter");
    }
});
typeUtility.addEventListener("click", () => {
    if (activeTypeFilter === "Utility") {
        activeTypeFilter = "All";
        filter(activeRarityFilter, activeTypeFilter);
        typeUtility.classList.remove("active-filter");
    } else {
        activeTypeFilter = "Utility";
        filter(activeRarityFilter, activeTypeFilter);
        typeMonster.classList.remove("active-filter");
        typeSpell.classList.remove("active-filter");
        typeReaction.classList.remove("active-filter");
        typeUtility.classList.add("active-filter");
        typeArtifact.classList.remove("active-filter");
    }
});
typeArtifact.addEventListener("click", () => {
    if (activeTypeFilter === "Artifact") {
        activeTypeFilter = "All";
        filter(activeRarityFilter, activeTypeFilter);
        typeArtifact.classList.remove("active-filter");
    } else {
        activeTypeFilter = "Artifact";
        filter(activeRarityFilter, activeTypeFilter);
        typeMonster.classList.remove("active-filter");
        typeSpell.classList.remove("active-filter");
        typeReaction.classList.remove("active-filter");
        typeUtility.classList.remove("active-filter");
        typeArtifact.classList.add("active-filter");
    }
});