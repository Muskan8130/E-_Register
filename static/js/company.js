/* ------------------ DEMO DATA (You can load from backend later) ------------------ */
let companies = JSON.parse(localStorage.getItem("companies_list")) || [
  {
    name: "Infosys",
    address: "Electronic City, Bangalore",
    state: "Karnataka",
    contact: "9876543210"
  },
  {
    name: "Tata Consultancy",
    address: "Andheri East, Mumbai",
    state: "Maharashtra",
    contact: "9988776655"
  }
];

/* ------------------ SAVE DATA ------------------ */
function saveCompanies() {
  localStorage.setItem("companies_list", JSON.stringify(companies));
}

/* ------------------ LOAD TABLE ------------------ */
function loadCompanyTable(list = companies) {
  const tbody = document.querySelector("#companyTable tbody");
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = "<tr><td colspan='5'>No companies found</td></tr>";
    return;
  }

  list.forEach((c, i) => {
    let tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.address}</td>
      <td>${c.state}</td>
      <td>${c.contact}</td>
      <td><button class="action-btn" onclick="viewCompany(${i})">View Data</button></td>
    `;

    tbody.appendChild(tr);
  });
}

/* ------------------ VIEW COMPANY DATA ------------------ */
function viewCompany(index) {
  let c = companies[index];
  alert(`
Company Name: ${c.name}
Address: ${c.address}
State: ${c.state}
Contact: ${c.contact}
  `);
}

/* ------------------ GLOBAL SEARCH ------------------ */
document.getElementById("companySearch").addEventListener("input", (e) => {
  const text = e.target.value.toLowerCase();

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(text) ||
    c.address.toLowerCase().includes(text) ||
    c.state.toLowerCase().includes(text) ||
    c.contact.toLowerCase().includes(text)
  );

  loadCompanyTable(filtered);
});

/* ------------------ BACK BUTTON ------------------ */
function goBack() {
  window.history.back();
}

/* ------------------ INITIAL LOAD ------------------ */
loadCompanyTable();
