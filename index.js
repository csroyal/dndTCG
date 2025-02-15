let cardData;
const rarityOrder = { 'R': 1, 'SR': 2, 'SSR': 3 };
const cardTypeOrder = { 'Monster': 1, 'Spell': 2, 'Reaction': 3, 'Utility': 4 };

function cardNameToImageName(input) {
    let lowerCaseString = input.toLowerCase();
    let result = lowerCaseString
        .replace(/\s+/g, '-')
        .replace(/'/g, '')
        .replace(/\//g, '-');
    return result;
}

function sortByName(cards) {
    cards.sort((a, b) => a.name.localeCompare(b.name));
    return cards;
}

function sortByRarity(cards) {
    cards.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);
    return cards;
}

function sortByCardType(cards) {
    cards.sort((a, b) => cardTypeOrder[a.cardType] - cardTypeOrder[b.cardType]);
    return cards;
}

function sortByMonsterType(cards) {
    cards.sort((a, b) => monsterTypeOrder[a.monsterType] - monsterTypeOrder[b.monsterType]);
    return cards;
}

function masterSort(cards) {
    cards.sort((a, b) => {
        const cardTypeComparison = cardTypeOrder[a.cardType] - cardTypeOrder[b.cardType];
        if (cardTypeComparison !== 0) return cardTypeComparison;
      
        const rarityComparison = rarityOrder[a.rarity] - rarityOrder[b.rarity];
        if (rarityComparison !== 0) return rarityComparison;
      
        return a.name.localeCompare(b.name);
    });
    return cards;
}

function backToTop() {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function preloadImage(url) {
    const img = new Image();
    img.src = url;
}