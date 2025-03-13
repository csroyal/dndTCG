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

    cardDiv.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        displayCardPopup(card);
    });
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

        // Cultist - Dark Devotion Passive
        if (card.name === "Cultist") {
            addEffectToMonster(card, { effect: "Has advantage on saving throws against being charmed or frightened.", type: "positive", source: "Dark Devotion" } );
        }

        // Flame Skull - Magic Resistance Passive
        if (card.name === "Flame Skull") {
            addEffectToMonster(card, { effect: "Has advantage on saving throws against spells and other magical effects.", type: "positive", source: "Magic Resistance" } );
        }

        // Gas Spore - Deceptive Appearance Passive
        if (card.name === "Gas Spore") {
            addEffectToMonster(card, { effect: "When targeted by an enemy for the first time, they must make a DC 11 INT saving throw or waste their action.", type: "positive", source: "Deceptive Appearance" } );
        }

        // Giant Bat - Echolocation and Flyby Passives
        if (card.name === "Giant Bat") {
            addEffectToMonster(card, { effect: "Can not be surprised and has advantage on Perception checks relying on hearing.", type: "positive", source: "Echolocation" } );
            addEffectToMonster(card, { effect: "Does not provoke opportunity attacks when flying.", type: "positive", source: "Flyby" } );
        }

        // Goblin - Pack Tactics Passive
        if (card.name === "Goblin") {
            addEffectToMonster(card, { effect: "Has advantage on attack rolls if a non-incapacitated ally is within 5 feet.", type: "positive", source: "Pack Tactics" } );
        }

        // Ghoul - Unholy Hunger Passive
        if (card.name === "Ghoul") {
            addEffectToMonster(card, { effect: "Has advantage on attack rolls against creatures missing HP.", type: "positive", source: "Unholy Hunger" } );
        }

        // Pixie - Innate Magic Passive
        if (card.name === "Pixie") {
            displayChoices([
                {
                    "text": "This monster casts Minor Invisibility on itself and cannot be targeted until it attacks or uses an ability.",
                    "function": () => {
                        addEffectToMonster(card, { effect: "This monster is invisible and cannot be targeted until it attacks or uses an ability.", type: "positive", source: "Innate Magic" } );
                    }
                },
                {
                    "text": "A target within 30 feet must make a DC 11 WIS saving throw or be charmed until the start of your next turn.",
                    "function": () => {
                        alert("A target within 30 feet must make a DC 11 WIS saving throw or be charmed until the start of your next turn.");
                    }
                }
            ]);
        }

        // Rust Monster - Corroding Touch and Iron Hunger Passives
        if (card.name === "Rust Monster") {
            addEffectToMonster(card, { effect: "Attacked targets must make a DC 12 CON saving throw or have AC reduced by 1 or weapon deals -1 damage.", type: "positive", source: "Corroding Touch" } );
            addEffectToMonster(card, { effect: "Gains +3 AC if applies a -3 penalty through Corroding Touch.", type: "positive", source: "Iron Hunger" } );
        }

        // Shadow - Shadow Stealth and Sunlight Weakness Passives
        if (card.name === "Shadow") {
            addEffectToMonster(card, { effect: "Can Hide as a bonus action in dim light or darkness.", type: "positive", source: "Shadow Stealth" } );
            addEffectToMonster(card, { effect: "Has disadvantage on attack rolls, ability checks, and saving throws while in sun.", type: "negative", source: "Sunlight Weakness" } );
        }

        // Skeleton - Hollow Resilience Passive
        if (card.name === "Skeleton") {
            addEffectToMonster(card, { effect: "Takes half damage from piercing damage.", type: "positive", source: "Hollow Resilience" } );
            addEffectToMonster(card, { effect: "Takes double damage from bludgeoning damage.", type: "negative", source: "Hollow Resilience" } );
        }

        // Swarm of Insects - Swarm Tactics Passive
        if (card.name === "Swarm of Insects") {
            addEffectToMonster(card, { effect: "Can occupy another creature's space and vice versa.", type: "positive", source: "Swarm Tactics" } );
            addEffectToMonster(card, { effect: "Can't regain HP or gain temporary HP.", type: "negative", source: "Swarm Tactics" } );
        }

        // Tridrone - Multi-tasking Strike Passive
        if (card.name === "Tridrone") {
            addEffectToMonster(card, { effect: "Can attack up to 3 different targets per turn.", type: "positive", source: "Multi-tasking Strike" } );
        }
        
        // Tridrone - Modron Coordination Passive
        let tridroneCount = 0;
        for (let c in currentMonsters) {
            if (currentMonsters[c].name === "Tridrone") {
                tridroneCount++;
            }
        }
        if (tridroneCount > 1) {
            for (let c in currentMonsters) {
                if (currentMonsters[c].name === "Tridrone") {
                    for (e in currentMonsters[c].effects) {
                        let currentEffect = currentMonsters[c].effects[e];
                        // Remove Primal Guidance
                        if (currentEffect.source === "Modron Coordination") {
                            currentMonsters[c].effects.splice(e, 1);
                            break;
                        }
                    }
                    addEffectToMonster(card, { effect: "This monster gains +" + tridroneCount + " AC." , type: "positive", source: "Modron Coordination" });
                }
            }
        }

        // Wolf - Pack Tactics Passive
        if (card.name === "Wolf") {
            addEffectToMonster(card, { effect: "Has advantage on attack rolls if a non-incapacitated ally is within 5 feet.", type: "positive", source: "Pack Tactics" } );
        }

        // Animated Armor - Living Armor and Sentinel Defense Passives
        if (card.name === "Animated Armor") {
            addEffectToMonster(card, { effect: "Has resistance to non-magical attacks.", type: "positive", source: "Living Armor" } );
            addEffectToMonster(card, { effect: "Has advantage on saving throws against being charmed or frightened.", type: "positive", source: "Living Armor" } );
            addEffectToMonster(card, { effect: "When an enemy moves within 5 feet of this monster, it must make a DC 13 STR saving throw or have its movement reduced to 0 until the end of the turn.", type: "positive", source: "Sentinel Defense" } );
        }

        // Banshee - Incorporeal Movement Passive
        if (card.name === "Banshee") {
            addEffectToMonster(card, { effect: "Can move through other creatures and objects as if they were difficult terrain. Takes 1d10 force damage if ending its turn in an object.", type: "positive", source: "Incorporeal Movement" } );
        }

        // Chuul - Amphibious Passive
        if (card.name === "Chuul") {
            addEffectToMonster(card, { effect: "Can breathe air and water.", type: "positive", source: "Amphibious" } );
        }

        // Fire Elemental - Water Susceptibility Passive
        if (card.name === "Fire Elemental") {
            addEffectToMonster(card, { effect: "Takes 1 cold damage for every 5 feet it movesw in water/every gallon of water splashed on it.", type: "negative", source: "Water Susceptibility" } );
        }

        // Gelatinous Cube - Ooze Cube Passive
        if (card.name === "Gelatinous Cube") {
            addEffectToMonster(card, { effect: "Other creatures that enter its space are subjected to Engulf with disadvantage on the saving throw.", type: "positive", source: "Ooze Cube" } );
        }

        // Giant Eagle - Keen Sight Passive
        if (card.name === "Giant Eagle") {
            addEffectToMonster(card, { effect: "Has advantage on Perception checks that rely on sight.", type: "positive", source: "Keen Sight" } );
        }

        // Grick - Stone Camouflage Passive
        if (card.name === "Grick") {
            addEffectToMonster(card, { effect: "Has advantage on Stealth checks when hiding in rocky terrain.", type: "positive", source: "Stone Camouflage" } );
        }
        
        // Lizardfolk Shaman - Tribal Wisdom Passive
        for (let c in currentMonsters) {
            if (currentMonsters[c].name === "Lizardfolk Shaman" && currentMonsters[c].currentZone !== card.currentZone) {
                if (card.monsterType === "Beast" || card.monsterType === "Humanoid") {
                    if (confirm("Activate Lizardfolk Shaman's Tribal Wisdom to draw a card?")) {
                        drawCard();
                    }
                }
            }
        }

        // Merrow - Amphibious and Aquatic Hunter Passives
        if (card.name === "Merrow") {
            addEffectToMonster(card, { effect: "Can breathe air and water.", type: "positive", source: "Amphibious" } );
            addEffectToMonster(card, { effect: "It and alles within 10 feet gain advantage on attack rolls while in water.", type: "positive", source: "Aquatic Hunter" } );
        }

        // Minotaur - Labyrinthine Fury Passive
        if (card.name === "Minotaur") {
            addEffectToMonster(card, { effect: "Has advantage on attack rolls against creatures within 10 feet of a wall or obstacle.", type: "positive", source: "Labyrinthine Fury" } );
        }

        // Mummy - Dreadful Presence Passive
        if (card.name === "Mummy") {
            addEffectToMonster(card, { effect: "Enemies within 10 feet have disadvantage on saving throws against being frightened.", type: "positive", source: "Dreadful Presence" } );
        }

        // Myconid Sovereign - Spore Leader Passive
        if (card.name === "Myconid Sovereign") {
            for (let c in currentMonsters) {
                if (card.monsterType === "Plant") {
                    addEffectToMonster(card, { effect: "This monster gains +1 AC and heals 1d4 HP at the start of your turn." , type: "positive", source: "Spore Leader" });
                }
            }
        } else {
            for (let c in currentMonsters) {
                if (currentMonsters[c].name === "Myconid Sovereign" && card.monsterType === "Plant") {
                    addEffectToMonster(card, { effect: "This monster gains +1 AC and heals 1d4 HP at the start of your turn." , type: "positive", source: "Spore Leader" });
                }
            }
        }

        // Owlbear - Keen Sight and Smell Passive
        if (card.name === "Owlbear") {
            addEffectToMonster(card, { effect: "Has advantage on Perception checks that rely on sight and smell.", type: "positive", source: "Keen Sight and Smell" } );
        }

        // Phase Spider - Ethereal Jaunt, Spider Climb, and Web Walker Passives
        if (card.name === "Phase Spider") {
            addEffectToMonster(card, { effect: "Can shift into the Etheral Plane as a bonus action.", type: "positive", source: "Ethereal Jaunt" } );
            addEffectToMonster(card, { effect: "Can climb difficult surfaces without needing to make an ability check.", type: "positive", source: "Spider Climb" } );
            addEffectToMonster(card, { effect: "Ignores movement restrictions caused by webs.", type: "positive", source: "Web Walker" } );
        }

        // Vortex Serpent - Coiled in the Void Passive
        if (card.name === "Winter Wolf") {
            addEffectToMonster(card, { effect: "Can move through obstacles and cannot be grappled or restrained.", type: "positive", source: "Coiled in the Void" } );
        }

        // Winter Wolf - Pack Tactics and Snow Camouflage Passives
        if (card.name === "Winter Wolf") {
            addEffectToMonster(card, { effect: "Has advantage on attack rolls if a non-incapacitated ally is within 5 feet.", type: "positive", source: "Pack Tactics" } );
            addEffectToMonster(card, { effect: "Has advantage on Stealth checks when hiding in snowy terrain.", type: "positive", source: "Snow Camouflage" } );
        }

        // Adult Black Dragon - Amphibious Passive
        if (card.name === "Adult Black Dragon") {
            addEffectToMonster(card, { effect: "Can breathe air and water.", type: "positive", source: "Amphibious" } );
        }

        // Archmage - Preparations and Magic Resistance Passives
        if (card.name === "Archmage") {
            addEffectToMonster(card, { effect: "Mage Armor - This monster's AC is 13 + its DEX modifier." , type: "positive", source: "Preparations" });
            addEffectToMonster(card, { effect: "Stoneskin - This monster has resistance to slashing, piercing, and bludgeoning damage." , type: "positive", source: "Preparations" });
            addEffectToMonster(card, { effect: "Mind Blank - This monster is immune to psychic damage, the charmed condition, and any effects that sense its emotions or thoughts." , type: "positive", source: "Preparations" });
            addEffectToMonster(card, { effect: "Has advantage on saving throws against spells and other magical effects." , type: "positive", source: "Magic Resistance" });
        }

        // Iron Golem - Fire Absorbption and Immutable Form Passives
        if (card.name === "Iron Golem") {
            addEffectToMonster(card, { effect: "Takes no fire damage and heals the damage dealt.", type: "positive", source: "Fire Absorption" } );
            addEffectToMonster(card, { effect: "Immune to all conditions except blinded, deafened, and paralyzed.", type: "positive", source: "Immutable Form" } );
        }

        // Lich - Turn Resistance Passive
        if (card.name === "Lich") {
            addEffectToMonster(card, { effect: "Has advantage on saving throws against turn undead effects.", type: "positive", source: "Turn Resistance" } );
        }

        // Mind Flayer - Magic Resistance Passive
        if (card.name === "Mind Flayer") {
            addEffectToMonster(card, { effect: "Has advantage on saving throws against spells and other magical effects." , type: "positive", source: "Magic Resistance" });
        }

        // Roc - Keen Sight Passive
        if (card.name === "Roc") {
            addEffectToMonster(card, { effect: "Has advantage on Perception checks that rely on sight.", type: "positive", source: "Keen Sight" } );
        }

        // Stone Golem - Immutable Form Passive
        if (card.name === "Stone Golem") {
            addEffectToMonster(card, { effect: "Immune to being charmed, paralyzed, and petrified, and has advantage on saving throws against spells and other magical effects.", type: "positive", source: "Immutable Form" } );
        }

        // Treant - Siege Monster and Rooted Resilience Passives
        if (card.name === "Treant") {
            addEffectToMonster(card, { effect: "Deals double damage to objects and structures.", type: "positive", source: "Siege Monster" } );
            addEffectToMonster(card, { effect: "Gains +2 AC until its next turn if it does not move.", type: "positive", source: "Rooted Resilience" } );
        }
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
            let choices = Object.entries(monsterActions[card.name]).map(([name, data]) => ({
                name,
                ...data
            }));
            console.log(choices);
            displayActions(card, choices);
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
    effects.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        let effect = prompt("Add effect to monster:");
        let type = prompt("Effect type (positive/negative):");
        let obj = { effect: effect, type: type, source: "Custom" };
        addEffectToMonster(card, obj);
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

            // Swarm of Insects - Swarm Tactics Passive
            if (card.name === "Swarm of Insects" && Number(health.innerHTML) <= card.hp / 2) {
                addEffectToMonster(card, { effect: "This monsters attacks deal half damage." , type: "negative", source: "Pack Tactics"});
            }

            // Owlbear - Monstrous Frenzy Passive
            if (card.name === "Owlbear" && Number(health.innerHTML) <= card.hp / 2) {
                addEffectToMonster(card, { effect: "This monster gains advantage on attack rolls until the end of your next turn." , type: "positive", source: "Monstrous Frenzy", removeTurn: turnNum + 1 });
            }
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

        // Gas Spore - Explosive Demise Passive
        if (card.name === "Gas Spore") {
            if(confirm("The Gas Spore explodes. All creatures within 10 feet must make a DC 12 CON saving throw or take 3d6 poison damage and be poisoned until the end of their next turn. On a success, they take half damage. Deal damage?")) {
                let dmg = rollMultiDice(3, 6);
                alert(`Gas Spore's Acid Spray deals ${dmg} poison damage and poisons against failed saves, and ${Math.floor(dmg / 2)} poison damage against successful saves!`);
            }
        }

        // Mud Mephit - Death Burst Passive
        if (card.name === "Mud Mephit") {
            alert("The Mud Mephit explodes in a burst of sticky mud. Each Medium or smaller creature within 5 feet of it must succeed on a DC 11 DEX saving throw or be restrained until the end of the creature's next turn.");
        }

        // Smoke Mephit - Death Burst Passive
        if (card.name === "Smoke Mephit") {
            alert("The Smoke Mephit leaves behind a cloud of smoke that fills a 5-foot-radius sphere centered on its space. The sphere is heavily obscured. Wind disperses the cloud, which otherwise lasts for 1 minute.");
        }

        // Remove Myconid Sovereign's Spore Leader Passive
        if (card.name === "Myconid Sovereign") {
            let sporeLeaderStillActive = false;
            for (let c in currentMonsters) {
                if (currentMonsters[c].name === "Myconid Sovereign") {
                    sporeLeaderStillActive = true;
                    break;
                }
            }

            if (!sporeLeaderStillActive){
                for (let c in currentMonsters) {
                    for (let e in currentMonsters[c].effects) {
                        if (currentMonsters[c].effects[e].source === "Spore Leader") {
                            currentMonsters[c].effects.splice(e, 1);
                        }
                    }
                }
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
        if (!reactionAvailable) { alert("You have already used your reaction for this turn."); return; }
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
        console.log("Rolled", randomRoll);
        
        setTimeout(() => {
            diceContainer.style.visibility = "hidden";
            dice.textContent = "🎲";
        }, 2000);
    }, 1000);
    return randomRoll;
}

function rollDiceNoAnim(sides) {
    let roll = Math.floor(Math.random() * sides) + 1;
    console.log("Rolled", roll);
    return roll;
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
                // Tridrone - Modron Coordination Passive
                let tridroneCount = 0;
                for (let c in currentMonsters) {
                    if (currentMonsters[c].name === "Tridrone") {
                        tridroneCount++;
                    }
                }
                if (tridroneCount > 1) {
                    for (let c in currentMonsters) {
                        if (currentMonsters[c].name === "Tridrone") {
                            for (e in currentMonsters[c].effects) {
                                let currentEffect = currentMonsters[c].effects[e];
                                // Remove Primal Guidance
                                if (currentEffect.source === "Modron Coordination") {
                                    currentMonsters[c].effects.splice(e, 1);
                                    break;
                                }
                            }
                            addEffectToMonster(card, { effect: "This monster gains +" + tridroneCount + " AC." , type: "positive", source: "Modron Coordination" });
                        }
                    }
                }
                // Remove Lizardfolk Shaman's Primal Guidance
                if (currentEffect.source === "Primal Guidance") {
                    currentMonsters[c].effects.splice(e, 1);
                }
                // Heal 1d4 from Myconid Sovereign's Spore Leader
                if (currentEffect.source === "Spore Leader") {
                    let dmg = rollDiceNoAnim(4);
                    healMonster(currentMonsters[c], dmg);
                }
                // Return to discard after Myconid Sovereign's Animating Spores
                if (currentEffect.source === "Animating Spores" && turnNum === currentEffect.removeTurn) {
                    currentMonsters[c].effects.splice(e, 1);
                    killMonster(currentMonsters[c]);
                }
                // Remove Owlbear's Monstrous Frenzy
                if (currentEffect.source === "Monstrous Frenzy" && turnNum === currentEffect.removeTurn) {
                    currentMonsters[c].effects.splice(e, 1);
                }
                // Remove Treant's Ancient Guardian
                if (currentEffect.source === "Ancient Guardian") {
                    currentMonsters[c].effects.splice(e, 1);
                }
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