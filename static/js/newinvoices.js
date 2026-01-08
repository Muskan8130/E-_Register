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


async function viewMore(id) {
  const res = await fetch(`/api/invoice/${id}`);
  const j = await res.json();

  if (j.error) {
    alert("Invoice not found.");
    return;
  }

  document.getElementById("nv_invoice_no").value = j.invoice_no || "";
  document.getElementById("nv_invoice_date").value = j.invoice_date || "";
  document.getElementById("nv_item_name").value = j.item_name || "";
  document.getElementById("nv_description").value = j.description || "";
  document.getElementById("nv_qty").value = j.qty || "";
  document.getElementById("nv_unit_rate").value = j.unit_rate || "";
  document.getElementById("nv_total").value = j.total || "";

  document.getElementById("nv_company_name").value = j.company_name || "";
  document.getElementById("nv_contact_person").value = j.contact_person || "";
  document.getElementById("nv_state").value = j.state || "";
  document.getElementById("nv_gst_no").value = j.gst_no || "";
  document.getElementById("nv_pan_no").value = j.pan_no || "";
  document.getElementById("nv_contact_phone").value = j.contact_phone || "";
  document.getElementById("nv_contact_email").value = j.contact_email || "";

  openNewInvoiceViewModal();
}

/*---------------------------------------------------------
    VIEW DOCUMENT
----------------------------------------------------------*/
async function viewDoc(id) {
    window.open(`/invoice_doc/${id}`, "_blank");
}
const newInvoiceViewModal = document.getElementById("newInvoiceViewModal");

function openNewInvoiceViewModal() {
  newInvoiceViewModal.classList.add("active");
}

function closeNewInvoiceViewModal() {
  newInvoiceViewModal.classList.remove("active");
}

