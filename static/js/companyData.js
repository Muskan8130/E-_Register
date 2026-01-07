
if (typeof COMPANY_ID === "undefined") {
    console.error("❌ COMPANY_ID not injected into page");
}

// ========= Pagination Variables =========
let page = 1;
let per_page = 10;
let total = 0;

// Logged in user
const username = document.getElementById("username").textContent;
console.log("Logged in as:", username);
console.log("Company ID:", COMPANY_ID);

// ========= Load Data on Start =========
document.addEventListener("DOMContentLoaded", () => {
    fetchCompanyRecords();
});

/*---------------------------------------------------------
    FETCH COMPANY RECORDS WITH PAGINATION
----------------------------------------------------------*/
async function fetchCompanyRecords() {
    try {
        const res = await fetch(
            `/api/company/${COMPANY_ID}?page=${page}&per_page=${per_page}`
        );

        if (!res.ok) throw new Error("Failed to load company data");

        const data = await res.json();

        total = data.total || 0;

        renderTable(data.rows || []);
        renderPager();

        document.getElementById("totalCount").textContent = total;

    } catch (err) {
        console.error("Error loading company data:", err);
    }
}

/*---------------------------------------------------------
    RENDER PAGINATION
----------------------------------------------------------*/
function renderPager() {
    const pages = Math.ceil(total / per_page) || 1;
    const p = document.getElementById("invPager");
    p.innerHTML = "";

    for (let i = 1; i <= pages; i++) {
        const li = document.createElement("li");
        li.className = `page-item ${i === page ? "active" : ""}`;
        li.innerHTML = `
            <a href="#" class="page-link"
               onclick="gotoPage(${i}); return false;">
               ${i}
            </a>`;
        p.appendChild(li);
    }
}

function gotoPage(p) {
    page = p;
    fetchCompanyRecords();
}

/*---------------------------------------------------------
    SEARCH (COMPANY-WISE)
----------------------------------------------------------*/
document.getElementById("globalSearch").addEventListener("keyup", (e) => {
    if (e.key === "Enter") companySearch();
});

async function companySearch() {
    try {
        const q = (document.getElementById("globalSearch").value || "").trim();

        if (!q) {
            page = 1;
            return fetchCompanyRecords();
        }

        const res = await fetch(
            `/api/company/search?q=${encodeURIComponent(q)}`
        );

        if (!res.ok) throw new Error("Search failed");

        const json = await res.json();

        console.log("Search rows:", json.rows); // ✅ debug proof
        renderTable(json.rows || []);
        document.getElementById("invPager").innerHTML = "";

    } catch (err) {
        console.error("Search error:", err);
    }
}

/*---------------------------------------------------------
    RENDER TABLE
----------------------------------------------------------*/
function renderTable(rows) {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (!rows || rows.length === 0) {
        tbody.innerHTML =
            "<tr><td colspan='12'>No records found</td></tr>";
        return;
    }

    rows.forEach((r) => {
        const st = (r.state || "").toLowerCase().trim();
        const isUP =
            st === "up" ||
            st === "uttar pradesh" ||
            st === "uttarpradesh";

        const gstHTML = isUP
            ? `<strong>IGST:</strong> ${r.igst || 0}`
            : `
                <div><strong>SGST:</strong> ${r.sgst || 0}</div>
                <div><strong>CGST:</strong> ${r.cgst || 0}</div>
              `;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.invoice_no || ""}</td>
            <td>${r.item_name || ""}</td>
            <td>${r.qty || ""}</td>
            <td>${r.unit_rate || ""}</td>
            <td>${gstHTML}</td>
            <td>${r.total || ""}</td>
            <td>${r.contact_person || ""}</td>
            <td>${r.company_name || ""}</td>
            <td>${r.state || ""}</td>
            <td>${r.gst_no || ""}</td>
            <td>
                <button class="btn btn-sm btn-info"
                        onclick="viewMore(${r.id})">
                        View More
                </button>
                <button class="btn btn-sm btn-warning"
                        onclick="viewDoc(${r.id})">
                        View Doc
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/*---------------------------------------------------------
    VIEW MORE
----------------------------------------------------------*/
async function viewMore(id) {
    const res = await fetch(`/api/company/${id}`);
    const j = await res.json();

    if (j.error) {
        alert("Invoice not found.");
        return;
    }

    alert(`
INVOICE NO: ${j.invoice_no}
ITEM: ${j.item_name}
QTY: ${j.qty}
TOTAL: ₹${j.total}
COMPANY: ${j.company_name}
STATE: ${j.state}
GST NO: ${j.gst_no}
    `);
}

/*---------------------------------------------------------
    VIEW DOCUMENT
----------------------------------------------------------*/
function viewDoc(id) {
    window.open(`/invoice_doc/${id}`, "_blank");
}
