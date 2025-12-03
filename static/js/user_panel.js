/********************************************
 * CUSTOM MODAL SYSTEM (NO BOOTSTRAP)
 ********************************************/
function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.style.display = "flex";
        document.body.style.overflow = "hidden";
    }
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.style.display = "none";
        document.body.style.overflow = "";
    }
}

/********************************************
 * GLOBAL VARIABLES
 ********************************************/
let excelRows = [];
let currentIndex = 0;
let records = [];

const FIELD_KEYS = [
    "invoice_no","item_name","qty","unit_rate","igst","cgst","sgst","total",
    "contact_person","company_name","state","gst_no",
    "invoice_date","description","warranty_details","warranty_end",
    "warranty_cc","address","pan_no","contact_phone","contact_email",
    "bank_acc","bank_ifsc","bank_name"
];

/********************************************
 * ADD INVOICE MODAL OPEN
 ********************************************/
document.getElementById("addInvoiceBtn").onclick = () => {
    excelRows = [];
    currentIndex = 0;
    clearForm();
    document.getElementById('modalFile').value = "";
    document.getElementById('docInput').value = "";
    openModal("addModal");
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
 * FILL FORM WITH EXCEL DATA
 ********************************************/
function fillForm(idx) {
    const row = excelRows[idx];
    FIELD_KEYS.forEach(k => {
        const el = document.getElementById("f_" + k);
        if (el) el.value = row[k] || "";
    });
}

/********************************************
 * PREV/NEXT BUTTONS
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
 * UPLOAD EXCEL
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
 * SAVE EXCEL ROWS
 ********************************************/
document.getElementById("saveModalBtn").onclick = async () => {

    if (excelRows.length === 0) {
        alert("No rows to save");
        return;
    }

    const docFile = document.getElementById("docInput").files[0];

    for (let i = 0; i < excelRows.length; i++) {

        let row = excelRows[i];
        let fd = new FormData();

        FIELD_KEYS.forEach(k => {
            fd.append(k, row[k] || "");
        });

        if (docFile) fd.append("doc", docFile);

        let res = await fetch("/save", {
            method: "POST",
            body: fd
        });

        let result = await res.json();

        if (!result.status) {
            alert(`Error saving row ${i + 1}: ${result.error}`);
            return;
        }
    }

    alert("✔ All invoice rows saved successfully!");

    closeModal("addModal");

    fetchUserRecords();
};


/********************************************
 * FETCH USER RECORDS
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

    let gstHTML = isUP
      ? `<strong>IGST:</strong> ${r.igst || 0}`
      : `<div><strong>SGST:</strong> ${r.sgst || 0}</div>
         <div><strong>CGST:</strong> ${r.cgst || 0}</div>`;

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
      <td>
        <button class="btn btn-sm editBtn" data-idx="${r.id}">✏ Edit</button>
        <button class="btn btn-sm showBtn" data-idx="${r.id}">📋 View Doc</button>
        <button class="btn btn-sm chartBtn" onclick="viewMore(${r.id})">📊 View All</button>
        <button class="btn btn-sm deleteBtn" data-id="${r.id}">🗑 Delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/********************************************
 * VIEW DOC
 ********************************************/
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.showBtn');
    if (btn) {
        window.open(`/invoice_doc/${btn.dataset.idx}`, "_blank");
    }
});

/********************************************
 * EDIT BUTTON
 ********************************************/
document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".editBtn");
    if (!btn) return;

    const id = btn.dataset.idx;

    const res = await fetch(`/get_invoice/${id}`);
    const data = await res.json();

    fillEditModal(data);

    openModal("editInvoiceModal");
});

/********************************************
 * FILL EDIT MODAL
 ********************************************/
function toInputDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toISOString().split("T")[0];
}

function fillEditModal(d) {
    FIELD_KEYS.forEach(k => {
        const el = document.getElementById("e_" + k);
        if (el) el.value = d[k] || "";
    });

    document.getElementById("editInvoiceModal").setAttribute("data-id", d.id);
}

/********************************************
 * SAVE EDITED DATA
 ********************************************/
document.getElementById("editSaveBtn").addEventListener("click", async () => {
    const id = document.getElementById("editInvoiceModal").getAttribute("data-id");

    let fd = new FormData();

    FIELD_KEYS.forEach(k => {
        fd.append(k, document.getElementById("e_" + k).value);
    });

    const file = document.getElementById("e_docInput").files[0];
    if (file) fd.append("document", file);

    const res = await fetch(`/edit_invoice/${id}`, {
        method: "POST",
        body: fd
    });

    const j = await res.json();

    if (j.success) {
        closeModal("editInvoiceModal");
        fetchUserRecords();
    } else {
        alert("Error updating invoice");
    }
});

/********************************************
 * DELETE
 ********************************************/
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.deleteBtn');
  if (!b) return;

  if (confirm("Delete invoice?")) {
    const res = await fetch(`/delete_invoice/${b.dataset.id}`, { method: "DELETE" });
    const j = await res.json();

    if (j.success) fetchUserRecords();
    else alert("Delete failed");
  }
});

/********************************************
 * SEARCH
 ********************************************/
document.getElementById("globalSearch").addEventListener("keyup", (e) => {
    if (e.key === "Enter") globalSearch();
});

async function globalSearch() {
  try {
    const q = document.getElementById("globalSearch").value.trim();

    if (!q) return fetchUserRecords();

    const res = await fetch(`/api/invoices/search?q=${encodeURIComponent(q)}`);
    const json = await res.json();

    renderTable(json.rows || []);
  } catch {
    renderTable([]);
  }
}

/********************************************
 * EXPORT FULL
 ********************************************/
document.getElementById('exportFullBtn').addEventListener('click', async () => {
    const res = await fetch('/export_all');
    if (!res.ok) return alert("Failed to download Excel");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "all_data.xlsx";
    a.click();

    URL.revokeObjectURL(url);
});

/********************************************
 * CUSTOM EXPORT MODAL OPEN
 ********************************************/
document.getElementById("exportCustomBtn").onclick = () => openModal("customExportModal");

/********************************************
 * FILTER FOR CUSTOM EXPORT
 ********************************************/
function filterRows(keyword, minId = 0) {
    const key = keyword.toLowerCase();
    return records.filter(r =>
        (r.invoice_no || "").toLowerCase().includes(key) ||
        (r.item_name || "").toLowerCase().includes(key) ||
        (r.company_name || "").toLowerCase().includes(key)
    );
}

function showDropdown(inputEl, dropdownEl, rows) {
    dropdownEl.innerHTML = "";
    dropdownEl.style.display = rows.length ? "block" : "none";

    rows.forEach(r => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.textContent = `${r.id} - ${r.invoice_no}`;
        item.onclick = () => {
            inputEl.value = r.id;
            dropdownEl.style.display = "none";
        };
        dropdownEl.appendChild(item);
    });
}

document.getElementById("startRowInput")
    .addEventListener("input", e => showDropdown(e.target, startDropdown, filterRows(e.target.value)));

document.getElementById("endRowInput")
    .addEventListener("input", e => showDropdown(e.target, endDropdown, filterRows(e.target.value)));

/********************************************
 * CREATE CUSTOM EXCEL
 ********************************************/
document.getElementById("createCustomExcel").onclick = async () => {

    const startId = parseInt(startRowInput.value);
    const endId = parseInt(endRowInput.value);

    if (!startId || !endId || endId <= startId)
        return alert("Invalid range");

    const res = await fetch('/export_custom', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: startId, end: endId })
    });

    if (!res.ok) return alert("Failed to generate file");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "custom_data.xlsx";
    a.click();

    URL.revokeObjectURL(url);
};

/********************************************
 * LOCKED MODAL
 ********************************************/
document.getElementById("lockedBtn").onclick = () => {
    loadLockedTable();
    openModal("lockedModal");
};

async function loadLockedTable() {
    const body = document.getElementById("lockedBody");
    body.innerHTML = "";

    const res = await fetch(`/get_locked_records/${USER_ID}`);
    const rows = await res.json();

    rows.forEach(r => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${r.invoice_no}</td>
            <td>${r.gst_no}</td>
            <td>${r.invoice_date}</td>
            <td>${r.contact_person}</td>
            <td>${r.state}</td>
            <td>${r.contact_mobile}</td>
            <td>${r.contact_email}</td>
            <td>
                <button class="unlockBtn btn btn-sm" data-id="${r.id}">🔓 Unlock</button>
            </td>
        `;

        body.appendChild(tr);
    });
}

document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".unlockBtn");
    if (!btn) return;

    const res = await fetch(`/unlock_invoice/${btn.dataset.id}`, { method: "POST" });
    const j = await res.json();

    if (j.success) {
        loadLockedTable();
        fetchUserRecords();
    }
});

/********************************************
 * GAME MODAL (your original code kept)
 ********************************************/
const words2 = [
    "game","write","cool","app","tree","type","free","submit","task","brave",
    "good","allow","audit","extra","budget","profit","expense","print","flow",
    "project","software","hardware","leader","key","honest","search","tracking",
    "reverse","manager","report","system","data","network","security","storage",
    "backup","old","user","password","email","database","server","website",
    "design","analysis","testing","support","developer","place","joker",
    "update","logic","speed","client","provider","resource","team","meeting",
    "schedule","goal","objective","training","feedback","productivity",
    "innovation","strategy","planning","execution","leadership","column",
    "communication","market","sales","brand","promotion","advertisement",
    "customer","growth","target","competition","product","service","solution",
    "feature","quality","design","experience","review","rating","satisfaction",
    "engagement","trend","vision","mission","value","culture","ethics",
    "teamwork","creativity","winner"
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
  progressEl2.textContent = `Word ${currentIndex2 + 1} of ${words2.length}`;
}

submitBtn2.onclick = () => {
  const answer = userAnswer2.value.trim().toLowerCase();
  if (answer === words2[currentIndex2].toLowerCase()) {
    messageEl2.style.color = "#28a745";
    messageEl2.textContent = "Correct!";
    currentIndex2++;
    setTimeout(nextWord2, 1500);
  } else {
    messageEl2.style.color = "#dc3545";
    messageEl2.textContent = "Wrong!";
  }
};

playBtn2.onclick = () => {
  modal2.style.display = "flex";
  currentIndex2 = 0;
  nextWord2();
};

closeBtn2.onclick = () => modal2.style.display = "none";

window.onclick = (e) => {
  if (e.target === modal2) modal2.style.display = "none";
};

/********************************************
 * THEME SWITCHER
 ********************************************/
const themeMaster = document.getElementById("themeMaster");

if (themeMaster) {
  themeMaster.addEventListener("change", function () {
    const theme = this.value;

    if (theme === "light") {
      document.body.style.background = "linear-gradient(135deg, #ffffff, #e6e6e6)";
      document.body.style.color = "#000";
    }
    else if (theme === "dark") {
      document.body.style.background = "linear-gradient(135deg, #1f1f1f, #0d0d0d)";
      document.body.style.color = "#fff";
    }
    else {
      document.body.style.background = "linear-gradient(135deg, #667eea, #764ba2)";
      document.body.style.color = "#eaf2ff";
    }
  });
}
