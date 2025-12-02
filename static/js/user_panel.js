/********************************************
 * OPEN/CLOSE MODAL
 ********************************************/

const addModalEl = document.getElementById('addModal');
const addModal = new bootstrap.Modal(addModalEl, {
    backdrop: 'static',
    keyboard: true
});

// OPEN MODAL
document.getElementById('addInvoiceBtn').addEventListener('click', () => {
    clearFormFields();
    document.getElementById('modalFile').value = "";
    document.getElementById('docInput').value = "";
    addModal.show();
});

// CLOSE MODAL WHEN NEEDED
function closeAddModal() {
    addModal.hide();
}


/********************************************
 * GLOBAL VARIABLES
 ********************************************/
let excelRows = [];
let currentIndex = 0;

const FIELD_KEYS = [
    "invoice_no","item_name","qty","unit_rate","igst","cgst","sgst","total",
    "contact_person","company_name","state","gst_no",
    "invoice_date","description","warranty_details","warranty_end",
    "warranty_cc","address","pan_no","contact_phone","contact_email",
    "bank_acc","bank_ifsc","bank_name"
];

// fill data in modal
function fillForm(idx) {
    const row = excelRows[idx];
    FIELD_KEYS.forEach(k => {
        const el = document.getElementById("f_" + k);
        if (el) el.value = row[k] || "";
    });
}

// buttons
document.getElementById("prevBtn").onclick = () => {
    if (currentIndex > 0) {
        currentIndex--;
        fillForm(currentIndex);
    }
};

document.getElementById("nextBtn").onclick = () => {
    if (currentIndex < excelRows.length - 1) {
        currentIndex++;
        fillForm(currentIndex);
    }
};

// open modal
document.getElementById("addInvoiceBtn").onclick = () => {
    excelRows = [];
    currentIndex = 0;
    clearForm();
    new bootstrap.Modal(document.getElementById("addModal")).show();
};

// clear form
function clearForm() {
    FIELD_KEYS.forEach(k => {
        const el = document.getElementById("f_" + k);
        if (el) el.value = "";
    });
}

// upload excel
document.getElementById("modalUploadBtn").onclick = async () => {
    const file = document.getElementById("modalFile").files[0];
    if (!file) return alert("Select a file");

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/upload_excel", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) return alert(data.error);

    excelRows = data.rows;
    currentIndex = 0;
    fillForm(0);
};

// save current row
document.getElementById("saveModalBtn").onclick = async () => {

    if (excelRows.length === 0) {
        alert("No rows to save");
        return;
    }

    const docFile = document.getElementById("docInput").files[0];

    for (let i = 0; i < excelRows.length; i++) {

        let row = excelRows[i];
        let fd = new FormData();

        // append row fields
        FIELD_KEYS.forEach(k => {
            fd.append(k, row[k] || "");
        });

        // add document file (same for all rows)
        if (docFile) fd.append("doc", docFile);

        // send row to backend
        let res = await fetch("/save", {
            method: "POST",
            body: fd
        });

        let result = await res.json();

        // if any row gives error → stop
        if (!result.status) {
            alert(`Error saving row ${i + 1}: ${result.error}`);
            return;
        }
    }

    alert("✔ All invoice rows saved successfully!");

    // close modal
    bootstrap.Modal.getInstance(document.getElementById("addModal")).hide();

    // refresh table
    fetchUserRecords();
};



    /**********************
     * Rendering
     **********************/

document.addEventListener('DOMContentLoaded', fetchUserRecords);

async function fetchUserRecords() {
  try {
    const res = await fetch('/get_user_records');
    const data = await res.json();  // { total: X, rows: [...] }

    // ⬇ Show total count
    document.getElementById("totalCount").textContent = data.total ?? 0;

    // ⬇ Send only rows to table
    records = data.rows || [];
    renderTable(records);

  } catch (err) {
    console.error('Error loading data:', err);
    document.getElementById("totalCount").textContent = "0";
    renderTable([]);
  }
}


function renderTable(rows = []) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10">No users found</td></tr>';
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement('tr');

    // Detect UP state
    const st = (r.state || '').toLowerCase().trim();
    const isUP = (st === 'up' || st === 'uttar pradesh' || st === 'uttarpradesh');

    // Create GST cell content
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

      <!-- SINGLE GST COLUMN -->
      <td>${gstHTML}</td>

      <td>${r.total || ''}</td>
      <td>${r.contact_person || ''}</td>
      <td>${r.company_name || ''}</td>
      <td>${r.state || ''}</td>
      <td>${r.gst_no || ''}</td>

      <td class="actions-btns">
        <button class="btn btn-sm btn-outline-primary me-1 editBtn" data-idx="${r.id}">✏ Edit</button>
        <button class="btn btn-sm btn-outline-success me-1 showBtn" data-idx="${r.id}">📋 View Doc</button>
        <button class="btn btn-sm btn-outline-info me-1 chartBtn" onclick="viewMore(${r.id})">📊 View All Data</button>
        <button class="btn btn-sm btn-outline-danger deleteBtn" data-id="${r.id}">🗑 Delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/* -----------------view document ------------------*/

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.showBtn');
    if (btn) {
        const id = btn.dataset.idx;
        window.open(`/invoice_doc/${id}`, "_blank"); // 🔥 Opens PDF/JPG in new tab
    }
});


   
    /**********************
     * Table row View All
     **********************/
     //Make array for extracting only some filds-----------------------------------------/
    document.addEventListener('click', (e) => {
      const v = e.target.closest('.viewAllBtn');
      if (v){
        const idx = Number(v.dataset.idx);
        const rec = records[idx];
        if (!rec) return;
        const viewBody = document.getElementById('viewAllBody');
        viewBody.innerHTML = '';
        FIELD_KEYS.forEach(k => {
          const row = document.createElement('div');
          row.className = 'mb-2';
          row.innerHTML = `<strong>${toDisplay(k)}:</strong> <div class="muted small">${rec[k]||''}</div>`;
          viewBody.appendChild(row);
        });
        const vm = new bootstrap.Modal(document.getElementById('viewAllModal'));
        vm.show();
      }
    });

    // "View Docs" button: placeholder behaviour
    document.addEventListener('click', (e) => {
      const v = e.target.closest('.viewDocsBtn');
      if (v){
        const idx = Number(v.dataset.idx);
        alert('View Docs clicked for row ' + idx + '. Implement doc viewer as needed.');
      }
    });
  

// Edit Button

document.addEventListener("DOMContentLoaded", () => {

    document.addEventListener("click", async (e) => {
        const btn = e.target.closest(".editBtn");
        if (!btn) return;

        const id = btn.dataset.idx;

        const res = await fetch(`/get_invoice/${id}`);
        const data = await res.json();

        fillEditModal(data);

        new bootstrap.Modal(document.getElementById("editInvoiceModal")).show();
    });

});

function toInputDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toISOString().split("T")[0];
}

function fillEditModal(d) {

    document.getElementById("e_invoice_no").value = d.invoice_no || "";
    document.getElementById("e_item_name").value = d.item_name || "";
    document.getElementById("e_qty").value = d.qty || "";
    document.getElementById("e_unit_rate").value = d.unit_rate || "";
    document.getElementById("e_igst").value = d.igst || "";
    document.getElementById("e_cgst").value = d.cgst || "";
    document.getElementById("e_sgst").value = d.sgst || "";
    document.getElementById("e_total").value = d.total || "";
    document.getElementById("e_contact_person").value = d.contact_person || "";
    document.getElementById("e_company_name").value = d.company_name || "";
    document.getElementById("e_state").value = d.state || "";
    document.getElementById("e_gst_no").value = d.gst_no || "";
    document.getElementById("e_invoice_date").value = toInputDate(d.invoice_date);
    document.getElementById("e_description").value = d.description || "";
    document.getElementById("e_warranty_details").value = d.warranty_details || "";
    document.getElementById("e_warranty_end").value = toInputDate(d.warranty_end);
    document.getElementById("e_warranty_cc").value = d.warr_customer_care_no || "";
    document.getElementById("e_address").value = d.address || "";
    document.getElementById("e_pan_no").value = d.pan_no || "";
    document.getElementById("e_contact_phone").value = d.contact_phone || "";
    document.getElementById("e_contact_email").value = d.contact_email || "";
    document.getElementById("e_bank_acc").value = d.bank_ac_no || "";
    document.getElementById("e_bank_ifsc").value = d.bank_ifsc || "";
    document.getElementById("e_bank_name").value = d.bank_name || "";

    document.getElementById("editInvoiceModal").setAttribute("data-id", d.id);
}

// 🔥 UPDATE BUTTON CLICK — NOW SEND FILE & ALL FIELDS TO BACKEND
document.getElementById("editSaveBtn").addEventListener("click", async () => {
    const id = document.getElementById("editInvoiceModal").getAttribute("data-id");

    let formData = new FormData();
    formData.append("invoice_no", e_invoice_no.value);
    formData.append("item_name", e_item_name.value);
    formData.append("qty", e_qty.value);
    formData.append("unit_rate", e_unit_rate.value);
    formData.append("igst", e_igst.value);
    formData.append("cgst", e_cgst.value);
    formData.append("sgst", e_sgst.value);
    formData.append("total", e_total.value);
    formData.append("contact_person", e_contact_person.value);
    formData.append("company_name", e_company_name.value);
    formData.append("state", e_state.value);
    formData.append("gst_no", e_gst_no.value);
    formData.append("invoice_date", e_invoice_date.value);
    formData.append("description", e_description.value);
    formData.append("warranty_details", e_warranty_details.value);
    formData.append("warranty_end", e_warranty_end.value);
    formData.append("warr_customer_care_no", e_warranty_cc.value);
    formData.append("address", e_address.value);
    formData.append("pan_no", e_pan_no.value);
    formData.append("contact_phone", e_contact_phone.value);
    formData.append("contact_email", e_contact_email.value);
    formData.append("bank_ac_no", e_bank_acc.value);
    formData.append("bank_ifsc", e_bank_ifsc.value);
    formData.append("bank_name", e_bank_name.value);

    // 📄 FILE INPUT ADDED (ONLY IF NEW FILE CHOSEN)
    let file = document.getElementById("e_docInput").files[0];
    if (file) formData.append("document", file);

    const res = await fetch(`/edit_invoice/${id}`, {
        method: "POST",
        body: formData  // <-- FILES WORK NOW
    });

    const result = await res.json();

    if (result.success) {
      
        location.reload();
    } else {
        alert("Error updating invoice");
    }
});


// Show Data Button
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



// Delete Button
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.deleteBtn');
  if (b) {
    const recordId = b.dataset.id;  // now correct

    if (confirm('Are you sure you want to delete this invoice?')) {

      const res = await fetch(`/delete_invoice/${recordId}`, {
        method: "DELETE"
      });

      const data = await res.json();

      if (data.success) {
       
        fetchUserRecords(); 
      } else {
        alert("Delete failed: " + data.error);
      }
    }
  }
});


    //"................................edit delete,show doc show all........................................................................."
    function toDisplay(key){
      return key.split('_').map(w => w[0].toUpperCase()+w.slice(1)).join(' ');
    }

    /**********************
     * Global search + highlight
     **********************/
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


    /**********************
     * Export (Full & Custom)
     **********************/
   document.getElementById('exportFullBtn').addEventListener('click', async () => {

    const res = await fetch('/export_all', {
        method: 'GET'
    });

    if (!res.ok) {
        alert("Failed to download Excel");
        return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "all_data.xlsx";
    a.click();

    window.URL.revokeObjectURL(url);
});


//---------------------custom exal ------------------------------------

document.getElementById("exportCustomBtn").addEventListener("click", () => {
    new bootstrap.Modal(document.getElementById("customExportModal")).show();
});


 function filterRows(keyword, minId = 0) {
    const key = keyword.toLowerCase();

    return records.filter(r =>
        (
            (r.invoice_no || "").toLowerCase().includes(key) ||
            (r.item_name || "").toLowerCase().includes(key) ||
            (r.company_name || "").toLowerCase().includes(key)
        )
        && r.id > minId
    );
}
function showDropdown(inputEl, dropdownEl, rows) {
    dropdownEl.innerHTML = "";
    dropdownEl.style.display = rows.length ? "block" : "none";

    rows.forEach(r => {
        const item = document.createElement("a");
        item.className = "dropdown-item";
        item.textContent = `${r.id} - ${r.invoice_no} (${r.company_name})`;
        item.onclick = () => {
            inputEl.value = r.id;
            dropdownEl.style.display = "none";
        };
        dropdownEl.appendChild(item);
    });
}
document.getElementById("startRowInput").addEventListener("input", e => {
    const keyword = e.target.value;
    const rows = filterRows(keyword);
    showDropdown(e.target, document.getElementById("startDropdown"), rows);
});

document.getElementById("endRowInput").addEventListener("input", e => {
    const keyword = e.target.value;
    const startId = parseInt(document.getElementById("startRowInput").value) || 0;
    const rows = filterRows(keyword, startId);
    showDropdown(e.target, document.getElementById("endDropdown"), rows);
});
document.getElementById("createCustomExcel").addEventListener("click", async () => {

    const startId = parseInt(document.getElementById("startRowInput").value);
    const endId = parseInt(document.getElementById("endRowInput").value);

    if (!startId || !endId || endId <= startId) {
        alert("Please select valid start and end rows.");
        return;
    }

    const res = await fetch('/export_custom', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: startId, end: endId })
    });

    if (!res.ok) {
        alert("Failed to generate Excel.");
        return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "custom_data.xlsx";
    a.click();

    window.URL.revokeObjectURL(url);
});


  
    /************ LOCKED BUTTON + MODAL TABLE ************/

document.getElementById("lockedBtn").addEventListener("click", () => {
    let modal = new bootstrap.Modal(document.getElementById("lockedModal"));
    loadLockedTable();
    modal.show();
});

// Load locked table rows from existing records[]
async function loadLockedTable() {
    const body = document.getElementById("lockedBody");
    body.innerHTML = "";

    const res = await fetch(`/get_locked_records/${USER_ID}`);  // you have session user_id
    const lockedRows = await res.json();

    lockedRows.forEach(r => {
        let tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${r.invoice_no || ""}</td>
            <td>${r.gst_no || ""}</td>
            <td>${r.invoice_date || ""}</td>
            <td>${r.contact_person || ""}</td>
            <td>${r.state || ""}</td>
            <td>${r.contact_mobile || ""}</td>
            <td>${r.contact_email || ""}</td>

            <td class="text-center">
                <button class="btn btn-sm btn-outline-danger unlockBtn" data-id="${r.id}">
                    🔓 Unlock
                </button>
            </td>
        `;

        body.appendChild(tr);
    });
}


// Unlock action
document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".unlockBtn");
    if (btn) {
        const id = btn.dataset.id;

        const res = await fetch(`/unlock_invoice/${id}`, {
            method: "POST"
        });

        const data = await res.json();

        if (data.success) {
            alert("Unlocked!");

            // reload locked modal data
            loadLockedTable();

            // reload main table
            fetchUserRecords();
        }
    }
});


//--------------------------- game modal----------------------------------------
/* ========= REAL LOGIN PAGE GAME LOGIC ========= */

const words2 = [
    "game", "write", "cool", "app", "tree", "type", "free", "submit", "task",
    "brave", "good", "allow", "audit", "extra", "budget", "profit", "expense",
    "print", "flow","project", "software", "hardware", "leader", "key", "honest",
    "search", "tracking", "reverse","manager", "report", "system", "data", 
    "network", "security", "storage", "backup", "old", "user","password", 
    "email", "database", "server", "website", "design", "analysis", "testing", 
    "support", "developer","place", "joker", "update", "logic", "speed", "client", 
    "provider", "resource","team", "meeting", "schedule", "goal", "objective", 
    "training", "feedback", "productivity", "innovation","strategy", "planning", 
    "execution", "leadership", "column", "communication", "market", "sales",
    "brand", "promotion", "advertisement", "customer", "growth", "target", 
    "competition", "product","service", "solution", "feature", "quality", "design", 
    "experience", "review", "rating", "satisfaction","engagement", "trend", 
    "vision", "mission", "value", "culture", "ethics", "teamwork", "creativity","winner"
];

let currentIndex2 = 0;
let scrambled2 = "";

const modal2 = document.getElementById("gameModal2");
const playBtn2 = document.getElementById("gameBtn");
const closeBtn2 = document.querySelector(".close2");
const scrambledWordEl2 = document.getElementById("scrambledWord2");
const userAnswer2 = document.getElementById("userAnswer2");
const submitBtn2 = document.getElementById("submitBtn2");
const messageEl2 = document.getElementById("message2");
const progressEl2 = document.getElementById("progress2");

function shuffleWord2(word) {
  const arr = word.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

function nextWord2() {
  if (currentIndex2 >= words2.length) {
    scrambledWordEl2.textContent = "---";
    messageEl2.style.color = "#007bff";
    messageEl2.textContent = "🎉 You solved all the words!";
    userAnswer2.style.display = "none";
    submitBtn2.style.display = "none";
    progressEl2.textContent = `Completed ${words2.length}/${words2.length}`;
    return;
  }

  const word = words2[currentIndex2];
  scrambled2 = shuffleWord2(word);
  if (scrambled2 === word) scrambled2 = shuffleWord2(word);

  scrambledWordEl2.textContent = scrambled2;
  userAnswer2.value = "";
  messageEl2.textContent = "";
  progressEl2.style.color = "grey";
  progressEl2.textContent = `Word ${currentIndex2 + 1} of ${words2.length}`;
  userAnswer2.focus();
}

submitBtn2.addEventListener("click", () => {
  const answer = userAnswer2.value.trim().toLowerCase();
  if (answer === words2[currentIndex2].toLowerCase()) {
    messageEl2.style.color = "#28a745";
    messageEl2.textContent = "✅ Correct!";
    currentIndex2++;
    setTimeout(nextWord2, 1500);
  } else {
    messageEl2.style.color = "#dc3545";
    messageEl2.textContent = "❌ Wrong!";
  }
});

playBtn2.addEventListener("click", () => {
  modal2.style.display = "flex";
  currentIndex2 = 0;
  nextWord2();
});

closeBtn2.addEventListener("click", () => {
  modal2.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === modal2) modal2.style.display = "none";
});
// theme modal
// ----------------- THEME SWITCHER -----------------
const themeMaster = document.getElementById("themeMaster");

if (themeMaster) {
  themeMaster.addEventListener("change", function () {
    const theme = this.value;

    if (theme === "light") {
      document.body.style.background = "linear-gradient(135deg, #ffffff 0%, #e6e6e6 100%)";
      document.body.style.color = "#000";
      document.querySelector(".header").style.background = "#f5f5f5";
    }
    else if (theme === "dark") {
      document.body.style.background = "linear-gradient(135deg, #1f1f1f 0%, #0d0d0d 100%)";
      document.body.style.color = "white";
      document.querySelector(".header").style.background = "#333";
    }
    else {
      document.body.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
      document.body.style.color = "#eaf2ff";
      document.querySelector(".header").style.background = "rgb(242, 246, 246)";
    }
  });
}
