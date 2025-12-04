// ========= Pagination Variables =========
let page = 1;
let per_page = 10;
let total = 0;

// Logged in user
const username = document.getElementById("username").textContent;
console.log("Logged in as:", username);

// ========= Load Data on Start =========
document.addEventListener("DOMContentLoaded", () => {
    fetchUserRecords();
});

/*---------------------------------------------------------
    FETCH USER RECORDS WITH PAGINATION
----------------------------------------------------------*/
async function fetchUserRecords() {
    try {
        const res = await fetch(`/get_user_invoice/${USER_ID}?page=${page}&per_page=${per_page}`);
        if (!res.ok) throw new Error("Failed to fetch user records");

        const data = await res.json();

        total = data.total || 0;

        renderTable(data.rows || []);
        renderPager();  

        document.getElementById("totalCount").textContent = total;

    } catch (err) {
        console.error("Error loading data:", err);
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
        li.innerHTML = `<a href="#" class="page-link" onclick="goto(${i}); return false;">${i}</a>`;
        p.appendChild(li);
    }
}

function goto(p) {
    page = p;
    fetchUserRecords();
}


/*---------------------------------------------------------
    SEARCH FUNCTION (SUPPORTS PAGINATION ALSO)
----------------------------------------------------------*/
document.getElementById("globalSearch").addEventListener("keyup", (e) => {
    if (e.key === "Enter") globalSearch();
});

async function globalSearch() {
    try {
        const q = (document.getElementById("globalSearch").value || "").trim();

        if (!q) {
            page = 1;
            return fetchUserRecords();
        }

        const res = await fetch(`/api/invoices/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();

        const rows = json.rows || [];

        if (rows.length === 0) {
            document.getElementById("tableBody").innerHTML =
                "<tr><td colspan='12'>No users found</td></tr>";
        } else {
            renderTable(rows);
        }

        // Hide pagination while search is active
        document.getElementById("invPager").innerHTML = "";
    } catch (err) {
        console.error("Search error:", err);
        document.getElementById("tableBody").innerHTML =
            "<tr><td colspan='12'>Error searching users</td></tr>";
    }
}

/*---------------------------------------------------------
    RENDER TABLE
----------------------------------------------------------*/
function renderTable(rows) {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (rows.length === 0) {
        tbody.innerHTML = "<tr><td colspan='12'>No users found</td></tr>";
        return;
    }

    rows.forEach((r) => {
        const tr = document.createElement("tr");

        const st = (r.state || "").toLowerCase().trim();
        const isUP =
            st === "up" ||
            st === "uttar pradesh" ||
            st === "uttarpradesh";

        let gstHTML = "";
        if (isUP) {
            gstHTML = `<strong>IGST:</strong> ${r.igst || 0}`;
        } else {
            gstHTML = `
                <div><strong>SGST:</strong> ${r.sgst || 0}</div>
                <div><strong>CGST:</strong> ${r.cgst || 0}</div>
            `;
        }

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

            <td class="actions-btns">
                <button class="btn btn-sm btn-info" onclick="viewMore(${r.id})">View More</button>
                <button class="btn btn-sm btn-warning" onclick="viewDoc(${r.id})">View Doc</button>
            </td>
        `;

        tbody.appendChild(tr);
    });

  }

/*---------------------------------------------------------
    VIEW MORE
----------------------------------------------------------*/
async function viewMore(id) {
    const res = await fetch(`/api/invoice/${id}`);
    const j = await res.json();

    if (j.error) {
        alert("Invoice not found.");
        return;
    }

    let details = `
USER ID: ${j.user_id || "—"}
INVOICE NO: ${j.invoice_no || "—"}
INVOICE DATE: ${j.invoice_date || "—"}
ITEM NAME: ${j.item_name || "—"}
DESCRIPTION: ${j.description || "—"}
QTY: ${j.qty || "—"}
UNIT RATE: ${j.unit_rate || "—"}
IGST: ${j.igst || "—"}
SGST: ${j.sgst || "—"}
CGST: ${j.cgst || "—"}
TOTAL: ₹${j.total || "—"}
WARRANTY DETAILS: ${j.warranty_details || "—"}
WARRANTY END: ${j.warranty_end || "—"}
WARRANTY CUSTOMER CARE NO: ${j.warr_customer_care_no || "—"}
CONTACT PERSON: ${j.contact_person || "—"}
COMPANY NAME: ${j.company_name || "—"}
ADDRESS: ${j.address || "—"}
STATE: ${j.state || "—"}
GST NO: ${j.gst_no || "—"}
PAN NO: ${j.pan_no || "—"}
CONTACT PHONE: ${j.contact_phone || "—"}
CONTACT EMAIL: ${j.contact_email || "—"}
BANK AC NO: ${j.bank_ac_no || "—"}
BANK IFSC: ${j.bank_ifsc || "—"}
BANK NAME: ${j.bank_name || "—"}
DOCUMENT: ${j.doc_filename || "—"}
CREATED AT: ${j.created_at || "—"}
`;

    alert(details);
}

/*---------------------------------------------------------
    VIEW DOCUMENT
----------------------------------------------------------*/
async function viewDoc(id) {
    window.open(`/invoice_doc/${id}`, "_blank");
}
