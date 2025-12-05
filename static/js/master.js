/* ========== ADMIN STORAGE ========== */
let admins = JSON.parse(localStorage.getItem("admins2")) || [];

/* ========== ELEMENTS ========== */
const modalAdmin = document.getElementById("createAdminModal");
const closeAdminModal = document.getElementById("closeAdminModal");
const createBtn = document.getElementById("createAdminBtn");
const submitAdmin = document.getElementById("createAdminSubmit");
const showAdminsBtn = document.getElementById("showAdminsBtn");

/* ========== OPEN / CLOSE CREATE ADMIN ========== */
createBtn.onclick = () => {
    modalAdmin.style.display = "flex";
};

closeAdminModal.onclick = () => {
    modalAdmin.style.display = "none";
};

/* ========== CREATE ADMIN ========== */
submitAdmin.onclick = () => {
    let username = document.getElementById("adminUsername").value.trim();
    let password = document.getElementById("adminPassword").value.trim();
    let msg = document.getElementById("adminMsg");

    if (!username || !password) {
        msg.innerHTML = "<span style='color:red'>Fill all fields!</span>";
        return;
    }

    admins.push({ username, password });
    localStorage.setItem("admins2", JSON.stringify(admins));

    msg.innerHTML = "<span style='color:green'>Admin created!</span>";

    document.getElementById("adminUsername").value = "";
    document.getElementById("adminPassword").value = "";

    setTimeout(() => modalAdmin.style.display = "none", 700);
    loadAdmins();
};

/* ========== SHOW ADMIN TABLE ========== */
showAdminsBtn.onclick = loadAdmins;

function loadAdmins() {
    const tbody = document.querySelector("#adminTable tbody");
    tbody.innerHTML = "";

    if (admins.length === 0) {
        tbody.innerHTML = "<tr><td colspan='2'>No admins found</td></tr>";
        return;
    }

    admins.forEach((a, i) => {
        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${a.username}</td>
        `;
        tbody.appendChild(tr);
    });
}

/* ========== GAME LOGIC ========== */
const gameModal = document.getElementById("gameModal2");
const closeGameModal = document.getElementById("closeGameModal");
const gameBtn = document.getElementById("gameBtn");
const submitGame2 = document.getElementById("submitGame2");

const words2 = ["apple","oxygen","market","yellow","random"];
let current2 = 0;
let scrambled2 = "";

function shuffle(w) {
    return w.split("").sort(() => Math.random() - 0.5).join("");
}

function loadWord() {
    let w = words2[current2];
    scrambled2 = shuffle(w);
    if (scrambled2 === w) scrambled2 = shuffle(w);

    document.getElementById("scrambledWord2").innerText = scrambled2;
    document.getElementById("userAnswer2").value = "";
    document.getElementById("progress2").innerText =
        `Word ${current2 + 1} of ${words2.length}`;
}

gameBtn.onclick = () => {
    gameModal.style.display = "flex";
    current2 = 0;
    loadWord();
};

closeGameModal.onclick = () => {
    gameModal.style.display = "none";
};

submitGame2.onclick = () => {
    let a = document.getElementById("userAnswer2").value.trim().toLowerCase();

    if (a === words2[current2]) {
        document.getElementById("message2").innerHTML = "<span style='color:green'>Correct!</span>";
        current2++;
        if (current2 < words2.length) setTimeout(loadWord, 1000);
    } else {
        document.getElementById("message2").innerHTML = "<span style='color:red'>Wrong!</span>";
    }
};

/* ========= THEME SWITCHER ========= */
document.getElementById("themeMaster2").onchange = () => {
    let t = document.getElementById("themeMaster2").value;

    if (t === "light") {
        document.body.style.background = "#f0f0f0";
        document.querySelector(".header").style.background = "white";
    } else if (t === "dark") {
        document.body.style.background = "#1a1a1a";
        document.querySelector(".header").style.background = "#444";
    } else {
        document.body.style.background =
            "linear-gradient(135deg,#667eea,#764ba2)";
        document.querySelector(".header").style.background = "#f2f6f6";
    }
};
