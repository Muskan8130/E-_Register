/********************************************
 * PURE JS MODALS (No Bootstrap)
 ********************************************/
const addModal = document.getElementById("addModal");
const editModal = document.getElementById("editInvoiceModal");
const customExportModal = document.getElementById("customExportModal");
const lockedModal = document.getElementById("lockedModal");

function openAddModal() { addModal.classList.add("active"); }
function closeAddModal() { addModal.classList.remove("active"); }

function openEditModal() { editModal.classList.add("active"); }
function closeEditModal() { editModal.classList.remove("active"); }

function openCustomExportModal() {
    customExportModal.classList.add("active");
    loadInvoicesForExport();   // safe
}

function closeCustomExportModal() {
    customExportModal.classList.remove("active");
}
document.addEventListener("DOMContentLoaded", function () {

    const btn = document.getElementById("exportCustomBtn");

    btn.addEventListener("click", function () {
        openCustomExportModal();
    });

});

function openLockedModal() { lockedModal.classList.add("active"); }
function closeLockedModal() { lockedModal.classList.remove("active"); }

// CLICK OUTSIDE CLOSE
window.addEventListener("click", (e) => {
    if (e.target === addModal) closeAddModal();
    if (e.target === editModal) closeEditModal();
    if (e.target === customExportModal) closeCustomExportModal();
    if (e.target === lockedModal) closeLockedModal();
});



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

// === UPDATE excelRows WHEN USER EDITS ANY INPUT ===
FIELD_KEYS.forEach(k => {
    const el = document.getElementById("f_" + k);
    if (el) {
        el.addEventListener("input", () => {
            if (excelRows[currentIndex]) {
                excelRows[currentIndex][k] = el.value;
            }
        });
    }
});



/********************************************
 * ADD INVOICE – OPEN MODAL
 ********************************************/
document.getElementById("addInvoiceBtn").onclick = () => {
    excelRows = [];
    currentIndex = 0;
    clearForm();
    document.getElementById('modalFile').value = "";
    document.getElementById('docInput').value = "";
    openAddModal();
};



/********************************************
 * FILL FORM FROM EXCEL ROW
 ********************************************/
function fillForm(idx) {
    const row = excelRows[idx];
    FIELD_KEYS.forEach(k => {
        const el = document.getElementById("f_" + k);
        if (el) el.value = row[k] || "";
    });
}



/********************************************
 * PREVIOUS / NEXT BUTTONS
 ********************************************/
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



/********************************************
 * CLEAR FORM
 ********************************************/
function clearForm() {
    FIELD_KEYS.forEach(k => {
        const el = document.getElementById("f_" + k);
        if (el) el.value = "";
    });
}



/********************************************
 * UPLOAD EXCEL FILE
 ********************************************/
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

 /********************************************
     * SAVE ALL EXCEL ROWS ONE BY ONE
     ********************************************/

document.getElementById("saveModalBtn").onclick = async () => {

   
    let res1 = await fetch("/save_rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: excelRows })
    });

    let data = await res1.json();
    let row_ids = data.row_ids;   // server returns DB inserted IDs


    const files = document.getElementById("docInput").files;

    for (let i = 0; i < files.length; i++) {

        let fd = new FormData();
        fd.append("file", files[i]);
        fd.append("row_id", row_ids[i]);  // match file to DB row

        await fetch("/upload_doc", {
            method: "POST",
            body: fd
        });
    }

    alert("✔ All invoices saved successfully!");
    closeAddModal();
    fetchUserRecords();
};


/********************************************
 * LOAD TABLE AFTER PAGE LOAD
 ********************************************/
document.addEventListener('DOMContentLoaded', fetchUserRecords);

async function fetchUserRecords() {
  try {
    const res = await fetch('/get_user_records');
    const data = await res.json();

    document.getElementById("totalCount").textContent = data.total ?? 0;

    records = data.rows || [];
    renderTable(records);

  } catch (err) {
    console.error('Error loading data:', err);
    document.getElementById("totalCount").textContent = "0";
    renderTable([]);
  }
}



/********************************************
 * RENDER TABLE
 ********************************************/
function renderTable(rows = []) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10">No users found</td></tr>';
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement('tr');

    const st = (r.state || '').toLowerCase().trim();
    const isUP = (st === 'up' || st === 'uttar pradesh' || st === 'uttarpradesh');

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
      <td>${gstHTML}</td>
      <td>${r.total || ''}</td>
      <td>${r.contact_person || ''}</td>
      <td>${r.company_name || ''}</td>
      <td>${r.state || ''}</td>
      <td>${r.gst_no || ''}</td>

      <td class="actions-btns">
        <button class="btn btn-sm editBtn" data-idx="${r.id}">✏ Edit</button>
        <button class="btn btn-sm showBtn" data-idx="${r.id}">📋 View Doc</button>
        <button class="btn btn-sm chartBtn" onclick="viewMore(${r.id})">📊 View All Data</button>
        <button class="btn btn-sm deleteBtn" data-id="${r.id}">🗑 Delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}



/********************************************
 * VIEW DOCUMENT
 ********************************************/
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.showBtn');
    if (btn) {
        const id = btn.dataset.idx;
        window.open(`/invoice_doc/${id}`, "_blank");
    }
});



/********************************************
 * CLICK EDIT BUTTON → OPEN EDIT MODAL
 ********************************************/
document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".editBtn");
    if (!btn) return;

    const id = btn.dataset.idx;

    const res = await fetch(`/get_invoice/${id}`);
    const data = await res.json();

    fillEditModal(data);

    openEditModal();
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

    editModal.setAttribute("data-id", d.id);
}



/********************************************
 * UPDATE INVOICE
 ********************************************/
document.getElementById("editSaveBtn").addEventListener("click", async () => {

    const id = editModal.getAttribute("data-id");

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

    const file = document.getElementById("e_docInput").files[0];
    if (file) formData.append("document", file);

    const res = await fetch(`/edit_invoice/${id}`, {
        method: "POST",
        body: formData
    });

    const result = await res.json();

    if (result.success) {
        location.reload();
    } else {
        alert("Error updating invoice");
    }
});



/********************************************
 * VIEW MORE (ALERT DETAILS)
 ********************************************/
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



/********************************************
 * DELETE BUTTON
 ********************************************/
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.deleteBtn');
  if (b) {
    const recordId = b.dataset.id;

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



/********************************************
 * GLOBAL SEARCH
 ********************************************/
document.getElementById("globalSearch").addEventListener("keyup", (e) => {
    if (e.key === "Enter") globalSearch();
});

async function globalSearch() {
  try {
    const q = (document.getElementById("globalSearch").value || '').trim();

    if (!q) {
      page = 1;
      return fetchUserRecords(page);
    }

    const res = await fetch(`/api/invoices/search?q=${encodeURIComponent(q)}`);
    const json = await res.json();

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



/********************************************
 * EXPORT FULL EXCEL
 ********************************************/
document.getElementById('exportFullBtn').addEventListener('click', async () => {

    const res = await fetch('/export_all', { method: 'GET' });

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



/********************************************
 * OPEN CUSTOM EXPORT MODAL
 ********************************************/
document.getElementById("createCustomExcel")
  .addEventListener("click", function () {

    const checked = document.querySelectorAll(
        "#invoiceList input:checked"
    );

    if (checked.length === 0) {
        alert("Please select at least one invoice");
        return;
    }

    const ids = Array.from(checked).map(cb => cb.value);

    fetch("/export_custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids })
    })
    .then(res => res.blob())
    .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "custom_invoices.xlsx";
        a.click();
        URL.revokeObjectURL(url);
    });
});



function loadInvoicesForExport() {
    fetch("/get_export_invoices")
        .then(res => res.json())
        .then(data => {

            const list = document.getElementById("invoiceList");
            list.innerHTML = "";

            data.forEach(row => {

                const div = document.createElement("div");
                div.className = "invoice-row";

                div.innerHTML = `
                    <input type="checkbox" value="${row.id}">
                    <span style= "color:black;">
                      <strong>${row.invoice_no}</strong> |
                      ${row.company_name} |
                      ${row.item_name} |
                      GST: ${row.gst_no}
                    </span>
                `;

                // click anywhere to toggle checkbox
                div.addEventListener("click", function (e) {
                    if (e.target.tagName !== "INPUT") {
                        const cb = div.querySelector("input");
                        cb.checked = !cb.checked;
                    }
                });

                list.appendChild(div);
            });

        });
}



/********************************************
 * LOCKED MODAL (BIN)
 ********************************************/
document.getElementById("lockedBtn").addEventListener("click", () => {
    loadLockedTable();
    openLockedModal();
});

async function loadLockedTable() {
    const body = document.getElementById("lockedBody");
    body.innerHTML = "";

    const res = await fetch(`/get_locked_records/${USER_ID}`);
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
                <button class="btn btn-sm unlockBtn" data-id="${r.id}">
                    🔓 Unlock
                </button>
            </td>
        `;

        body.appendChild(tr);
    });
}

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
            loadLockedTable();
            fetchUserRecords();
        }
    }
});



/********************************************
 * GAME MODAL
 ********************************************/
const words2 = [
  "game","write","cool","app","box", "mix","task","film", "bank",
  "sky", "gym",  "wax",  "zip", "owl", "jog",
   "bulb", "cube", "knot", "zinc", "quiz", ,"stamp", "poker", 
   "glove", "brick", "yield", "quartz", , "zebra", "mango", 
   "steam","galaxy","oxygen","pocket","temple","velvet","market",
   "dragon","simple","random","parent","plastic","pumpkin",
   "digital","freedom","victory","blanket","journey","harvest","modesty",
   "old","user","team","winner","email",,"developer","place","joker",
   "update","logic","speed","client","provider","resource","team","brand",
   "promotion","advertisement","customer","growth","target",
   "product","service",,"solution","feature","quality","design",
    "experience","review","rating","trend",
    "experience","review","rating","satisfaction","engagement","trend",
    "vision","mission","value","culture","ethics","teamwork",
    "flow","project","software","hardware","leader"
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



/********************************************
 * THEME SWITCHER
 ********************************************/
/********************************************
 * THEME SYSTEM — EXACT SAME AS admin PAGE
 * NO CSS REQUIRED — ONLY PURE JS
 ********************************************/
const themeadmin = document.getElementById("themeadmin");

// Apply saved theme when page loads
document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem("userTheme") || "default";
    themeadmin.value = savedTheme;
    applyTheme(savedTheme);
});

// Watch for dropdown change
if (themeadmin) {
    themeadmin.addEventListener("change", function () {
        applyTheme(this.value);
        localStorage.setItem("userTheme", this.value);
    });
}

// Main theme function
function applyTheme(theme) {

    if (theme === "light") {

        document.body.style.background = "#f0f0f0";
        document.body.style.color = "#000";

        document.querySelector(".topbar").style.background = "#d4eeeeff";
        document.querySelector(".topbar").style.color = "#000";

        document.querySelectorAll(".box").forEach(b => {
            b.style.background = "#f6dcf4ff";
            b.style.color = "#000";
            b.style.boxShadow = "0 2px 10px rgba(0,0,0,0.15)";
        });

        document.querySelectorAll("table thead th").forEach(th => {
            th.style.background = "#ecccecff";
            th.style.color = "#000";
        });

        document.querySelectorAll("table tbody td").forEach(td => {
            td.style.background = "#ffffff";
            td.style.color = "#000";
        });
    }

    else if (theme === "dark") {

        document.body.style.background = "#1a1a1a";
        document.body.style.color = "#ffffff";

        document.querySelector(".topbar").style.background = "#908989ff";
        document.querySelector(".topbar").style.color = "#ffffff";

        document.querySelectorAll(".box").forEach(b => {
            b.style.background = "#655c5cff";
            b.style.color = "#ffffff";
            b.style.boxShadow = "0 2px 10px rgba(255,255,255,0.1)";
        });

        document.querySelectorAll("table thead th").forEach(th => {
            th.style.background = "#444444";
            th.style.color = "#ffffff";
        });

        document.querySelectorAll("table tbody td").forEach(td => {
            td.style.background = "#2a2a2a";
            td.style.color = "#f5f0f0ff";
        });
    }

    else {
        // DEFAULT (same as admin page)
        document.body.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
        document.body.style.color = "#eaf2ff";

        document.querySelector(".topbar").style.background = "white";
        document.querySelector(".topbar").style.color = "black";

        document.querySelectorAll(".box").forEach(b => {
            b.style.background = "#ffffff";
            b.style.color = "#000";
            b.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
        });

        document.querySelectorAll("table thead th").forEach(th => {
            th.style.background = "rgb(167,201,249)";
            th.style.color = "#121213";
        });

        document.querySelectorAll("table tbody td").forEach(td => {
            td.style.background = "rgb(244,250,252)";
            td.style.color = "#000";
        });
    }
}
