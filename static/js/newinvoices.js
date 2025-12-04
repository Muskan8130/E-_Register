 // ===== Dummy data (you will replace with backend data) =====
   const username = document.getElementById("username").textContent;
console.log("Logged in as:", username);

// ===== Populate table =====
document.addEventListener('DOMContentLoaded', fetchUserRecords);

async function fetchUserRecords() {
  try {
    const res = await fetch(`/get_user_invoice/${USER_ID}`);
    if (!res.ok) throw new Error('Failed to fetch user records');

    const data = await res.json();

    // 🔥 Update total records on top
    document.getElementById("totalCount").textContent = data.total || 0;

    // 🔥 Rows to render
    const rows = data.rows || [];

    renderTable(rows);

  } catch (err) {
    console.error("Error loading data:", err);
  }
}

    document.getElementById("globalSearch").addEventListener("keyup", (e) => {
      if (e.key === "Enter") globalSearch();
    });


    async function globalSearch() {
      try {
        const q = (document.getElementById("globalSearch").value || '').trim();

        // if empty, call fetchUsers() to restore full (unfiltered) table
        if (!q) {
          page = 1;
          return fetchUserRecords(page);
        }

        const res = await fetch(`/api/invoices/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();

        // Support both response shapes:
        // 1) { status: "ok", rows: [...] } OR
        // 2) { total: X, rows: [...] } OR  { total, rows } without status
        const rows = json.rows || [];
        if (rows.length === 0) {
          document.getElementById("tableBody").innerHTML = "<tr><td colspan='7'>No users found</td></tr>";
        } else {
          renderTable(rows);
        }
      } catch (err) {
        console.error("Search error:", err);
        document.getElementById("tableBody").innerHTML = "<tr><td colspan='7'>Error searching users</td></tr>";
      }
    }

   function renderTable(rows) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12">No users found</td></tr>';
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement('tr');

    // Detect UP state
    const st = (r.state || '').toLowerCase().trim();
    const isUP = (st === 'up' || st === 'uttar pradesh' || st === 'uttarpradesh');

    // Create GST dynamic HTML
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
      <td>${r.invoice_no || ''}</td>
      <td>${r.item_name || ''}</td>
      <td>${r.qty || ''}</td>
      <td>${r.unit_rate || ''}</td>

      <!-- SINGLE GST Column (Dynamic) -->
      <td>${gstHTML}</td>

      <td>${r.total || ''}</td>
      <td>${r.contact_person || ''}</td>
      <td>${r.company_name || ''}</td>
      <td>${r.state || ''}</td>
      <td>${r.gst_no || ''}</td>

      <td class="actions-btns">
        <button class="btn btn-sm btn-info" onclick="viewMore(${r.id})">View More</button>
        <button class="btn btn-sm btn-warning" onclick="viewDoc(${r.id})">View Doc</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

    // ===== Show All =====
    function showAll(i) {
      alert("Show all data for invoice: " + invoiceData[i].invoiceNo);
      // You can open a detail page or modal for complete info
    }

    async function viewMore(id) {
      console.log(id)
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

/*-------------view document-----------------*/

async function viewDoc(id) {
 window.open(`/invoice_doc/${id}`, "_blank");
}