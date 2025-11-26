 let page = 1, per_page = 10, total = 0;

async function fetchInv() {
  const q = document.getElementById('globalQ').value.trim();
  const res = await fetch(`/api/invoices?page=${page}&per_page=${per_page}&q=${encodeURIComponent(q)}`);
  const j = await res.json();
  total = j.total;

  console.log('Fetched invoices:', j);

  const tbody = document.getElementById('invTbody');
  tbody.innerHTML = '';

  j.rows.forEach((r) => {

    // Detect UP state
    const st = (r.state || '').toLowerCase().trim();
    const isUP = (st === 'up' || st === 'uttar pradesh' || st === 'uttarpradesh');

    // Dynamic GST HTML for a single column
    let gstHTML = "";
    if (isUP) {
      gstHTML = `<strong>IGST:</strong> ${r.igst || 0}`;
    } else {
      gstHTML = `
        <div><strong>SGST:</strong> ${r.sgst || 0}</div>
        <div><strong>CGST:</strong> ${r.cgst || 0}</div>
      `;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.s_no || ''}</td>
      <td>${r.invoice_no || ''}</td>
      <td>${r.item_name || ''}</td>
      <td>${r.qty || ''}</td>
      <td>${r.unit_rate || ''}</td>

      <!-- SINGLE GST Column -->
      <td>${gstHTML}</td>

      <td>${r.total || ''}</td>
      <td>${r.contact_person || ''}</td>
      <td>${r.company_name || ''}</td>
      <td>${r.state || ''}</td>
      <td>${r.gst_no || ''}</td>

      <td>
        <button class="btn btn-sm btn-info" onclick="viewDoc(${r.id})">View Doc</button>
        <button class="btn btn-sm btn-secondary" onclick="viewMore(${r.id})">View More</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  renderPager();
}


function renderPager() {
  const pages = Math.ceil(total / per_page) || 1;
  const p = document.getElementById('invPager');
  p.innerHTML = '';
  for (let i = 1; i <= pages; i++) {
    const li = document.createElement('li');
    li.className =` page-item ${i === page ? 'active' : ''}`;
    li.innerHTML = `<a href="#" class="page-link" onclick="goto(${i});return false;">${i}</a>`;
    p.appendChild(li);
  }
}

function goto(p) { page = p; fetchInv(); }

async function viewDoc(id) {
  window.open(`/invoice/doc/${id}, '_blank'`);
}

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


document.getElementById('globalQ').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') { page = 1; fetchInv(); }
});

fetchInv();