let binderContainer = document.getElementById("binderContainer");
let binderSearch = document.getElementById("binderSearch");

function buildBinder(cards, packs) {
    // console.log(cards, packs);

    binderContainer.innerHTML = '';
    packs.forEach(pack => {
        // console.log(pack);
        
        let packContainer = document.createElement("div");
        packContainer.classList.add("pack-container");

        let packHeader = document.createElement("div");
        packHeader.classList.add("pack-header");

        let packLogo = document.createElement("img");
        packLogo.src = "./assets/pack-art/" + pack.id + "-logo.png";
        packLogo.setAttribute("draggable", false);
        packHeader.append(packLogo);

        let packAccordion = document.createElement("div");
        packAccordion.classList.add("pack-accordion");
        packAccordion.innerHTML = `<i class="bi bi-chevron-down"></i>`;
        packAccordion.onclick = () => {
            packContainer.classList.toggle("collapse");
            if (packContainer.classList.contains("collapse")) {
                packAccordion.innerHTML = `<i class="bi bi-chevron-up"></i>`;
            } else {
                packAccordion.innerHTML = `<i class="bi bi-chevron-down"></i>`;
            }
        };
        packHeader.append(packAccordion);

        let cardsContainer = document.createElement("div");
        cardsContainer.classList.add("cards-container");

        let amountOwned = 0;

        pack.cardPool.forEach(cardID => {
            let card = getObjectById(cards, cardID);
            // console.log(card);

            cardsContainer.append(createCardEl(card, () => {
                openInCardViewModal(cardID);
            }));

            if (binder && binder[cardID] && binder[cardID] >= 1) {
                amountOwned++;
            }

        });

        let packCount = document.createElement("div");
        packCount.innerHTML = `<i class="bi bi-file-richtext"></i> <span>${amountOwned}</span> / ${pack.cardPool.length}`
        packHeader.append(packCount);

        packContainer.append(packHeader);
        packContainer.append(cardsContainer);

        binderContainer.append(packContainer);
    });
}

binderSearch.addEventListener("input", () => {
    let searchInput = binderSearch.value.toLowerCase();
    console.log(searchInput);
    let packEls = document.querySelectorAll(".pack-container");
    packEls.forEach(pack => {
        let cardEls = pack.querySelectorAll(".card");
        let numCardsShowing = 0;
        cardEls.forEach(card => {
            if (card.dataset.name.includes(searchInput) || !searchInput) {
                card.parentElement.style.display = "block";
                numCardsShowing++;
            } else {
                card.parentElement.style.display = "none";
            }
        });
        if (numCardsShowing < 1) pack.style.display = "none";
        else pack.style.display = "block";
    });
});