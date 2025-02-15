let cardFunctions = {
    // SPELL - R
    "Acid Arrow": () => {},
    "Bane": () => {},
    "Bless": () => {},
    "Blindness/Deafness": () => {},
    "Cure Wounds": () => {},
    "Earth Tremor": () => {},
    "Thunderwave": () => {},
    // SPELL - SR
    "Fireball": () => {},
    "Insect Plague": () => {},
    "Lightning Bolt": () => {},
    "Misty Step": () => {},
    "Soul Drain": () => {},
    // SPELL - SSR
    "Invulnerability": () => {},
    "Meteor Swarm": () => {},
    "Power Word Kill": () => {},
    "Prismatic Spray": () => {},
    "Regenerate": () => {},
    // UTILITY - R
    "Arcane Recharge": () => { shuffleUpTo3SpellsDiscardIntoDeck(); },
    "Bardic Inspiration": () => {},
    "Call of the Beast": () => {},
    "Cunning Action": () => {},
    "Eye of the Void": () => { lookAtTop3Discard1Stack2InOrder(); },
    "Law of Equivalent Exchange": () => { discardOneThenDrawOne(); },
    "Lucky Coin Flip": () => { flipCoinHeadsDrawOne(); },
    "Wild Shape": () => { replaceBeastOnFieldWithSameRarityFromHand(); },
    // UTILITY - SR
    "Cursed Pact": () => {},
    "Dark Harvest": () => { drawCardForEachUndeadOnField(); },
    "Final Will & Testament": () => { drawCardsIfMonsterDiedLastTurn(2); },
    "Fortune Teller": () => { lookAtTop4Draw1ShuffleDeck(); },
    "Gambler": () => { shuffleHandIntoDeckRollD20(); },
    "Greedy Looting": () => { drawCards(2); },
    "Luminous Crystal": () => { lookAtBottom3Draw1Stack2InOrder(); },
    "Magic Librarian": () => { drawCardForEachSpellInHand(); },
    "Mental Reset": () => { shuffleHandIntoDeckDrawSameAmount(); },
    "Orb of Dragonkind": () => { },
    "Reanimate": () => { discardOneThenDrawMonsterFromDiscard(); },
    "Rewind the Clock": () => { shuffleDiscardIntoDeck(); },
    // UTILITY - SSR
    "Action Surge": () => { enableActionSurge(); },
    "Mind's Eye": () => { searchDeck("any"); },
    "The Ace Up Your Sleeve": () => { aceUpYourSleeve(); }
}
let actionSurge = false;
let cursedBattlefield = false;

function shuffleHandIntoDeck(callback) {
    hand.classList.add("shuffling");
    setTimeout(() => {
        currentHand.forEach(card => {
            currentDeck.push(card);
        });
        currentHand = [];
        hand.innerHTML = "";
        hand.classList.remove("shuffling");
        shuffleDeck();
    }, 500);
    setTimeout(callback, 2401);
}

function discardFromHand(callback) {
    for (let c in currentHand) {
        let cardEl = document.createElement("div");
        cardEl.classList.add("card");
        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentHand[c].name)}.png)`;
        cardEl.dataset.num = c;
        cardEl.onclick = function(e) {
            if (document.querySelector("#handView .card.selected")) { document.querySelector("#handView .card.selected").classList.remove("selected"); }
            e.target.classList.add("selected");
        };
        handView.append(cardEl);
    }
    handViewConfirmBtn.onclick = () => {
        let selectedCardNum = document.querySelector("#handView .card.selected").dataset.num;
        let selectedCard = currentHand[document.querySelector("#handView .card.selected").dataset.num];
        currentHand.splice(selectedCardNum, 1);
        addToDiscardPile(selectedCard);
        rerenderHand();
        handViewModalContainer.style.display = "none";
        document.querySelector("#handView .card.selected").classList.remove("selected");
        setTimeout(callback, 200);
    };
    handViewTitle.innerHTML = "Discard a card from your hand";
    handViewModalContainer.style.display = "flex";
}

function shuffleUpTo3SpellsDiscardIntoDeck() {
    deckView.innerHTML = "";
    for (let c in currentDiscard) {
        if (currentDiscard[c].cardType === "Spell") {
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDiscard[c].name)}.png)`;
            cardEl.onclick = (e) => {
                let selectedCards = document.querySelectorAll("#deckView .card.selected");
                console.log(selectedCards.length);
                if (selectedCards.length >= 3 && !e.target.classList.contains("selected")) {
                    alert("You can only select up to 3 cards.");
                    return;
                }
                e.target.classList.toggle("selected");
            };
            deckView.append(cardEl);
        }
    }
    deckViewTitle.innerHTML = "Select up to 3 spell cards from your discard pile";
    deckModalContainer.style.display = "flex";
}

function lookAtTop3Discard1Stack2InOrder() {
    deckView.innerHTML = "";
    for (let c = 0; c <= 2; c++) {
        let cardEl = document.createElement("div");
        cardEl.classList.add("card");
        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
        cardEl.onclick = () => {
            let top3Cards = currentDeck.splice(0, 3);
            let chosenCard = top3Cards[c];
            console.log("chose", chosenCard);
            currentDiscard.push(chosenCard);
            addToDiscardPile(chosenCard);
            cardEl.remove();
            console.log(top3Cards, chosenCard);
            for (l in top3Cards) {
                if (top3Cards[l].name === chosenCard.name) {
                    top3Cards.splice(l, 1);
                }
            }
            console.log(top3Cards);
            
            let otherCardEls = document.querySelectorAll("#deckView .card");
            for (let e in otherCardEls) {
                if (!otherCardEls[e].tagName) break;
                otherCardEls[e].onclick = () => {
                    deckModalContainer.style.display = "none";
                    let cardOnTop = top3Cards[e];
                    currentDeck.unshift(top3Cards.filter(item => item !== cardOnTop)[0]);
                    currentDeck.unshift(cardOnTop);
                }
            }
            deckViewTitle.innerHTML = "These cards will go on top of your deck. Choose one to put on the very top";
        };

        deckView.append(cardEl);
    }
    deckViewTitle.innerHTML = "Choose a card to discard";
    deckModalContainer.style.display = "flex";
}

function discardOneThenDrawOne() {
    discardFromHand(() => { drawCard(); });
}

function flipCoinHeadsDrawOne() {
    let result = flipCoin();
    setTimeout(() => {
        if (result === "Heads") {
            drawCard();
        } else {
            alert("Heal 5 HP from your character.");
        }
    }, 3000);
}

function replaceBeastOnFieldWithSameRarityFromHand() {

}

function drawCardForEachUndeadOnField() {
    let drawNum = countUndeadOnField();
    drawCards(drawNum);
}

function drawCardsIfMonsterDiedLastTurn(num) {
    if (monsterDefeatedLastTurn) drawCards(num);
}

function lookAtTop4Draw1ShuffleDeck() {
    deckView.innerHTML = "";
    for (let c = 0; c <= 3; c++) {
        let cardEl = document.createElement("div");
        cardEl.classList.add("card");
        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
        cardEl.onclick = () => {
            let chosenCard = currentDeck[c];
            console.log("chose", chosenCard);
            currentHand.push(chosenCard);
            addCardToHand(chosenCard);
            var drawSound = new Audio('../assets/draw.mp3');
            drawSound.volume = 0.4;
            drawSound.play();
            deckModalContainer.style.display = "none";

            setTimeout(shuffleDeck, 250);
        };

        deckView.append(cardEl);
    }
    deckViewTitle.innerHTML = "Choose a card to put into your hand";
    deckModalContainer.style.display = "flex";
}

function shuffleHandIntoDeckRollD20() {
    shuffleHandIntoDeck(() => {
        let diceRoll = rollDice(20);
        setTimeout(() => {
            if (diceRoll > 10) drawCards(6);
            else drawCard();
        }, 3000);
    });
}

function lookAtBottom3Draw1Stack2InOrder() {
    deckView.innerHTML = "";
    for (let c = currentDeck.length - 3; c < currentDeck.length; c++) {
        let cardEl = document.createElement("div");
        cardEl.classList.add("card");
        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
        cardEl.onclick = () => {
            let chosenCard = currentDeck[c];
            console.log("chose", chosenCard);
            currentHand.push(chosenCard);
            addCardToHand(chosenCard);
            var drawSound = new Audio('../assets/draw.mp3');
            drawSound.volume = 0.4;
            drawSound.play();
            cardEl.remove();
            let last3Cards = currentDeck.splice(currentDeck.length - 3, 3);
            console.log(last3Cards, chosenCard);
            for (l in last3Cards) {
                if (last3Cards[l].name === chosenCard.name) {
                    last3Cards.splice(l, 1);
                }
            }
            console.log(last3Cards);
            
            let otherCardEls = document.querySelectorAll("#deckView .card");
            for (let e in otherCardEls) {
                if (!otherCardEls[e].tagName) break;
                otherCardEls[e].onclick = () => {
                    deckModalContainer.style.display = "none";
                    let cardOnTop = last3Cards[e];
                    currentDeck.unshift(last3Cards.filter(item => item !== cardOnTop)[0]);
                    currentDeck.unshift(cardOnTop);
                }
            }
            deckViewTitle.innerHTML = "These cards will go on top of your deck. Choose one to put on the very top";
        };

        deckView.append(cardEl);
    }
    deckViewTitle.innerHTML = "Choose a card to put into your hand";
    deckModalContainer.style.display = "flex";
}

function drawCardForEachSpellInHand() {
    let drawNum = countSpellsInHand();
    drawCards(drawNum);
}

function shuffleHandIntoDeckDrawSameAmount() {
    let drawAmount = currentHand.length + 1;
    shuffleHandIntoDeck(() => { drawCards(drawAmount); });
}

function discardOneThenDrawMonsterFromDiscard() {
    discardFromHand(() => {
        deckView.innerHTML = "";
        for (let c in currentDiscard) {
            if (currentDiscard[c].cardType === "Monster") {
                let cardEl = document.createElement("div");
                cardEl.classList.add("card");
                cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDiscard[c].name)}.png)`;
                cardEl.onclick = () => {
                    addCardToHand(currentDiscard[c]);
                    currentDiscard.splice(c, 1);
                    deckModalContainer.style.display = "none";

                    var drawSound = new Audio('../assets/draw.mp3');
                    drawSound.volume = 0.4;
                    drawSound.play();

                    rerenderDiscard();
                };
                deckView.append(cardEl);
            }
        }
        deckViewTitle.innerHTML = "Select a monster card from your discard pile";
        deckModalContainer.style.display = "flex";
    });
}

function shuffleDiscardIntoDeck() {
    discardPile.classList.add("shuffle");
    setTimeout(() => {
        currentDiscard.forEach(card => {
            currentDeck.push(card);
        });
        currentDiscard = [];
        discardPile.innerHTML = "Discard";
        discardPile.style.backgroundImage = "";
        discardPile.classList.remove("shuffle");
        discardPileView.innerHTML = "";
        let addToDiscard;
        for (c in currentDeck) {
            if (currentDeck[c].name === "Rewind the Clock") {
                addToDiscard = currentDeck[c];
                currentDeck.splice(c, 1);
            }
        }
        shuffleDeck();
        setTimeout(() => {
            addToDiscardPile(addToDiscard);
        }, 1401);
    }, 500);
}

function searchDeck(parameter) {
    deckView.innerHTML = "";
    currentDeck = masterSort(currentDeck);
    for (let c in currentDeck) {
        let cardEl = document.createElement("div");
        cardEl.classList.add("card");
        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
        cardEl.onclick = () => {
            console.log("chose", currentDeck[c]);
            currentHand.push(currentDeck[c]);
            addCardToHand(currentDeck[c]);
            currentDeck.splice(c, 1);
            deckModalContainer.style.display = "none";
            setTimeout(shuffleDeck, 500);
        };

        deckView.append(cardEl);
    }
    deckViewTitle.innerHTML = "Select a card from your deck";
    deckModalContainer.style.display = "flex";
}

function aceUpYourSleeve() {

}

function enableActionSurge() {
    actionSurge = true;
}

function checkForBeastOnField() {
    for (m in currentMonsters) {
        if (currentMonsters[m].monsterType === "Beast") {
            return true;
        }
    }
}

function checkForBeastInHand() {
    for (c in currentHand) {
        if (currentHand[c].monsterType === "Beast") {
            return true;
        }
    }
}

function countUndeadOnField() {
    let count = 0;
    for (m in currentMonsters) {
        if (currentMonsters[m].monsterType === "Undead") {
            count++;
        }
    }
    return count;
}

function countSpellsInHand() {
    let count = 0;
    for (c in currentHand) {
        if (currentHand[c].cardType === "Spell") {
            count++;
        }
    }
    return count;
}

function checkForMonsterInDiscard() {
    for (c in currentDiscard) {
        if (currentDiscard[c].cardType === "Monster") {
            return true;
        }
    }
}

function checkForSpellInDiscard() {
    for (c in currentDiscard) {
        if (currentDiscard[c].cardType === "Spell") {
            return true;
        }
    }
}