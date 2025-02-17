let deckSelectModalContainer = document.getElementById("deckSelectModalContainer");
let deckSelect = document.getElementById("deckSelect");
let deckSelectConfirmBtn = document.getElementById("deckSelectConfirmBtn");
let goToDeckBuilderBtn = document.getElementById("goToDeckBuilderBtn");
let discardPile = document.getElementById("discardPile");
let deckPile = document.getElementById("deckPile");
let deckCards = document.querySelectorAll(".deck-card");
let hand = document.getElementById("hand");
let cardPopupModal = document.getElementById("cardPopupModal");
let cardPopupImage = document.getElementById("cardPopupImage");
let cardPopupDescription = document.getElementById("cardPopupDescription");
let endTurnBtn = document.getElementById("endTurnBtn");
let actionLight = document.getElementById("actionLight");
let bonusActionLight = document.getElementById("bonusActionLight");
let reactionLight = document.getElementById("reactionLight");
let discardPileModalContainer = document.getElementById("discardPileModalContainer");
let discardPileView = document.getElementById("discardPileView");
let deckModalContainer = document.getElementById("deckModalContainer");
let deckViewTitle = document.getElementById("deckViewTitle");
let deckView = document.getElementById("deckView");
let deckViewConfirmBtn = document.getElementById("deckViewConfirmBtn");
let handViewModalContainer = document.getElementById("handViewModalContainer");
let handViewTitle = document.getElementById("handViewTitle");
let handView = document.getElementById("handView");
let handViewConfirmBtn = document.getElementById("handViewConfirmBtn");
let choiceModalContainer = document.getElementById("choiceModalContainer");
let choicesEl = document.getElementById("choices");

let user_decks = JSON.parse(localStorage.getItem("DNDTCG_USER_DECKS"));
let currentDeck;
let currentDiscard = [];
let currentHand = [];
let currentMonsters = [];
let currentReactions = [];
let actionAvailable = true, bonusActionAvailable = true, reactionAvailable = true;
let turnNum = 1;
let monsterDefeatedThisTurn = false, monsterDefeatedLastTurn = false;

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
        shuffleDeck();
        setTimeout(() => {
            drawCards(5);
        }, 1900);
    }
});

function shuffleDeck() {
    currentDeck.sort(() => Math.random() - 0.5);
    // console.log("shuffled deck", currentDeck);
    var shuffleSound = new Audio('../assets/shuffle.mp3');
    shuffleSound.volume = 0.8;
    setTimeout(() => {
        shuffleSound.play();
    }, 150)
    deckCards.forEach((card) => {
        // console.log(card);
        const delay = Math.random() * 0.5;
        card.style.animation = "shuffle 1.4s forwards " + delay + "s";

        setTimeout(() => {
            card.style.animation = "";
        }, 2000);
    })
}

function drawCards(num) {
    for (var i = 0; i <= num - 1; i++) {
        setTimeout(drawCard, 300 * i);
    }
}

function drawCard() {
    if (!currentDeck[0]) {
        console.log("no more cards to draw");
    } else {
        let drawnCard = currentDeck[0]
        currentHand.push(drawnCard);
        currentDeck.splice(0, 1);
        // console.log(currentHand);
        var drawSound = new Audio('../assets/draw.mp3');
        drawSound.volume = 0.8;
        drawSound.play();
        const cardClone = document.querySelector(".deck-card").cloneNode(true);
        deckPile.append(cardClone);
        cardClone.style.animation = 'drawCard 1s forwards';
        setTimeout(() => {
            cardClone.remove();
            addCardToHand(drawnCard);
        }, 350);
    }
}

function addCardToHand(card) {
    let newCardInHand = document.createElement("div");
    newCardInHand.classList.add("card");
    newCardInHand.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    if (card.name === "Eye of the Beholder" || card.name === "Tentacles of the Beholder" || card.name === "Mouth of the Beholder") {
        newCardInHand.classList.add("beholder-card");
    }
    newCardInHand.addEventListener('click', function(e) {
        // console.log(card);
        playCard(card, e.target);
    });
    newCardInHand.addEventListener('contextmenu', function(event) {
        event.preventDefault();
        console.log("show", card);
        displayCardPopup(card);
    });

    hand.append(newCardInHand);
}

function displayCardPopup(card) {
    cardPopupModal.style.display = "flex";
    cardPopupImage.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    cardPopupDescription.innerHTML = card.description;

    if (card.cardType !== "Utility") {
        let cardPopupImageFacingFront = true;
        cardPopupImage.onclick = () => {
            var flipSound = new Audio('../assets/flip.mp3');
            flipSound.volume = 0.8;
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
}

function rerenderHand() {
    hand.innerHTML = "";
    for (c in currentHand) { addCardToHand(currentHand[c]); }
}

function playCard(card, cardEl) {
    if (card.cardType === "Monster") {
        if (currentMonsters.length < 3) {
            if (actionAvailable) {
                playCardAnimation(cardEl);
                let indexToRemove = currentHand.findIndex(c => c.name === card.name);
                if (indexToRemove !== -1) { currentHand.splice(indexToRemove, 1); }
                disableAction();
                setTimeout(() => {
                    summonMonster(card);
                }, 1200);
            } else {
                alert("You have already used your action for the turn.");
            }
        } else {
            alert("You already have the maximum amount of monsters in play.");
        }
    } else if (card.cardType === "Spell") {
        if (card.actionCost === "Action") {
            if (actionAvailable) {
                playCardAnimation(cardEl);
                let indexToRemove = currentHand.findIndex(c => c.name === card.name);
                if (indexToRemove !== -1) { currentHand.splice(indexToRemove, 1); }
                disableAction();
                setTimeout(() => {
                    resolveEffect(card);
                    addToDiscardPile(card);
                }, 1200);
            } else {
                alert("You have already used your action for the turn.");
            }
        } else if (card.actionCost === "Bonus Action") {
            if (bonusActionAvailable) {
                playCardAnimation(cardEl);
                let indexToRemove = currentHand.findIndex(c => c.name === card.name);
                if (indexToRemove !== -1) { currentHand.splice(indexToRemove, 1); }
                disableBonusAction();
                setTimeout(() => {
                    resolveEffect(card);
                    addToDiscardPile(card);
                }, 1200);
            } else {
                alert("You have already used your bonus action for the turn.");
            }
        }
    } else if (card.cardType === "Reaction") {
        if (currentReactions.length < 3) {
            playCardAnimation(cardEl);
            let indexToRemove = currentHand.findIndex(c => c.name === card.name);
            if (indexToRemove !== -1) { currentHand.splice(indexToRemove, 1); }
            setTimeout(() => {
                let availableReactionZone = document.querySelector('.reaction-zone:not(.occupied)');
                availableReactionZone.classList.add("occupied");
                availableReactionZone.innerHTML = "";
                availableReactionZone.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
                card.currentZone = Number(availableReactionZone.id.slice(-1) - 1,);
                currentReactions.push(card);
                addReactionOverlay(card, availableReactionZone);
            }, 1200);
        } else {
            alert("You already have the maximum amount of reactions in play.");
        }
    } else if (card.cardType === "Utility") {
        if (card.actionCost === "Action") {
            if (actionAvailable) {
                // specific use cases
                if (card.name === "Reanimate" && currentHand.length === 1) {
                    alert("You must have another card in your hand to play this card.");
                    return;
                }
                else if (card.name === "Reanimate" && !checkForCardTypeInDiscard("Monster")) {
                    alert("There are no target cards in your discard pile.");
                    return;
                }
                if (card.name === "Repairs" && !checkForMonsterTypeOnField("Construct")) {
                    alert("You must have a targetable monster on the field to play this card.");
                    return;
                }
                if (card.name === "Summon Greater Undead" && !checkForMonsterTypeInDiscard("Undead")) {
                    if (currentMonsters.length >= 3) {
                        alert("You must have an available monster zone to play this card.");
                        return;
                    }
                    alert("You must have a targetable monster in the discard pile to play this card.");
                    return;
                }
                if (card.name === "Eye of the Beholder") {
                    if (hasBeholderParts()) {
                        disableAction();
                        resolveEffect(card);
                        return;
                    }
                }

                playCardAnimation(cardEl);
                let indexToRemove = currentHand.findIndex(c => c.name === card.name);
                if (indexToRemove !== -1) { currentHand.splice(indexToRemove, 1); }
                disableAction();
                setTimeout(() => {
                    resolveEffect(card);
                    addToDiscardPile(card);
                }, 1200);
            } else {
                alert("You have already used your action for the turn.");
            }
        } else if (card.actionCost === "Bonus Action") {
            if (bonusActionAvailable) {
                // specific use cases
                if (card.name === "Arcane Recharge" && !checkForCardTypeInDiscard("Spell")) {
                    alert("There are no target cards in your discard pile.");
                    return;
                }
                if (card.name === "Call of the Beast" && !checkForMonsterTypeOnField("Beast")) {
                    alert("The conditions to play this card have not been met.");
                    return;
                }
                if (card.name === "Law of Equivalent Exchange" && currentHand.length === 1) {
                    alert("You must have another card in your hand to play this card.");
                    return;
                }
                if (card.name === "Monster Sacrifice" && !checkForCardTypeInHand("Monster")) {
                    alert("The conditions to play this card have not been met.");
                    return;
                }
                if (card.name === "Odd Medicine") {
                    if (currentMonsters.length === 0) {
                        alert("You must have a targetable monster on the field to play this card.");
                        return;
                    }
                    else if (!hasNonConstructOrUndeadOnField()) {
                        alert("You must have a targetable monster on the field to play this card.");
                        return;
                    }
                }
                if (card.name === "Wild Shape") {
                    console.log(checkForMonsterTypeOnField("Beast"), checkForMonsterTypeInHand("Beast"));
                    if (currentMonsters.length === 0) {
                        alert("You must have a targetable monster on the field to play this card.");
                        return;
                    }
                    if (!checkForMonsterTypeOnField("Beast") && !checkForMonsterTypeInHand("Beast")) {
                        alert("The conditions to play this card have not been met.");
                        return;
                    }
                    let rarities = wildShapeCheck();
                    let wildShapeCheckPass = false;
                    for (r in rarities) {
                        console.log(rarities[r]);
                        if (rarities[r]) {
                            wildShapeCheckPass = true;
                        }
                    }
                    if (!wildShapeCheckPass) {
                        alert("The conditions to play this card have not been met.");
                        return;
                    }
                }
                if (card.name === "Cursed Pact") {
                    if (currentMonsters.length === 0) {
                        alert("You must have a targetable monster on the field to play this card.");
                        return;
                    }
                }
                if (card.name === "Final Will & Testament" && !monsterDefeatedLastTurn) {
                    alert("The conditions to play this card have not been met.")
                    return;
                }
                if (card.name === "Mouth of the Beholder" || card.name === "Tentacles of the Beholder") {
                    alert("This card can only be activated from the effect of 'Eye of the Beholder'.")
                    return;
                }

                playCardAnimation(cardEl);
                let indexToRemove = currentHand.findIndex(c => c.name === card.name);
                if (indexToRemove !== -1) { currentHand.splice(indexToRemove, 1); }
                disableBonusAction();
                setTimeout(() => {
                    resolveEffect(card);
                    addToDiscardPile(card);
                }, 1200);
            } else {
                alert("You have already used your bonus action for the turn.");
            }
        }
    }
}

function playCardAnimation(card) {
    document.body.appendChild(card);
    document.body.style.pointerEvents = "none";

    card.classList.add('playing');

    setTimeout(() => {
        card.style.opacity = 0;
        var activateSound = new Audio('../assets/activate.mp3');
        activateSound.volume = 0.6;
        activateSound.play();
        document.body.style.pointerEvents = "all";
        setTimeout(() => {
            card.remove();
        }, 1000);
    }, 1000);
}

function addToDiscardPile(card) {
    currentDiscard.push(card);
    discardPile.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    discardPile.innerHTML = "";

    let cardDiv = document.createElement("div");
    cardDiv.classList.add("card");
    cardDiv.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    discardPileView.append(cardDiv);
}

function rerenderDiscard() {
    discardPileView.innerHTML = "";
    let currentDiscardClone = currentDiscard;
    currentDiscard = [];
    for (c in currentDiscardClone) { addToDiscardPile(currentDiscardClone[c]); }
}

function resolveEffect(card) {
    cardFunctions[card.name]();
}

function newTurn() {
    turnNum++;
    document.getElementById("turnNum").innerHTML = turnNum;
    actionAvailable = true;
    bonusActionAvailable = true;
    reactionAvailable = true;
    actionLight.style.backgroundColor = "lime";
    bonusActionLight.style.backgroundColor = "lime";
    reactionLight.style.backgroundColor = "lime";

    monsterDefeatedLastTurn = false;
    if (monsterDefeatedThisTurn) {
        monsterDefeatedThisTurn = false;
        monsterDefeatedLastTurn = true;
    }

    aceUpYourSleeveDamageBoost = false;

    handleEffects();

    let monsterActions = document.querySelectorAll(".monster-overlay-action");
    for (a in monsterActions) {
        if (!monsterActions[a].tagName) continue;
        monsterActions[a].dataset.used = "false";
        monsterActions[a].innerHTML = "⚔️";
    }

    setTimeout(drawCard, 750);
}

function disableAction() {
    if (actionSurge) {
        actionSurge = false;
        return;
    }
    actionAvailable = false;
    actionLight.style.backgroundColor = "red";
}

function disableBonusAction() {
    bonusActionAvailable = false;
    bonusActionLight.style.backgroundColor = "red";
}

function disableReaction() {
    reactionAvailable = false;
    reactionLight.style.backgroundColor = "red";
}

function summonMonster(card) {
    let availableMonsterZone = document.querySelector('.monster-zone:not(.occupied)');
    availableMonsterZone.classList.add("occupied");
    availableMonsterZone.classList.add("zone-glow");
    availableMonsterZone.innerHTML = "";
    availableMonsterZone.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(card.name)}.png)`;
    card.currentZone = Number(availableMonsterZone.id.slice(-1) - 1);
    currentMonsters.push(card);
    if (cursedBattlefield) {
        addEffectToMonster(card, { "effect": "Healing effects are halved.", "type": "negative", "source": "Cursed Battlefield" });
        addEffectToMonster(card, { "effect": "Necrotic damage is doubled.", "type": "positive", "source": "Cursed Battlefield" });
    }
    if (aceUpYourSleeveDamageBoost) {
        addEffectToMonster(card, { effect: "Next attack deals an extra 6d6 damage.", type: "positive", source: "The Ace Up Your Sleeve" });
    }
    addMonsterOverlay(card, availableMonsterZone);
    setTimeout(() => {
        availableMonsterZone.classList.remove("zone-glow");
    }, 500);
} 

function addMonsterOverlay(card, zone) {
    let overlay = document.createElement("div");
    overlay.classList.add("monster-overlay");
    overlay.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        displayCardPopup(card);
    });

    let health = document.createElement("div");
    health.classList.add("monster-overlay-health");
    health.innerHTML = card.hp;
    health.addEventListener("click", () => {
        let damage = prompt("Decrease the health of this monster by this amount. Input a negative number for healing.");
        if (damage >= 0) damageMonster(card, damage);
        else healMonster(card, damage);
    });

    let action = document.createElement("div");
    action.classList.add("monster-overlay-action");
    action.dataset.used = "true";
    action.innerHTML = "⏳";
    action.addEventListener("click", () => {
        if (action.dataset.used === "true") return;
        if (confirm("Use this monster's action?")) {
            for (e in card.effects) {
                if (card.effects[e].source === "Orb of Dragonkind") {
                    card.effects.splice(e, 1);
                    return;
                }
            }
            action.dataset.used = "true";
            action.innerHTML = "⏳";
        }
    });

    let effects = document.createElement("div");
    effects.classList.add("monster-overlay-effects");
    effects.innerHTML = "✨";
    effects.addEventListener("click", () => {
        if (!card.effects || !card.effects.length) { alert("This monster has no effects."); return; }
        let message = "";
        for (e in card.effects) {
            if (card.effects[e].type === "positive") {
                message += "✅ ";
            } else if (card.effects[e].type === "negative") {
                message += "❌ ";
            }
            message += card.effects[e].effect + "\n"
        }
        alert(message);
    });

    overlay.append(health);
    overlay.append(action);
    overlay.append(effects);

    zone.append(overlay);
}

function damageMonster(card, damage) {
    let health = document.querySelector("#monsterZone" + (card.currentZone + 1) + " .monster-overlay-health");
    health.innerHTML = Number(health.innerHTML) - damage < 0 ? 0 : Number(health.innerHTML) - damage;
    if (health.innerHTML == 0) {
        killMonster(card);
    } else {
        document.querySelector("#monsterZone" + (card.currentZone + 1)).classList.add("damage-animation");
        setTimeout(() => {
            document.querySelector("#monsterZone" + (card.currentZone + 1)).classList.remove("damage-animation");
        }, 1500);
    }
}

function healMonster(card, damage) {
    let healthOverlay = document.querySelector("#monsterZone" + (card.currentZone + 1) + " .monster-overlay-health");
    let currentHealth = Number(healthOverlay.innerHTML);
    if (damage < 0) damage = damage.slice(1);
    currentHealth += Number(damage); 
    if (currentHealth > card.hp) { currentHealth = card.hp; }
    healthOverlay.innerHTML = currentHealth;
    document.querySelector("#monsterZone" + (card.currentZone + 1)).classList.add("heal-animation");
    setTimeout(() => {
        document.querySelector("#monsterZone" + (card.currentZone + 1)).classList.remove("heal-animation");
    }, 1500);
}

function killMonster(card) {
    let zone = document.querySelector("#monsterZone" + (card.currentZone + 1));
    zone.classList.add("defeated");
    monsterDefeatedThisTurn = true;

    var deathSound = new Audio('../assets/death.mp3');
    deathSound.volume = 0.5;
    deathSound.play();

    setTimeout(() => {
        addToDiscardPile(card);
        zone.style.backgroundImage = "";
        zone.innerHTML = "Monster Zone";
        zone.classList.remove("defeated");
        zone.classList.remove("occupied");
        for (m in currentMonsters) {
            if (currentMonsters[m].currentZone === Number(zone.id.slice(-1) - 1)) {
                currentMonsters.splice(m, 1);
                break;
            }
        }
    }, 3000);
}

function addReactionOverlay(card, zone) {
    let overlay = document.createElement("div");
    overlay.classList.add("reaction-overlay");
    overlay.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        displayCardPopup(card);
    });
    overlay.addEventListener("click", () => {
        if (!reactionAvailable) { alert("You have already used your reaction for this turn."); }
        if (card.name === "Necromancer's Gravecall") {
            if (!checkForMonsterTypeAndRarityInDiscard("Undead", "R") && !checkForMonsterTypeAndRarityInDiscard("Undead", "SR")) {
                alert("You must have a targetable monster in the discard pile to play this card.");
                return;
            }
            if (currentMonsters.length === 3) {
                alert("You must have an available monster zone to play this card.");
                return;
            }
        }
        if (card.name === "Siphon Life") {
            if (currentMonsters.length === 0) {
                alert("You must have a targetable monster on the field to play this card.");
                return;
            }
        }
        if (card.name === "Phoenix Rebirth") {
            if (!checkForCardTypeInDiscard("Monster")) {
                alert("You must have a targetable monster in the discard pile to play this card.");
                return;
            }
        }
        if (confirm("Trigger this reaction?")) {
            overlay.remove();
            zone.classList.add("reaction-used");
            disableReaction();
            setTimeout(() => {
                addToDiscardPile(card);
                zone.style.backgroundImage = "";
                zone.innerHTML = "Reaction Zone";
                zone.classList.remove("occupied");
                zone.classList.remove("reaction-used");
                for (r in currentReactions) {
                    if (currentReactions[r].currentZone === Number(zone.id.slice(-1) - 1)) {
                        currentReactions.splice(r, 1);
                        break;
                    }
                }
                resolveEffect(card);
            }, 1500);
        }
    });

    zone.append(overlay);
}

function rollDice(sides) {
    let dice = document.querySelector(".dice");
    let diceContainer = document.querySelector(".dice-container");
    diceContainer.style.visibility = "visible";
    const randomRoll = Math.floor(Math.random() * sides) + 1;

    dice.style.animation = "none";
    void dice.offsetWidth;
    dice.style.animation = "rollDice 1s ease-in-out";

    var diceSound = new Audio('../assets/dice.mp3');
    diceSound.volume = 0.8;
    diceSound.play();

    setTimeout(() => {
        dice.textContent = randomRoll;
        
        setTimeout(() => {
            diceContainer.style.visibility = "hidden";
            dice.textContent = "🎲";
        }, 2000);
    }, 1000);
    return randomRoll;
}

function rollDiceNoAnim(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

function rollMultiDice(amount, sides) {
    let total = 0;
    for (var i = 0; i <= amount - 1; i++) {
        total += rollDiceNoAnim(sides);
    }
    return total;
}

function flipCoin() {
    const coin = document.createElement("div");
    coin.classList.add("coin");
    document.body.appendChild(coin);
  
    const result = Math.random() < 0.5 ? "Heads" : "Tails";

    var coinFlipSound = new Audio('../assets/coinFlip.wav');
    coinFlipSound.volume = 0.8;
    coinFlipSound.play();
  
    setTimeout(() => {
      coin.textContent = result;
      coin.style.transform = "rotateY(0deg) translateY(0)";
    }, 1500);
  
    setTimeout(() => {
      coin.remove();
    }, 2500);
    return result;
}

cardPopupModal.addEventListener("click", (e) => {
    if (e.target.id === "cardPopupModal") {
        cardPopupModal.style.display = "none";
    }
});

endTurnBtn.addEventListener("click", () => {
    // if (actionAvailable || bonusActionAvailable || reactionAvailable) {
        // if (confirm("You still have available actions to take. Are you sure you want to end your turn?")) {
            newTurn();
        // }
    // }
});

discardPile.addEventListener("click", () => {
    discardPileModalContainer.style.display = "flex";
});

deckPile.addEventListener("click", () => {
    alert(currentDeck.length + " cards left in deck.");
});

discardPileModalContainer.addEventListener("click", (e) => {
    if (e.target.id === "discardPileModalContainer") {
        discardPileModalContainer.style.display = "none";
    }
});

function handleEffects() {
    for (c in currentMonsters) {
        if (currentMonsters[c].effects) {
            for (e in currentMonsters[c].effects) {
                let currentEffect = currentMonsters[c].effects[e];
                // Deal 3d6 with Phoenix Rebirth
                if (currentEffect.source === "Phoenix Rebirth") {
                    currentMonsters[c].effects.splice(e, 1);
                    let totalDamage = rollMultiDice(3, 6);
                    alert("The explosion of the Phoenix Rebirth deals " + totalDamage + " damage to all enemies within 10 feet of " + currentMonsters[c].name);
                }
                // Remove Cunning Action
                if (currentEffect.source === "Cunning Action") {
                    currentMonsters[c].effects.splice(e, 1);
                }
                // Remove Quick Feet
                if (currentEffect.source === "Quick Feet") {
                    currentMonsters[c].effects.splice(e, 1);
                }
                // Remove Reckless Attack
                if (currentEffect.source === "Reckless Attack") {
                    currentMonsters[c].effects.splice(e, 1);
                }
                // Deal 1d6 damage to Cursed Pact
                if (currentEffect.source === "Cursed Pact" && currentEffect.type === "negative") {
                    let damage = rollDiceNoAnim(6);
                    damageMonster(currentMonsters[c], damage);
                }
                // Remove Ace Up Your Sleeve Damage Boost
                if (currentEffect.source === "The Ace Up Your Sleeve") {
                    currentMonsters[c].effects.splice(e, 1);
                }
            }
        }
    }
}