/* ======================================
   ========== CREATE ADMIN LOGIC ==========
   ====================================== */

const modalAdmin = document.getElementById("createAdminModal");
const closeAdminModal = document.getElementById("closeAdminModal");
const createBtn = document.getElementById("createAdminBtn");
const submitAdmin = document.getElementById("createAdminSubmit");
const showAdminsBtn = document.getElementById("showAdminsBtn");

/* ----- Open Modal ----- */
createBtn.onclick = () => {
    modalAdmin.style.display = "flex";
};

/* ----- Close Modal ----- */
closeAdminModal.onclick = () => {
    modalAdmin.style.display = "none";
};

/* ----- Create Admin (Backend API) ----- */
submitAdmin.onclick = async () => {
    let username = document.getElementById("adminUsername").value.trim();
    let password = document.getElementById("adminPassword").value.trim();
    let msg = document.getElementById("adminMsg");

    if (!username || !password) {
        msg.innerHTML = "<span style='color:red'>Fill all fields!</span>";
        return;
    }

    try {
        let res = await fetch("/master/create_admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userid: username,
                password: password
            })
        });

        let data = await res.json();

        if (data.status === "success") {
            msg.innerHTML = "<span style='color:green'>" + data.message + "</span>";

            document.getElementById("adminUsername").value = "";
            document.getElementById("adminPassword").value = "";

            loadAdmins(); // Refresh table
            setTimeout(() => (modalAdmin.style.display = "none"), 700);
        } else {
            msg.innerHTML = "<span style='color:red'>" + data.message + "</span>";
        }
    } catch (err) {
        msg.innerHTML = "<span style='color:red'>Server Error</span>";
    }
};

/* ======================================
   ========== LOAD ADMINS TABLE ==========
   ====================================== */

/* Show Admin Button */
showAdminsBtn.onclick = async () => {
    document.getElementById("adminTableBox").style.display = "block";
    loadAdmins();
};

/* Load Admin Table FROM BACKEND */
async function loadAdmins() {
    const tbody = document.querySelector("#adminTable tbody");
    tbody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

    try {
        let res = await fetch("/master/get_admins");
        let data = await res.json();

        tbody.innerHTML = "";

        if (!data.admins || data.admins.length === 0) {
            tbody.innerHTML = "<tr><td colspan='4'>No admins found</td></tr>";
            return;
        }

        data.admins.forEach((a, i) => {
            let tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${a.user_id}</td>
                <td>${a.created_at || "-"}</td>
                <td>
                    <button class="btn btn-danger" onclick="deleteAdmin('${a.user_id}')">
                        Delete
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='4' style='color:red'>Error loading admins</td></tr>";
    }
}


async function deleteAdmin(userid) {
    if (!confirm("Are you sure you want to delete '" + userid + "'?")) return;

    let res = await fetch("/master/delete_admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid })
    });

    let data = await res.json();

    if (data.status === "success") {
        alert(data.message);
        loadAdmins(); // Refresh the table
    } else {
        alert("Error: " + data.message);
    }
}


/* ================= LOGOUT ================= */
document.getElementById("logoutBtn").onclick = async () => {
    // Call the logout route
    await fetch("/logout");

    // Redirect to login page
    window.location.href = "/login";
};


/* ======================================
   ========== WORD SCRAMBLE GAME ==========
   ====================================== */

const gameModal = document.getElementById("gameModal2");
const closeGameModal = document.getElementById("closeGameModal");
const gameBtn = document.getElementById("gameBtn");
const submitGame2 = document.getElementById("submitGame2");

const words2 = ["apple", "oxygen", "market", "yellow", "random"];
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
        document.getElementById("message2").innerHTML =
            "<span style='color:green'>Correct!</span>";

        current2++;
        if (current2 < words2.length) setTimeout(loadWord, 1000);
    } else {
        document.getElementById("message2").innerHTML =
            "<span style='color:red'>Wrong!</span>";
    }
};


/* ======================================
   ========== THEME SWITCHER ==========
   ====================================== */

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
