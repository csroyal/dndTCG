let profileIcon = document.getElementById("profileIcon");
let profileEntry = document.getElementById("profileEntry");
let profileEntryInput = document.getElementById("profileEntryInput");
let logInButton = document.getElementById("logInButton");
let logOutButton = document.getElementById("logOutButton");
let uploadProfilePictureButton = document.getElementById("uploadProfilePictureButton");
let addBaseSetToBinderButton = document.getElementById("addBaseSetToBinderButton");
let addAllCardsToBinderButton = document.getElementById("addAllCardsToBinderButton");
let profilePictureInput = document.getElementById("profilePictureInput");
let darkModeButton = document.getElementById("darkModeButton");

let profileEntryShowing = false;
let currentProfile;
let isDarkMode = false;

if (localStorage.getItem("DND_TCG_DARK_MODE") === "true") {
    isDarkMode = true;
    darkMode();
}

if (localStorage.getItem("DND_TCG_LATEST_PROFILE")) {
    profileEntryInput.value = localStorage.getItem("DND_TCG_LATEST_PROFILE");
    setTimeout(() => {
        logInButton.click();
    }, 3);
}

if (typeof window.firebaseConfig === "undefined") {
    throw new Error("Missing Firebase config. Run npm run build-config or create scripts/firebase-config.js.");
}

firebase.initializeApp(window.firebaseConfig);
const db = firebase.firestore();

function setProfileEntryShowing(showing) {
    profileEntry.style.display = showing ? "flex" : "none";
    profileEntryShowing = showing;
    profileIcon.setAttribute("aria-expanded", String(showing));
}

profileIcon.addEventListener("click", (ev) => {
    if (profileEntry.contains(ev.target)) return;
    if (!profileEntryShowing) {
        setProfileEntryShowing(true);
        setTimeout(() => {
            document.body.addEventListener("click", function closeProfileEntry(e) {
                if (profileEntry.contains(e.target)) return;
                setProfileEntryShowing(false);
                document.body.removeEventListener("click", closeProfileEntry);
            });
            (profileEntry.querySelector("#profileInfo").style.display === "flex"
                ? profileEntry.querySelector("#profileInfo button")
                : profileEntryInput).focus();
        }, 3);
    }
    else {
        setProfileEntryShowing(false);
    }
});

profileIcon.addEventListener("keydown", (e) => {
    if (e.target !== profileIcon) return;
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        profileIcon.click();
    }
});

profileEntryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") logInButton.click();
});

logInButton.addEventListener("click", () => {
    const inputName = profileEntryInput.value.trim();
    if (!toKebabCase(inputName)) {
        showToast("Enter a profile name.", "error");
        return;
    }
    // Read just this one profile instead of downloading the whole collection.
    profileDoc(inputName).get().then(async (doc) => {
        if (doc.exists) {
            loadProfile(inputName, doc);
            return;
        }
        const create = await showConfirm(
            `No profile named <strong>${escapeHTML(inputName)}</strong> exists. Create it?`,
            { confirmLabel: "Create Profile", danger: false }
        );
        if (create) createProfile(inputName);
    }).catch((error) => {
        console.error("Error looking up profile:", error);
        showToast("Couldn't reach the server.", "error");
    });
});

logOutButton.addEventListener("click", unloadProfile);

uploadProfilePictureButton.addEventListener("click", () => {
    profilePictureInput.click();
})

profilePictureInput.addEventListener("change", () => {
    const file = profilePictureInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showToast("Only image files are allowed.", "error");
        profilePictureInput.value = "";
        return;
    }

    // One picture per profile; re-uploading replaces your own, never someone else's.
    const storageRef = firebase.storage().ref("profilePictures/" + toKebabCase(currentProfile));
    storageRef.put(file, { contentType: file.type }).then(snapshot => snapshot.ref.getDownloadURL()).then(url => {
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({
            profilePictureURL: url
        });
        document.querySelector("#profileIcon i").style.display = "none";
        document.querySelector("#profilePictureImage").src = url;
        document.querySelector("#profilePictureImage").style.display = "block";
        showToast("Profile picture updated.", "success");
    }).catch((error) => {
        console.error("Upload failed:", error);
        showToast("Upload failed.", "error");
    }).finally(() => {
        profilePictureInput.value = "";
    });
});

function addCopiesToBinder(cardIds) {
    cardIds.forEach(id => { binder[id] = (binder[id] || 0) + 1; });
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({ binder: binder });
    buildBinder(cards, packs);
    buildPacks();
    showToast(`Added ${cardIds.length} cards to your binder.`, "success");
}

addAllCardsToBinderButton.addEventListener("click", async () => {
    if (!isAdmin) return;
    if (await showConfirm("Add 1 copy of <strong>every card</strong> to your binder?", { danger: false })) {
        // alternate forms share their base card's copies, so they're skipped
        addCopiesToBinder(cards.filter(c => ownershipId(c.id) === c.id).map(c => c.id));
    }
});

addBaseSetToBinderButton.addEventListener("click", async () => {
    if (!isAdmin) return;
    if (await showConfirm("Add 1 copy of every <strong>Base Set</strong> card to your binder?", { danger: false })) {
        addCopiesToBinder(packs.filter(p => p.name === "Base Set").flatMap(p => p.cardPool));
    }
});

darkModeButton.addEventListener("click", () => {
    if (isDarkMode) lightMode();
    else darkMode();
    isDarkMode = !isDarkMode;
});

function darkMode() {
    document.body.classList.add("dark-mode")
    darkModeButton.innerHTML = `<i class="bi bi-sun-fill"></i>`;
    localStorage.setItem("DND_TCG_DARK_MODE", "true");
}

function lightMode() {
    document.body.classList.remove("dark-mode")
    darkModeButton.innerHTML = `<i class="bi bi-moon-fill"></i>`;
    localStorage.removeItem("DND_TCG_DARK_MODE");
}