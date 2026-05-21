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

profileIcon.addEventListener("click", (ev) => {
    if (profileEntry.contains(ev.target)) return;
    if (!profileEntryShowing) {
        profileEntry.style.display = "flex";
        profileEntryShowing = true;
        setTimeout(() => {
            document.body.addEventListener("click", function closeProfileEntry(e) {
                if (profileEntry.contains(e.target)) return;
                profileEntry.style.display = "none";
                profileEntryShowing = false
                document.body.removeEventListener("click", closeProfileEntry);
            });
        }, 3);
    }
    else {
        profileEntry.style.display = "none";
        profileEntryShowing = false
    }
});

logInButton.addEventListener("click", () => {
    let inputName = profileEntryInput.value;
    let matchingProfileFound = false;
    db.collection("profiles").get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            // console.log(doc.id, toKebabCase(inputName));
            if (doc.id == toKebabCase(inputName)) matchingProfileFound = true;
        });
        // console.log(matchingProfileFound);
        if (matchingProfileFound) {
            loadProfile(inputName);
        } else {
            if (confirm("No profile with name " + inputName + " exists. Create a new one?")) {
                createProfile(inputName);
            }
        }
    });
});

logOutButton.addEventListener("click", unloadProfile);

uploadProfilePictureButton.addEventListener("click", () => {
    profilePictureInput.click();
})

profilePictureInput.addEventListener("change", () => {
    const file = profilePictureInput.files[0];

    if (!file) {
        alert("Please select an image.");
        return;
    }

    if (!file.type.startsWith("image/")) {
        alert("Only image files are allowed.");
        profilePictureInput.value = "";
        return;
    }

    const storageRef = firebase.storage().ref("profilePictures/" + file.name);
    storageRef.put(file).then(snapshot => snapshot.ref.getDownloadURL()).then(url => {
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({
            profilePictureURL: url
        });
        document.querySelector("#profileIcon i").style.display = "none";
        document.querySelector("#profilePictureImage").src = url;
        document.querySelector("#profilePictureImage").style.display = "block";
        // return snapshot.ref.getDownloadURL();
    }).then(url => {
        console.log("Image URL:", url);
    });
});

addAllCardsToBinderButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to add 1 copy of every card to your binder?")) {
        for (c in cards) {
            if (binder[cards[c].id]) binder[cards[c].id] = binder[cards[c].id] + 1;
            else binder[cards[c].id] = 1;
        }
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({
            binder: binder
        });
    }
});

addBaseSetToBinderButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to add 1 copy of every card from Base Set to your binder?")) {
        for (p in packs) {
            if (packs[p].name !== "Base Set") continue;
            for (c in packs[p].cardPool) {
                if (binder[packs[p].cardPool[c]]) binder[packs[p].cardPool[c]] = binder[packs[p].cardPool[c]] + 1;
                else binder[packs[p].cardPool[c]] = 1;
            }
        }
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({
            binder: binder
        });
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