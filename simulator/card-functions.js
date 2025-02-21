let cardFunctions = {
    // SPELL - R
    "Acid Arrow": () => {},
    "Bane": () => {},
    "Bless": () => {},
    "Blindness/Deafness": () => {},
    "Burning Hands": () => {},
    "Charm Person": () => {},
    "Chromatic Orb": () => {},
    "Cure Wounds": () => {},
    "Detect Magic": () => {},
    "Earth Tremor": () => {},
    "Earthbind": () => {},
    "Feather Fall": () => {},
    "Grease": () => {},
    "Heroism": () => {},
    "Hold Person": () => {},
    "Magic Missile": () => {},
    "Mage Armor": () => {},
    "Shield of Faith": () => {},
    "Thorn Whip": () => {},
    "Thunderwave": () => {},
    "Web": () => {},
    // SPELL - SR
    "Banishment": () => {},
    "Black Tentacles": () => {},
    "Cone of Cold": () => {},
    "Fireball": () => {},
    "Immolation": () => {},
    "Insect Plague": () => {},
    "Lightning Bolt": () => {},
    "Maelstrom": () => {},
    "Misty Step": () => {},
    "Soul Drain": () => {},
    "Soul Shackles": () => {},
    "Speak with Dead": () => {},
    "Stoneskin": () => {},
    // SPELL - SSR
    "Chain Lightning": () => {},
    "Invulnerability": () => {},
    "Meteor Swarm": () => {},
    "Power Word Kill": () => {},
    "Prismatic Spray": () => {},
    "Regenerate": () => { regenerate(); },
    // REACTION - SR
    "Necromancer's Gravecall": () => { necromancersGravecall(); },
    "Siphon Life": () => { siphonLife(); },
    // REACTION - SSR
    "Phoenix Rebirth": () => { phoenixRebirth(); },
    // UTILITY - R
    "Arcane Recharge": () => { shuffleUpTo3SpellsDiscardIntoDeck(); },
    "Bardic Inspiration": () => { addBardicInspirationToAllFieldMonsters(); },
    "Call of the Beast": () => { searchDeckForBeastMonster(); },
    "Cunning Action": () => { selectMonsterCunningAction(); },
    "Eye of the Void": () => { lookAtTop3Discard1Stack2InOrder(); },
    "Law of Equivalent Exchange": () => { discardOneThenDrawOne(); },
    "Lucky Coin Flip": () => { flipCoinHeadsDrawOne(); },
    "Monster Sacrifice": () => { discardMonsterSearchDeckForSameRarity(); },
    "Odd Medicine": () => { selectMonsterOddMedicine(); },
    "Quick Feet": () => { selectMonsterAdd10Speed(); },
    "Reckless Attack": () => { selectMonsterRecklessAttack(); },
    "Wild Shape": () => { replaceBeastOnFieldWithSameRarityFromHand(); },
    // UTILITY - SR
    "Cursed Pact": () => { selectMonsterCursedPact(); },
    "Dark Harvest": () => { drawCardForEachUndeadOnField(); },
    "Final Will & Testament": () => { drawCardsIfMonsterDiedLastTurn(2); },
    "Fortune Teller": () => { lookAtTop4Draw1ShuffleDeck(); },
    "Gambler": () => { shuffleHandIntoDeckRollD20(); },
    "Greedy Looting": () => { drawCards(2); },
    "Luminous Crystal": () => { lookAtBottom3Draw1Stack2InOrder(); },
    "Magic Librarian": () => { drawCardForEachSpellInHand(); },
    "Mental Reset": () => { shuffleHandIntoDeckDrawSameAmount(); },
    "Orb of Dragonkind": () => { twoChoicesOrbOfDragonkind(); },
    "Reanimate": () => { discardOneThenDrawMonsterFromDiscard(); },
    "Repairs": () => { selectMonsterRepairs(); },
    "Rewind the Clock": () => { shuffleDiscardIntoDeck(); },
    "Summon Greater Undead": () => { reviveUndeadMonsterHalfHPIfSSR(); },
    "Traveling Merchant": () => { searchDeckTravelingMerchant(); },
    // UTILITY - SSR
    "Action Surge": () => { enableActionSurge(); },
    "Cursed Battlefield": () => { enableCursedBattlefield(); },
    "Eye of the Beholder": () => { eyeOfTheBeholder(); },
    "Mind's Eye": () => { searchDeck(); },
    "Sanguine Revelation": () => { sanguineRevelation(); },
    "The Ace Up Your Sleeve": () => { aceUpYourSleeve(); }
}
let actionSurge = false;
let cursedBattlefield = false;
let aceUpYourSleeveDamageBoost = false;
let monsterSelectRestrictions = [];

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
    handView.innerHTML = "";
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
        setTimeout(callback, 200);
    };
    handViewTitle.innerHTML = "Discard a card from your hand";
    handViewModalContainer.style.display = "flex";
}

function selectMonster(callback) {
    handView.innerHTML = "";
    for (let c in currentMonsters) {
        let monsterIsRestricted = false;
        for (r in monsterSelectRestrictions) {
            if (currentMonsters[c].monsterType === monsterSelectRestrictions[r]) {
                monsterIsRestricted = true;
                break;
            }
        }
        if (monsterIsRestricted) continue;
        let cardEl = document.createElement("div");
        cardEl.classList.add("card");
        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentMonsters[c].name)}.png)`;
        cardEl.dataset.num = c;
        cardEl.onclick = (e) => {
            if (document.querySelector("#handView .card.selected")) { document.querySelector("#handView .card.selected").classList.remove("selected"); }
            e.target.classList.add("selected");
        }
        handView.append(cardEl);
    }
    handViewConfirmBtn.onclick = () => {
        let selectedCardNum = document.querySelector("#handView .card.selected").dataset.num;
        let selectedCard = currentMonsters[document.querySelector("#handView .card.selected").dataset.num];
        console.log(selectedCardNum, selectedCard);
        handViewModalContainer.style.display = "none";
        setTimeout(() => {
            callback(selectedCard);
        }, 200);
    };
    handViewTitle.innerHTML = "Choose a monster on the field";
    handViewModalContainer.style.display = "flex";
}

function displayChoices(choicesArr) {
    choicesEl.innerHTML = "";
    for (let c in choicesArr) {
        let choiceEl = document.createElement("div");
        choiceEl.classList.add("choice");
        choiceEl.innerHTML = choicesArr[c].text;
        choiceEl.addEventListener("click", () => {
            choiceModalContainer.style.display = "none";
            choicesArr[c].function();
        });
        choicesEl.append(choiceEl);
    }
    choiceModalContainer.style.display = "flex";
}

function addEffectToMonster(card, effect) {
    for (c in currentMonsters) {
        if (currentMonsters[c].name === card.name) {
            if (!currentMonsters[c].effects) currentMonsters[c].effects = [];
            currentMonsters[c].effects.push(effect);
            return;
        }
    }
}

function regenerate() {
    setTimeout(() => {
        let healing = rollMultiDice(4, 8) + 15;
        alert("The target receives", healing, "health, and 1 health at the start of each of their turns.")
    }, 300);
}

function necromancersGravecall() {
    deckView.innerHTML = "";
    let count = 0;
    for (let c in currentDiscard) {
        if (currentDiscard[c].cardType === "Monster" && currentDiscard[c].monsterType === "Undead" && (currentDiscard[c].rarity === "R" || currentDiscard[c].rarity === "SR")) {
            count++;
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.dataset.num = c;
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDiscard[c].name)}.png)`;
            cardEl.onclick = (e) => {
                if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                e.target.classList.add("selected");
            };

            deckView.append(cardEl);
        }
    }
    deckViewConfirmBtn.onclick = () => {
        if (count === 0) {
            deckModalContainer.style.display = "none";
            return;
        }
        let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
        let selectedCard = currentDiscard[selectedCardNum];
        console.log("chose", selectedCard);

        summonMonster(selectedCard);
        if (selectedCard.rarity === "SR") {
            document.querySelector("#monsterZone" + (selectedCard.currentZone + 1) + " .monster-overlay-health").innerHTML = Math.ceil(Number(document.querySelector("#monsterZone" + (selectedCard.currentZone + 1) + " .monster-overlay-health").innerHTML) / 2);
        }
        rerenderDiscard();

        currentDiscard.splice(selectedCardNum, 1);
        deckModalContainer.style.display = "none";
    };
    if (count === 0) { deckView.innerHTML = "There are no applicable cards from your discard pile."; }
    deckViewTitle.innerHTML = "Select a monster card from your discard pile";
    deckModalContainer.style.display = "flex";
}
 
function siphonLife() {
    selectMonster((card) => {
        let damage = rollDice(8);
        if (cursedBattlefield) damage = damage * 2;
        setTimeout(() => {
            damageMonster(card, damage);
            drawCard();
        }, 3000);
    });
}

function phoenixRebirth() {
    deckView.innerHTML = "";
    let count = 0;
    for (let c in currentDiscard) {
        if (currentDiscard[c].cardType === "Monster") {
            count++;
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.dataset.num = c;
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDiscard[c].name)}.png)`;
            cardEl.onclick = (e) => {
                if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                e.target.classList.add("selected");
            };

            deckView.append(cardEl);
        }
    }
    deckViewConfirmBtn.onclick = () => {
        if (count === 0) {
            deckModalContainer.style.display = "none";
            return;
        }
        let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
        let selectedCard = currentDiscard[selectedCardNum];
        console.log("chose", selectedCard);

        summonMonster(selectedCard);
        document.querySelector("#monsterZone" + (selectedCard.currentZone + 1) + " .monster-overlay-health").innerHTML = Math.ceil(Number(document.querySelector("#monsterZone" + (selectedCard.currentZone + 1) + " .monster-overlay-health").innerHTML) / 2);
        rerenderDiscard();

        setTimeout(() => {
            addEffectToMonster(selectedCard, { effect: "At the start of its next turn, deals 3d6 fire damage to all enemies within 10 feet.", type: "positive", source: "Phoenix Rebirth" });
            effectAnim(selectedCard, "positive");
        }, 750);

        currentDiscard.splice(selectedCardNum, 1);
        deckModalContainer.style.display = "none";
    };
    if (count === 0) { deckView.innerHTML = "There are no applicable cards from your discard pile."; }
    deckViewTitle.innerHTML = "Select a monster card from your discard pile";
    deckModalContainer.style.display = "flex";
}

function shuffleUpTo3SpellsDiscardIntoDeck() {
    deckView.innerHTML = "";
    for (let c in currentDiscard) {
        if (currentDiscard[c].cardType === "Spell") {
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDiscard[c].name)}.png)`;
            cardEl.dataset.card = JSON.stringify(currentDiscard[c]);
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
    deckViewConfirmBtn.onclick = () => {
        let selectedCards = document.querySelectorAll("#deckView .card.selected");
        for (c in selectedCards) {
            if (!selectedCards[c].tagName) break;
            let selected = JSON.parse(selectedCards[c].dataset.card);
            for (d in currentDiscard) {
                if (selected.name === currentDiscard[d].name) {
                    currentDiscard.splice(d, 1);
                    currentDeck.push(selected);
                    break;
                }
            }
        }
        rerenderDiscard();
        deckModalContainer.style.display = "none";
        setTimeout(shuffleDeck, 250);
    }
    deckViewTitle.innerHTML = "Select up to 3 spell cards from your discard pile";
    deckModalContainer.style.display = "flex";
}

function addBardicInspirationToAllFieldMonsters() {
    for (m in currentMonsters) {
        addEffectToMonster(currentMonsters[m], { effect: "Add 1d4 to next attack roll, ability check, or saving throw.", type: "positive", source: "Bardic Inspiration" });
        effectAnim(currentMonsters[m], "positive");
    }
}

function searchDeckForBeastMonster() {
    deckView.innerHTML = "";
    let count = 0;
    for (let c in currentDeck) {
        if (currentDeck[c].cardType === "Monster" && currentDeck[c].monsterType === "Beast") {
            count++;
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.dataset.num = c;
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
            cardEl.onclick = (e) => {
                if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                e.target.classList.add("selected");
            };
    
            deckView.append(cardEl);
        }
    }
    deckViewConfirmBtn.onclick = () => {
        if (count === 0) {
            deckModalContainer.style.display = "none";
            setTimeout(shuffleDeck, 500);
            return;
        }
        let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
        let selectedCard = currentDeck[selectedCardNum];
        currentHand.push(selectedCard);
        addCardToHand(selectedCard);
        currentDeck.splice(selectedCardNum, 1);
        deckModalContainer.style.display = "none";

        var drawSound = new Audio('../assets/draw.mp3');
        drawSound.volume = 0.8;
        drawSound.play();

        setTimeout(shuffleDeck, 500);
    };
    if (count === 0) { deckView.innerHTML = "There are no applicable cards from your deck."; }
    deckViewTitle.innerHTML = "Select a card from your deck";
    deckModalContainer.style.display = "flex";
}

function selectMonsterCunningAction() {
    monsterSelectRestrictions = [];
    selectMonster((card) => {
        addEffectToMonster(card, { effect: "Can use Dash, Disengage or Hide as a bonus action.", type: "positive", source: "Cunning Action" });
        effectAnim(card, "positive");
    });
}

function lookAtTop3Discard1Stack2InOrder() {
    deckView.innerHTML = "";
    let count = 0;
    for (let c = 0; c <= 2; c++) {
        if (currentDeck[c]) {
            count++;
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.dataset.num = c;
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
            cardEl.onclick = (e) => {
                if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                e.target.classList.add("selected");
            };
            deckView.append(cardEl);
        }
    }
    deckViewConfirmBtn.onclick = () => {
        let topCards;
        let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
        if (count === 0) {
            deckModalContainer.style.display = "none";
            setTimeout(shuffleDeck, 500);
            return;
        }
        else if (count === 1 ) {
            let chosenCard = currentDeck[0];
            currentDiscard.push(chosenCard);
            addToDiscardPile(chosenCard);
            currentDeck.splice(0, 1);
            deckModalContainer.style.display = "none";
            return;
        } else if (count === 2) {
            topCards = currentDeck.splice(0, 2);
        } else if (count === 3) {
            topCards = currentDeck.splice(0, 3);
        }
        let chosenCard = topCards[selectedCardNum];
        console.log("chose", chosenCard);
        currentDiscard.push(chosenCard);
        addToDiscardPile(chosenCard);
        document.querySelector("#deckView .card.selected").remove();
        console.log(topCards, chosenCard);
        for (l in topCards) {
            if (topCards[l].name === chosenCard.name) {
                topCards.splice(l, 1);
            }
        }
        
        let otherCardEls = document.querySelectorAll("#deckView .card");
        for (let e in otherCardEls) {
            if (!otherCardEls[e].tagName) break;
            otherCardEls[e].dataset.num = e;
            otherCardEls[e].onclick = (ev) => {
                if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                ev.target.classList.add("selected");
            }
        }
        deckViewConfirmBtn.onclick = () => {
            let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
            let cardOnTop = topCards[selectedCardNum];
            if (count === 2) {
                console.log(cardOnTop);
                currentDeck = [];
                currentDeck.push(cardOnTop);
            } else {
                currentDeck.unshift(topCards.filter(item => item !== cardOnTop)[0]);
                currentDeck.unshift(cardOnTop);
            }
            deckModalContainer.style.display = "none";
        }
        deckViewTitle.innerHTML = "These cards will go on top of your deck. Choose one to put on the very top";
    };
    if (count === 0) { deckView.innerHTML = "There are no applicable cards from your deck."; }
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

function discardMonsterSearchDeckForSameRarity() {
    handView.innerHTML = "";
    for (let c in currentHand) {
        if (currentHand[c].cardType === "Monster") {
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentHand[c].name)}.png)`;
            cardEl.dataset.num = c;
            cardEl.dataset.card = JSON.stringify(currentHand[c]);
            cardEl.onclick = function(e) {
                if (document.querySelector("#handView .card.selected")) { document.querySelector("#handView .card.selected").classList.remove("selected"); }
                e.target.classList.add("selected");
            };
            handView.append(cardEl);
        }
    }
    handViewConfirmBtn.onclick = () => {
        let selectedCardNum = document.querySelector("#handView .card.selected").dataset.num;
        let selectedCard = JSON.parse(document.querySelector("#handView .card.selected").dataset.card);
        currentHand.splice(selectedCardNum, 1);
        addToDiscardPile(selectedCard);
        rerenderHand();
        handViewModalContainer.style.display = "none";
        setTimeout(() => {
            let selectedRarity = selectedCard.rarity;
            deckView.innerHTML = "";
            currentDeck = masterSort(currentDeck);
            let count = 0;
            for (let c in currentDeck) {
                if (currentDeck[c].cardType === "Monster") {
                    if (currentDeck[c].rarity === selectedRarity) {
                        count++;
                        let cardEl = document.createElement("div");
                        cardEl.classList.add("card");
                        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
                        cardEl.dataset.num = c;
                        cardEl.onclick = (e) => {
                            if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                            e.target.classList.add("selected");
                        };
                
                        deckView.append(cardEl);
                    }
                }
            }
            deckViewConfirmBtn.onclick = () => {
                if (count === 0) {
                    deckModalContainer.style.display = "none";
                    setTimeout(shuffleDeck, 500);
                    return;
                }
                let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num
                let selectedCard = currentDeck[selectedCardNum];
                console.log("chose", selectedCard);
                currentHand.push(selectedCard);
                addCardToHand(selectedCard);
                currentDeck.splice(selectedCardNum, 1);
                deckModalContainer.style.display = "none";
        
                var drawSound = new Audio('../assets/draw.mp3');
                drawSound.volume = 0.8;
                drawSound.play();
        
                setTimeout(shuffleDeck, 500);
            };
            if (count === 0) { deckView.innerHTML = "There are no applicable cards from your deck."; }
            deckViewTitle.innerHTML = "Select a card from your deck";
            deckModalContainer.style.display = "flex";
        }, 200);
    };
    handViewTitle.innerHTML = "Discard a card from your hand";
    handViewModalContainer.style.display = "flex";
}

function selectMonsterOddMedicine() {
    monsterSelectRestrictions = ["Undead", "Construct"];
    selectMonster((card) => {
        let healAmount = rollDice(8);
        if (cursedBattlefield) healAmount = Math.ceil(healAmount / 2);
        setTimeout(() => {
            healMonster(card, healAmount);
        }, 3000);
    });
}

function selectMonsterAdd10Speed() {
    monsterSelectRestrictions = [];
    selectMonster((card) => {
        addEffectToMonster(card, { effect: "Movement speed is increased by 10 feet.", type: "positive", source: "Quick Feet" });
        effectAnim(card, "positive");
    });
}

function selectMonsterRecklessAttack() {
    monsterSelectRestrictions = [];
    selectMonster((card) => {
        addEffectToMonster(card, { effect: "Advantage on melee attack rolls.", type: "positive", source: "Reckless Attack" });
        addEffectToMonster(card, { effect: "Attack rolls against it have advantage", type: "negative", source: "Reckless Attack" });
        effectAnim(card, "positive");
    });
}

function replaceBeastOnFieldWithSameRarityFromHand() {
    let rarities = wildShapeCheck();
    handView.innerHTML = "";
    for (let c in currentMonsters) {
        if (currentMonsters[c].monsterType === "Beast" && rarities[currentMonsters[c].rarity]) {
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentMonsters[c].name)}.png)`;
            cardEl.dataset.num = c;
            cardEl.onclick = (e) => {
                if (document.querySelector("#handView .card.selected")) { document.querySelector("#handView .card.selected").classList.remove("selected"); }
                e.target.classList.add("selected");
            }
            handView.append(cardEl);
        }
    }
    handViewConfirmBtn.onclick = () => {
        let selectedCardNumOnField = document.querySelector("#handView .card.selected").dataset.num;
        let selectedCardOnField = currentMonsters[document.querySelector("#handView .card.selected").dataset.num];
        handViewModalContainer.style.display = "none";
        setTimeout(() => {
            handView.innerHTML = "";
            for (let c in currentHand) {
                if (currentHand[c].monsterType === "Beast" && currentHand[c].rarity === selectedCardOnField.rarity) {
                    let cardEl = document.createElement("div");
                    cardEl.classList.add("card");
                    cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentHand[c].name)}.png)`;
                    cardEl.dataset.num = c;
                    cardEl.onclick = (e) => {
                        if (document.querySelector("#handView .card.selected")) { document.querySelector("#handView .card.selected").classList.remove("selected"); }
                        e.target.classList.add("selected");
                    }
                    handView.append(cardEl);
                }
            }
            handViewConfirmBtn.onclick = () => {
                let selectedCardInHand = currentHand[document.querySelector("#handView .card.selected").dataset.num];
                let selectedCardNumInHand = document.querySelector("#handView .card.selected").dataset.num;
                console.log(selectedCardOnField, selectedCardInHand);
                handViewModalContainer.style.display = "none";
                console.log("replace", currentMonsters[selectedCardNumOnField], "with", selectedCardInHand);
                console.log("replace", currentHand[selectedCardNumInHand], "with", selectedCardOnField);

                selectedCardInHand.currentZone = currentMonsters[selectedCardNumOnField].currentZone;
                selectedCardNumOnField.currentZone = null;

                selectedCardInHand.effects = currentMonsters[selectedCardNumOnField].effects;
                selectedCardOnField.effects = [];

                currentMonsters[selectedCardNumOnField] = selectedCardInHand;
                currentHand[selectedCardNumInHand] = selectedCardOnField;

                document.querySelector("#monsterZone" + (selectedCardOnField.currentZone + 1)).style.backgroundImage = `url(../assets/cards/${cardNameToImageName(selectedCardInHand.name)}.png)`;
                document.querySelector("#monsterZone" + (selectedCardOnField.currentZone + 1) + " .monster-overlay-health").innerHTML = selectedCardInHand.hp;
                for (e in selectedCardInHand.effects) {
                    if (selectedCardInHand.effects[e].source === "Orb of Dragonkind") {
                        currentMonsters[selectedCardNumOnField].effects.splice(e, 1);
                        return;
                    }
                }
                document.querySelector("#monsterZone" + (selectedCardOnField.currentZone + 1) + " .monster-overlay-action").dataset.used = "true";
                document.querySelector("#monsterZone" + (selectedCardOnField.currentZone + 1) + " .monster-overlay-action").innerHTML = "⏳";
                rerenderHand();
            };
            handViewTitle.innerHTML = "Choose a monster in your hand";
            handViewModalContainer.style.display = "flex";
        }, 200);
    };
    handViewTitle.innerHTML = "Choose a monster on the field";
    handViewModalContainer.style.display = "flex";
}

function selectMonsterCursedPact() {
    monsterSelectRestrictions = [];
    selectMonster((card) => {
        addEffectToMonster(card, { effect: "+4 bonus to attack rolls.", type: "positive", source: "Cursed Pact" });
        addEffectToMonster(card, { effect: "Takes 1d6 necrotic damage at the start of each turn.", type: "negative", source: "Cursed Pact" });
        effectAnim(card, "positive");
    });
}

function drawCardForEachUndeadOnField() {
    let drawNum = countMonsterTypeOnField("Undead");
    drawCards(drawNum);
}

function drawCardsIfMonsterDiedLastTurn(num) {
    if (monsterDefeatedLastTurn) drawCards(num);
}

function lookAtTop4Draw1ShuffleDeck() {
    deckView.innerHTML = "";
    let count = 0;
    for (let c = 0; c <= 3; c++) {
        if (currentDeck[c]) {
            count++;
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.dataset.num = c;
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
            cardEl.onclick = (e) => {
                if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                e.target.classList.add("selected");
            };
    
            deckView.append(cardEl);
        }
    }
    deckViewConfirmBtn.onclick = () => {
        if (count === 0) {
            deckModalContainer.style.display = "none";
            setTimeout(shuffleDeck, 500);
            return;
        }
        let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
        let selectedCard = currentDeck[selectedCardNum];
        currentDeck.splice(selectedCardNum, 1);
        console.log("chose", selectedCard);
        currentHand.push(selectedCard);
        addCardToHand(selectedCard);
        var drawSound = new Audio('../assets/draw.mp3');
        drawSound.volume = 0.8;
        drawSound.play();
        deckModalContainer.style.display = "none";

        setTimeout(shuffleDeck, 250);
    };   
    if (count === 0) { deckView.innerHTML = "There are no applicable cards from your deck."; }
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
    let count = 0;
    for (let c = currentDeck.length - 3; c < currentDeck.length; c++) {
        if (currentDeck[c]) {
            count++;
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.dataset.num = c;
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
            cardEl.onclick = (e) => {
                if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                e.target.classList.add("selected");
            };
            deckView.append(cardEl);
        }
    }
    deckViewConfirmBtn.onclick = () => {
        let bottomCards;
        let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
        if (count === 0) {
            deckModalContainer.style.display = "none";
            setTimeout(shuffleDeck, 500);
            return;
        }
        else if (count === 1 ) {
            let chosenCard = currentDeck[0];
            currentHand.push(chosenCard);
            addCardToHand(chosenCard);
            currentDeck.splice(0, 1);
            deckModalContainer.style.display = "none";
            var drawSound = new Audio('../assets/draw.mp3');
            drawSound.volume = 0.8;
            drawSound.play();
            return;
        } else if (count === 2) {
            bottomCards = currentDeck.splice(currentDeck.length - 2, 2);;
        } else if (count === 3) {
            bottomCards = currentDeck.splice(currentDeck.length - 3, 3);
        }
        var drawSound = new Audio('../assets/draw.mp3');
        drawSound.volume = 0.8;
        drawSound.play();
        let chosenCard = bottomCards[selectedCardNum];
        console.log("chose", chosenCard);
        currentHand.push(chosenCard);
        addCardToHand(chosenCard);
        document.querySelector("#deckView .card.selected").remove();
        console.log(bottomCards, chosenCard);
        for (l in bottomCards) {
            if (bottomCards[l].name === chosenCard.name) {
                bottomCards.splice(l, 1);
            }
        }
        
        let otherCardEls = document.querySelectorAll("#deckView .card");
        for (let e in otherCardEls) {
            if (!otherCardEls[e].tagName) break;
            otherCardEls[e].dataset.num = e;
            otherCardEls[e].onclick = (ev) => {
                if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                ev.target.classList.add("selected");
            }
        }
        deckViewConfirmBtn.onclick = () => {
            let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
            let cardOnTop = bottomCards[selectedCardNum];
            if (count === 2) {
                console.log(cardOnTop);
                currentDeck = [];
                currentDeck.push(cardOnTop);
            } else {
                currentDeck.unshift(bottomCards.filter(item => item !== cardOnTop)[0]);
                currentDeck.unshift(cardOnTop);
            }
            deckModalContainer.style.display = "none";
        }
        deckViewTitle.innerHTML = "These cards will go on top of your deck. Choose one to put on the very top";
    };
    if (count === 0) { deckView.innerHTML = "There are no applicable cards from your deck."; }
    deckViewTitle.innerHTML = "Choose a card to put into your hand";
    deckModalContainer.style.display = "flex";
}

function drawCardForEachSpellInHand() {
    let drawNum = countCardTypeInHand("Spell");
    drawCards(drawNum);
}

function shuffleHandIntoDeckDrawSameAmount() {
    let drawAmount = currentHand.length + 1;
    shuffleHandIntoDeck(() => { drawCards(drawAmount); });
}

function twoChoicesOrbOfDragonkind() {
    displayChoices([
        {
            "text": "Choose one of your Dragon monsters on the field. That monster gains an extra action during this turn.",
            "function": () => {
                if (checkForMonsterTypeOnField("Dragon")) {
                    monsterSelectRestrictions = ["Aberration", "Beast", "Construct", "Elemental", "Fey", "Humanoid", "Monstrosity", "Ooze", "Plant", "Undead"];
                    selectMonster((card) => {
                        addEffectToMonster(card, { effect: "Can use 2 actions this turn.", type: "positive", source: "Orb of Dragonkind" });
                        effectAnim(card, "positive");
                    });
                } else {
                    choiceModalContainer.style.display = "flex";
                    alert("You must have a Dragon monster on the field to choose this option.");
                    return;
                }
            }
        },
        {
            "text": "Search your deck for a Dragon monster card and add it to your hand. Shuffle your deck afterward.",
            "function": () => {
                deckView.innerHTML = "";
                let count = 0;
                for (let c in currentDeck) {
                    if (currentDeck[c].cardType === "Monster" && currentDeck[c].monsterType === "Dragon") {
                        count++;
                        let cardEl = document.createElement("div");
                        cardEl.classList.add("card");
                        cardEl.dataset.num = c;
                        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
                        cardEl.onclick = (e) => {
                            if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                            e.target.classList.add("selected");
                        };
                
                        deckView.append(cardEl);
                    }
                }
                deckViewConfirmBtn.onclick = () => {
                    if (count === 0) {
                        deckModalContainer.style.display = "none";
                        setTimeout(shuffleDeck, 500);
                        return;
                    }
                    let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
                    let selectedCard = currentDeck[selectedCardNum];
                    currentHand.push(selectedCard);
                    addCardToHand(selectedCard);
                    currentDeck.splice(selectedCardNum, 1);
                    deckModalContainer.style.display = "none";

                    var drawSound = new Audio('../assets/draw.mp3');
                    drawSound.volume = 0.8;
                    drawSound.play();

                    setTimeout(shuffleDeck, 500);
                };
                if (count === 0) { deckView.innerHTML = "There are no applicable cards from your deck."; }
                deckViewTitle.innerHTML = "Select a card from your deck";
                deckModalContainer.style.display = "flex";
            }
        }
    ]);
}

function discardOneThenDrawMonsterFromDiscard() {
    discardFromHand(() => {
        deckView.innerHTML = "";
        let count = 0;
        for (let c in currentDiscard) {
            if (currentDiscard[c].cardType === "Monster") {
                count++;
                let cardEl = document.createElement("div");
                cardEl.classList.add("card");
                cardEl.dataset.num = c;
                cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDiscard[c].name)}.png)`;
                cardEl.onclick = (e) => {
                    if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                    e.target.classList.add("selected");
                };

                deckView.append(cardEl);
            }
        }
        deckViewConfirmBtn.onclick = () => {
            if (count === 0) {
                deckModalContainer.style.display = "none";
                return;
            }
            let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
            let selectedCard = currentDiscard[selectedCardNum];
            addCardToHand(selectedCard);
            currentDiscard.splice(selectedCardNum, 1);
            deckModalContainer.style.display = "none";

            var drawSound = new Audio('../assets/draw.mp3');
            drawSound.volume = 0.8;
            drawSound.play();

            rerenderDiscard();
        };
        if (count === 0) { deckView.innerHTML = "There are no applicable cards from your discard pile."; }
        deckViewTitle.innerHTML = "Select a monster card from your discard pile";
        deckModalContainer.style.display = "flex";
    });
}

function selectMonsterRepairs() {
    monsterSelectRestrictions = ["Aberration", "Beast", "Dragon", "Elemental", "Fey", "Humanoid", "Monstrosity", "Ooze", "Plant", "Undead"];
    selectMonster((card) => {
        let healAmount = 0;
        for (var i = 0; i <= 2; i++) {
            healAmount += rollDiceNoAnim(8);
        }
        if (cursedBattlefield) healAmount = Math.ceil(healAmount / 2);
        healMonster(card, healAmount);
        alert("The monster was healed for " + healAmount + " HP.");
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

function reviveUndeadMonsterHalfHPIfSSR() {
    deckView.innerHTML = "";
    let count = 0;
    for (let c in currentDiscard) {
        if (currentDiscard[c].monsterType === "Undead") {
            count++;
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDiscard[c].name)}.png)`;
            cardEl.dataset.num = c;
            cardEl.onclick = (e) => {
                if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                e.target.classList.add("selected");
            };
    
            deckView.append(cardEl);
        }
    }
    deckViewConfirmBtn.onclick = () => {
        if (count === 0) {
            deckModalContainer.style.display = "none";
            return;
        }
        let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num
        let selectedCard = currentDiscard[selectedCardNum];
        console.log("chose", selectedCard);

        summonMonster(selectedCard);
        if (selectedCard.rarity === "SSR") {
            document.querySelector("#monsterZone" + (selectedCard.currentZone + 1) + " .monster-overlay-health").innerHTML = Math.ceil(Number(document.querySelector("#monsterZone" + (selectedCard.currentZone + 1) + " .monster-overlay-health").innerHTML) / 2);
        }
        rerenderDiscard();

        currentDiscard.splice(selectedCardNum, 1);
        deckModalContainer.style.display = "none";
    };
    if (count === 0) { deckView.innerHTML = "There are no applicable cards from your discard pile."; }
    deckViewTitle.innerHTML = "Select a card from your discard pile";
    deckModalContainer.style.display = "flex";
}

function searchDeckTravelingMerchant() {
    deckView.innerHTML = "";
    currentDeck = masterSort(currentDeck);
    let count = 0;
    for (let c in currentDeck) {
        if (currentDeck[c].cardType === "Utility" && (currentDeck[c].rarity === "R" || currentDeck[c].rarity === "SR")) {
            count++;
            let cardEl = document.createElement("div");
            cardEl.classList.add("card");
            cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
            cardEl.dataset.num = c;
            cardEl.onclick = (e) => {
                let selectedCard = currentDeck[c];
                let selectedCardEls = document.querySelectorAll("#deckView .card.selected");
                if (selectedCard.rarity === "SR") {
                    selectedCardEls.forEach(el => {
                        el.classList.remove("selected");
                    });
                    e.target.classList.add("selected");
                }
                if (selectedCard.rarity === "R") {
                    let rCount = 0;
                    selectedCardEls.forEach(el => {
                        if (currentDeck[el.dataset.num].rarity === "SR") {
                            el.classList.remove("selected");
                        } else if (currentDeck[el.dataset.num].rarity === "R") {
                            rCount++;
                        }
                    });
                    if (rCount <= 1) {
                        if (e.target.classList.contains("selected")) e.target.classList.remove("selected");
                        else  e.target.classList.add("selected");
                    }
                    else if (rCount >= 2) {
                        if (e.target.classList.contains("selected")) e.target.classList.remove("selected");
                        else {
                            alert("You can only select up to 2 R rarity cards.")
                            return;
                        }
                    }
                }
                console.log(currentDeck[c]);
            };
    
            deckView.append(cardEl);
        }
    }
    deckViewConfirmBtn.onclick = () => {
        if (count === 0) {
            deckModalContainer.style.display = "none";
            setTimeout(shuffleDeck, 500);
            return;
        }
        let selectedCards = document.querySelectorAll("#deckView .card.selected");
        let deckLength = currentDeck.length;
        selectedCards.forEach(el => {
            console.log(el);
            let selectedCardNum = el.dataset.num;
            if (currentDeck.length !== deckLength) {
                selectedCardNum -= 1;
            }
            let selectedCard = currentDeck[selectedCardNum];
            console.log("chose", selectedCard);
            currentHand.push(selectedCard);
            addCardToHand(selectedCard);
            console.log(currentDeck.length, deckLength);
            currentDeck.splice(selectedCardNum , 1);
            deckModalContainer.style.display = "none";
    
            if (currentDeck.length !== deckLength) {
                setTimeout(() => {
                    var drawSound = new Audio('../assets/draw.mp3');
                    drawSound.volume = 0.8;
                    drawSound.play();
                }, 250);
            } else {
                var drawSound = new Audio('../assets/draw.mp3');
                drawSound.volume = 0.8;
                drawSound.play();
            }
        });

        setTimeout(shuffleDeck, 500);
    };
    if (count === 0) { deckView.innerHTML = "There are no applicable cards from your deck."; }
    deckViewTitle.innerHTML = "Select a card(s) from your deck";
    deckModalContainer.style.display = "flex";
}

function searchDeck() {
    deckView.innerHTML = "";
    currentDeck = masterSort(currentDeck);
    let count = 0;
    for (let c in currentDeck) {
        count++;
        let cardEl = document.createElement("div");
        cardEl.classList.add("card");
        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
        cardEl.dataset.num = c;
        cardEl.onclick = (e) => {
            if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
            e.target.classList.add("selected");
        };

        deckView.append(cardEl);
    }
    deckViewConfirmBtn.onclick = () => {
        if (count === 0) {
            deckModalContainer.style.display = "none";
            setTimeout(shuffleDeck, 500);
            return;
        }
        let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
        let selectedCard = currentDeck[selectedCardNum];
        console.log("chose", selectedCard);
        currentHand.push(selectedCard);
        addCardToHand(selectedCard);
        currentDeck.splice(selectedCardNum, 1);
        deckModalContainer.style.display = "none";

        var drawSound = new Audio('../assets/draw.mp3');
        drawSound.volume = 0.8;
        drawSound.play();

        setTimeout(shuffleDeck, 500);
    };
    if (count === 0) { deckView.innerHTML = "There are no applicable cards from your deck."; }
    deckViewTitle.innerHTML = "Select a card from your deck";
    deckModalContainer.style.display = "flex";
}

function enableActionSurge() {
    actionSurge = true;
    if (!actionAvailable) {
        actionAvailable = true;
        actionLight.style.backgroundColor = "lime";
        actionSurge = false;
    }
}

function enableCursedBattlefield() {
    cursedBattlefield = true;
    for (c in currentMonsters) {
        addEffectToMonster(currentMonsters[c], { "effect": "Healing effects are halved.", "type": "negative", "source": "Cursed Battlefield" });
        addEffectToMonster(currentMonsters[c], { "effect": "Necrotic damage is doubled.", "type": "positive", "source": "Cursed Battlefield" });
        effectAnim(currentMonsters[c], "positive");
    }
}

function eyeOfTheBeholder() {
    if (hasBeholderParts()) {
        document.body.style.pointerEvents = "none";
        let beholderCards = document.querySelectorAll(".beholder-card");
        beholderCards.forEach(card => {
            card.classList.add("fusion-glow");
        });
        var fusionSound = new Audio('../assets/fusion.mp3');
        fusionSound.volume = 0.6;
        fusionSound.play();
        setTimeout(() => {
            beholderCards.forEach(card => {
                card.classList.remove("fusion-glow");
                card.classList.add("fusion-move");
            });
            setTimeout(() => {
                beholderCards.forEach(card => card.remove());
                for (c in currentHand) {
                    if (currentHand[c].name === "Eye of the Beholder" || currentHand[c].name === "Mouth of the Beholder" || currentHand[c].name === "Tentacles of the Beholder") {
                        addToDiscardPile(currentHand[c]);
                        currentHand.splice(c, 1);
                    }
                }
        
                const fullBeholder = document.createElement("img");
                fullBeholder.src = "../assets/beholder.png"; // Add the image path
                fullBeholder.classList.add("full-beholder");
                document.body.appendChild(fullBeholder);
                var beholderSound = new Audio('../assets/beholder.mp3');
                beholderSound.volume = 0.6;
                beholderSound.play();
                setTimeout(() => {
                    let totalDamage = rollMultiDice(12, 10);
                    let damageText = document.createElement("div");
                    damageText.classList.add("damage-number");
                    damageText.textContent = totalDamage;
                    document.body.appendChild(damageText);
                    var blastSound = new Audio('../assets/blast.mp3');
                    blastSound.volume = 0.6;
                    blastSound.play();
                    setTimeout(() => {
                        alert("The Beholder deals " + totalDamage + " true damage to the target!");
                        damageText.remove();
                        fullBeholder.remove();
                        document.body.style.pointerEvents = "auto";
                    }, 1500);
                }, 3500);
            }, 3000);
        }, 2000);
    }
}

function sanguineRevelation() {
    let damageTaken = prompt("How much damage will you take?");
    let cardsToDraw = Math.floor(damageTaken / 10);
    drawCards(cardsToDraw);
}

function aceUpYourSleeve() {
    displayChoices([
        {
            "text": "Look at the top 5 cards of your deck. Put 2 of them into your hand, and shuffle the remaining cards into your deck.",
            "function": () => {
                deckView.innerHTML = "";
                let count = 0;
                for (let c = 0; c <= 4; c++) {
                    if (currentDeck[c]) {
                        count++;
                        let cardEl = document.createElement("div");
                        cardEl.classList.add("card");
                        cardEl.dataset.num = c;
                        cardEl.dataset.card = JSON.stringify(currentDeck[c]);
                        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
                        cardEl.onclick = (e) => {
                            let selectedCards = document.querySelectorAll("#deckView .card.selected");
                            // console.log(selectedCards.length);
                            if (selectedCards.length >= 2 && !e.target.classList.contains("selected")) {
                                alert("You can only select up to 2 cards.");
                                return;
                            }
                            e.target.classList.toggle("selected");
                        };
            
                        deckView.append(cardEl);
                    }
                }
            
                deckViewConfirmBtn.onclick = () => {
                    let validSelectCount;
                    if (count === 0) {
                        deckModalContainer.style.display = "none";
                        setTimeout(shuffleDeck, 500);
                        return;
                    } else if (count === 1) {
                        validSelectCount = 1;
                    }
                    else if (count >= 2) {
                        validSelectCount = 2;
                    }
                    let selectedCards = document.querySelectorAll("#deckView .card.selected");
                    if (selectedCards.length !== validSelectCount) { alert("Please select " + validSelectCount + " cards."); return; }
                    for (let s in selectedCards) {
                        if (!selectedCards[s].tagName) break;
                        let selectedCard = JSON.parse(selectedCards[s].dataset.card);
                        for (d in currentDeck) {
                            if (currentDeck[d].name === selectedCard.name) {
                                currentDeck.splice(d, 1);
                                break;
                            }
                        }
                        currentHand.push(selectedCard);
                        addCardToHand(selectedCard);
                    }
                    var drawSound = new Audio('../assets/draw.mp3');
                    drawSound.volume = 0.8;
                    drawSound.play();
                    if (validSelectCount === 2) {
                        setTimeout(() => {
                            var drawSound = new Audio('../assets/draw.mp3');
                            drawSound.volume = 0.8;
                            drawSound.play();
                        }, 200);
                    }
                    deckModalContainer.style.display = "none";
                    setTimeout(shuffleDeck, 250);
                };
                if (count === 0) { deckView.innerHTML = "There are no applicable cards from your deck."; }
                deckViewTitle.innerHTML = "Choose 2 cards to put into your hand:";
                deckModalContainer.style.display = "flex";
            }
        },
        {
            "text": "When a monster on the field under your control deals damage during this turn, the attack deals an extra 6d6 damage.",
            "function": () => {
                aceUpYourSleeveDamageBoost = true;
                for (let m in currentMonsters) {
                    addEffectToMonster(currentMonsters[m], { effect: "Next attack deals an extra 6d6 damage.", type: "positive", source: "The Ace Up Your Sleeve" });
                    effectAnim(currentMonsters[m], "positive");
                }
            }
        },
        {
            "text": "Search your deck for a Monster or Spell card and put it into your hand. Shuffle your deck afterward.",
            "function": () => {
                deckView.innerHTML = "";
                let count = 0;
                currentDeck = masterSort(currentDeck);
                for (let c in currentDeck) {
                    if (currentDeck[c].cardType === "Monster" || currentDeck[c].cardType === "Spell") {
                        count++;
                        let cardEl = document.createElement("div");
                        cardEl.classList.add("card");
                        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDeck[c].name)}.png)`;
                        cardEl.dataset.num = c;
                        cardEl.onclick = (e) => {
                            if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                            e.target.classList.add("selected");
                        };
                
                        deckView.append(cardEl);
                    }
                }
                deckViewConfirmBtn.onclick = () => {
                    if (count === 0) {
                        deckModalContainer.style.display = "none";
                        setTimeout(shuffleDeck, 500);
                        return;
                    }
                    let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num
                    let selectedCard = currentDeck[selectedCardNum];
                    console.log("chose", selectedCard);
                    currentHand.push(selectedCard);
                    addCardToHand(selectedCard);
                    currentDeck.splice(selectedCardNum, 1);
                    deckModalContainer.style.display = "none";
        
                    var drawSound = new Audio('../assets/draw.mp3');
                    drawSound.volume = 0.8;
                    drawSound.play();
        
                    setTimeout(shuffleDeck, 500);
                };
                if (count === 0) { deckView.innerHTML = "There are no applicable cards from your deck."; }
                deckViewTitle.innerHTML = "Select a card from your deck";
                deckModalContainer.style.display = "flex";
            }
        }
    ]);
}

function checkForMonsterTypeOnField(monsterType) {
    for (m in currentMonsters) {
        if (currentMonsters[m].monsterType === monsterType) {
            return true;
        }
    }
    return false;
}

function wildShapeCheck() {
    let possibleRarities = {
        "R": false,
        "SR": false,
        "SSR": false
    }
    for (m in currentMonsters) {
        if (currentMonsters[m].monsterType === "Beast") {
            for (c in currentHand) {
                if (currentHand[c].cardType === "Monster" && currentHand[c].monsterType === "Beast" && currentHand[c].rarity === currentMonsters[m].rarity) {
                    possibleRarities[currentMonsters[m].rarity] = true;
                }
            }
        }
    }
    return possibleRarities;
}

function checkForMonsterTypeInHand(monsterType) {
    for (c in currentHand) {
        if (currentHand[c].monsterType === monsterType) {
            return true;
        }
    }
    return false;
}

function countMonsterTypeOnField(monsterType) {
    let count = 0;
    for (m in currentMonsters) {
        if (currentMonsters[m].monsterType === monsterType) {
            count++;
        }
    }
    return count;
}

function checkForMonsterTypeInDiscard(monsterType) {
    for (c in currentDiscard) {
        if (currentDiscard[c].monsterType === monsterType) {
            return true;
        }
    }
    return false;
}

function checkForMonsterTypeAndRarityInDiscard(monsterType, rarity) {
    for (c in currentDiscard) {
        if (currentDiscard[c].monsterType === monsterType && currentDiscard[c].rarity === rarity) {
            return true;
        }
    }
    return false;
}

function checkForCardTypeInHand(cardType) {
    for (c in currentHand) {
        if (currentHand[c].cardType === cardType) {
            return true;
        }
    }
    return false;
}

function countCardTypeInHand(cardType) {
    let count = 0;
    for (c in currentHand) {
        if (currentHand[c].cardType === cardType) {
            count++;
        }
    }
    return count;
}

function checkForCardTypeInDiscard(cardType) {
    for (c in currentDiscard) {
        if (currentDiscard[c].cardType === cardType) {
            return true;
        }
    }
    return false;
}

function hasNonConstructOrUndeadOnField() {
    for (c in currentMonsters) {
        if (currentMonsters[c].monsterType !== "Undead" && currentMonsters[c].monsterType !== "Construct") {
            return true;
        }
    }
    return false;
}

function hasBeholderParts() {
    let mouthInHand = false;
    let tentaclesInHand = false;
    for (c in currentHand) {
        if (currentHand[c].name === "Tentacles of the Beholder") tentaclesInHand = true;
        if (currentHand[c].name === "Mouth of the Beholder") mouthInHand = true;
    }
    if (mouthInHand && tentaclesInHand) return true;
    else return false;
}

function effectAnim(card, type) {
    let cardEl = document.getElementById("monsterZone" + (card.currentZone + 1));
    if (type === "positive") {
        cardEl.classList.add("buff-animation");
    } else if (type === "negative") {
        cardEl.classList.add("debuff-animation");
    }

    setTimeout(() => {
        cardEl.classList.remove("buff-animation", "debuff-animation");
    }, 1000);
}