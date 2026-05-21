
let packsWrapper = document.getElementById("packsWrapper");
let packsContainer = document.getElementById("packsContainer");
let packOpeningModalContainer = document.getElementById("packOpeningModalContainer");
let packOpeningPackImage = document.getElementById("packOpeningPackImage");
let packOpeningResults = document.getElementById("packOpeningResults");
let packConfirmButton = document.getElementById("packConfirmButton");

let packOpeningRarityTable = {
    0: { "Common": 100 },
    1: { "Common": 100 },
    2: { "Common": 100 },
    3: { "Rare": 100 },
    4: { "Rare": 100 },
    5: { "Rare": 80, "Legendary": 15, "Mythic": 5 }
}

let packResults = [];

function buildPacks() {
    packsWrapper.style.display = "flex";
    packsContainer.innerHTML = '';
    packs.forEach(pack => {
        if (!pack.canBuyFromShop) return;
        // console.log(pack);

        let packEl = document.createElement("img");
        packEl.src = `./assets/pack-art/${pack.id}.png`;

        packEl.addEventListener("click", () => {
            if (confirm(`Open a ${pack.name} booster pack?`)) {
                openPack(pack.id);
            }
        });

        packsContainer.append(packEl);
    });
}

function openPack(packId) {
    packResults = [];
    let pack = getObjectById(packs, packId);
    // console.log(pack);

    packOpeningPackImage.src = `./assets/pack-art/${pack.id}.png`;
    packOpeningPackImage.classList.add("slide-in-bottom");

    setTimeout(() => {
        packOpeningPackImage.classList.remove("slide-in-bottom");
        packOpeningPackImage.classList.add("shake-horizontal");
    }, 500);

    packOpeningResults.innerHTML = '';

    packOpeningPackImage.onclick = () => {
        packOpeningPackImage.classList.remove("shake-horizontal");
        packOpeningPackImage.src = `./assets/pack-art/${pack.id}-open.png`;
        playSound("pack-open");
        packOpeningPackImage.onclick = () => {};
        packResults = generatePack(packId);
        console.log(packResults);
        for (c in packResults) {
            // console.log(getObjectById(cards, packResults[c]));

            let cardEl = document.createElement("div");
            cardEl.classList.add("flip-card");
            if (packResults[c] === "GT") {
                cardEl.innerHTML = `
                    <div class="flip-card-content" data-card-id="${packResults[c]}" data-rarity="Mythic">
                        <div class="front">
                            <img src="./assets/card-art/back.png">
                        </div>
                        <div class="back">
                            <img src="./assets/${packResults[c]}.png">
                        </div>
                    </div>
                `;
            } else {
                cardEl.innerHTML = `
                    <div class="flip-card-content" data-card-id="${packResults[c]}" data-rarity="${getObjectById(cards, packResults[c]).rarity}">
                        <div class="front">
                            <img src="./assets/card-art/back.png">
                        </div>
                        <div class="back">
                            <img src="./assets/card-art/${packResults[c]}.jpg">
                        </div>
                    </div>
                `;
            }

            packOpeningResults.append(cardEl);
            if (packResults[c] === "GT") {
                
            } else {
                if (binder[packResults[c]]) binder[packResults[c]] = binder[packResults[c]] + 1;
                else binder[packResults[c]] = 1;
            }
        }
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({
            binder: binder
        });
        packOpeningResults.onclick = (e) => {
            // console.log(packResults);
            let nextCardEl = packOpeningResults.querySelector(".flip-card .flip-card-content:not(.flipped)");
            // console.log(nextCardEl);
            nextCardEl.classList.add("flipped");
            playSound("flip");
            playSound(`pull-${nextCardEl.dataset.rarity.toLowerCase()}`)

            packResults.shift();
            if (packResults.length === 0) {
                packOpeningResults.onclick = () => {}
                setTimeout(() => {
                    packConfirmButton.classList.add("active");
                }, 1000);
            }
        }
        setTimeout(() => {
            packOpeningPackImage.classList.add("slide-out-bottom");
            packOpeningResults.classList.remove("slide-out-bottom");
            packOpeningResults.classList.add("slide-in-bottom");
        }, 1000);
    }

    packOpeningModalContainer.classList.add("active");
}

function generatePack(packId) {
    let pack = getObjectById(packs, packId);
    let results = [];

    const cardsByRarity = {};
    for (const card of cards) {
        if (!cardsByRarity[card.rarity]) {
            cardsByRarity[card.rarity] = [];
        }
        cardsByRarity[card.rarity].push(card);
    }

    function pickWeighted(weights) {
        const entries = Object.entries(weights);
        const total = entries.reduce((sum, [, w]) => sum + w, 0);
        let rand = Math.random() * total;

        for (const [key, weight] of entries) {
            if (rand < weight) return key;
            rand -= weight;
        }
    }

    const GOLDEN_TICKET_ID = "GT";

    for (let i = 0; i < Object.keys(packOpeningRarityTable).length; i++) {
        const rarityWeights = packOpeningRarityTable[i];

        const rarity = pickWeighted(rarityWeights);

        const validCards = cardsByRarity[rarity].filter(card =>
            pack.cardPool.includes(card.id)
        );

        const chosen = validCards[Math.floor(Math.random() * validCards.length)];
        const resultId = rarity === "Mythic" && Math.random() < 0.5
            ? GOLDEN_TICKET_ID
            : chosen.id;

        results.push(resultId);
    }

    return results;
}

packConfirmButton.addEventListener("click", () => {
    packOpeningModalContainer.classList.remove("active");

    packOpeningPackImage.classList.remove("slide-out-bottom");
    packOpeningPackImage.classList.remove("shake-horizontal");
    packOpeningResults.classList.remove("slide-in-bottom");
    packOpeningResults.classList.add("slide-out-bottom");
    packConfirmButton.classList.remove("active");

    buildBinder(cards, packs);
});