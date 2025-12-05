/* ==========================================================
   GLOBAL VARIABLES
========================================================== */
let companies = [];

/* ==========================================================
   LOAD COMPANIES FROM BACKEND (MySQL)
========================================================== */
async function loadCompaniesFromBackend() {
    try {
        let res = await fetch("/api/company_list");
        let data = await res.json();

        if (data.status === "ok") {
            companies = data.companies || [];
            loadCompanyTable(companies);
        } else {
            alert("Error loading companies: " + data.message);
        }

    } catch (err) {
        console.error(err);
        alert("Server error while loading companies!");
    }
}

/* ==========================================================
   RENDER COMPANY TABLE
========================================================== */
function loadCompanyTable(list) {
    const tbody = document.querySelector("#companyTable tbody");
    tbody.innerHTML = "";

    if (!list || list.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5'>No companies found</td></tr>";
        return;
    }

    list.forEach((c, i) => {
        let tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${c.name || "-"}</td>
            <td>${c.address || "-"}</td>
            <td>${c.state || "-"}</td>
            <td>${c.contact || "-"}</td>
            <td>
                <button class="action-btn" onclick="viewCompany(${i})">
                    View Data
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

/* ==========================================================
   VIEW COMPANY POPUP
========================================================== */
function viewCompany(index) {
    let c = companies[index];
    alert(`
Company Name: ${c.name}
Address: ${c.address}
State: ${c.state}
Contact Number: ${c.contact}
    `);
}

/* ==========================================================
   REAL-TIME SEARCH
   User can search by:
   ✔ company name
   ✔ address
   ✔ state
   ✔ contact_phone
========================================================== */
document.getElementById("companySearch").addEventListener("input", (e) => {
    const text = e.target.value.toLowerCase();

    const filtered = companies.filter(c =>
        (c.name || "").toLowerCase().includes(text) ||
        (c.address || "").toLowerCase().includes(text) ||
        (c.state || "").toLowerCase().includes(text) ||
        (c.contact || "").toLowerCase().includes(text)
    );

    loadCompanyTable(filtered);
});

/* ==========================================================
   BACK BUTTON
========================================================== */
function goBack() {
    window.history.back();
}

/* ==========================================================
   INITIAL LOAD
========================================================== */
loadCompaniesFromBackend();
