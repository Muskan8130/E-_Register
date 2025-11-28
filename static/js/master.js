 // Toggle user table section
    document.getElementById('openUsersSection').addEventListener('click', () => {
      console.log("clicked");

      document.getElementById('usersSection').style.display = 'block';
      fetchUsers();
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });

document.getElementById("globalSearch").addEventListener("keyup", (e) => {
  if (e.key === "Enter") globalSearch();
});


  // --- Debounce helper for typing ---
function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// --- Debounced live search function (will call globalSearch) ---
const debouncedGlobalSearch = debounce(() => {
  page = 1;
  globalSearch();
}, 300);

 async function fetchUsers() {
  try {
    const res = await fetch(`/api/users`);
    const json = await res.json();
    if (json.status !== "ok") return;
    renderTable(json.rows);
  } catch (err) {
    console.error("Error fetching users:", err);
  }
}

  function renderTable(rows) {
  const tbody = document.getElementById('usersTbody');
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">No users found</td></tr>';
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.s_no}</td>
      <td>${r.user_id || ''}</td>
      <td>${r.role || ''}</td>
      <td>${r.created_at || ''}</td>
      <td>${r.last_used_at || ''}</td>
      <td>${r.last_action || ''}</td>
      <td class="actions-btns">
        <button class="btn btn-sm btn-primary" onclick="openEdit(${r.id}, '${escapeHtml(r.user_id)}')">Edit</button>
        <button class="btn btn-sm btn-info" onclick="showUserData(${r.id})">Show Data</button>
        <button class="btn btn-sm btn-warning" onclick="showChart(${r.id})">View Chart</button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser(${r.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
    // edit user
    // Open edit modal
function openEdit(id, username) {
  document.getElementById('edit_id').value = id;
  document.getElementById('edit_username').value = username;
  document.getElementById('edit_password').value = '';
  document.getElementById('editMsg').innerHTML = '';
  var modal = new bootstrap.Modal(document.getElementById('editModal'));
  modal.show();
}

// Handle form submission (username/password/role update)
document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit_id').value;
  const form = new FormData(e.target);

  try {
    const res = await fetch(`/api/users/${id}`, { method: 'POST', body: form });
    const json = await res.json();
    document.getElementById('editMsg').innerHTML =
      json.status === 'ok'
        ? `<div style="background:#d4edda; color:#155724; padding:10px; 
               border-radius:8px; border:1px solid #c3e6cb; font-weight:bold;">
    Saved
  </div>`
        : `<div class="alert alert-danger">${json.message}</div>`;

    setTimeout(() => {
      var modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
      if (modal) modal.hide();
      fetchUsers();
    }, 700);
  } catch (err) {
    console.error('Error saving user:', err);
  }
});

    async function deleteUser(id) {
      if (!confirm('Delete this user?')) return;
      const res = await fetch(`/master/user/${id}/delete`, { method:'POST' });
      const json = await res.json();
      fetchUsers();
    }

    function showUserData(id) {
      window.location.href = ` /user/${id}`;
    }

   async function showChart(id) {
  try {
    const res = await fetch(`/api/user/${id}/counts`);
    const json = await res.json();
    if (json.status !== 'ok') return;

    const userCnt = json.user_count || 0;
    const totalCnt = json.total_count || 0;
    const othersCnt = Math.max(totalCnt - userCnt, 0);

    const modal = new bootstrap.Modal(document.getElementById('chartModal'));
    modal.show();

    const ctx = document.getElementById('userChart').getContext('2d');
    if (window._userChart) window._userChart.destroy();

    window._userChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['This User', 'Other Users'],
        datasets: [{
          data: [userCnt, othersCnt],
          backgroundColor: ['#4e79a7', '#f28e2b'],
        }]
      },
      options: {
        plugins: {
          legend: { display: true, labels: { color: '#fff' } },
          title: {
            display: true,
            text:` Invoice Distribution (${userCnt}/${totalCnt})`,
            color: '#fff'
          }
        }
      }
    });

    document.getElementById('chartMsg').innerText =
     ` This user has ${userCnt} invoices out of ${totalCnt} total.`;
  } catch (err) {
    console.error('Chart error:', err);
    document.getElementById('chartMsg').innerText = 'Error loading chart data.';
  }
}


    function escapeHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

async function globalSearch() {
  try {
    const q = (document.getElementById("globalSearch").value || '').trim();

    // if empty, call fetchUsers() to restore full (unfiltered) table
    if (!q) {
      page = 1;
      return fetchUsers(page);
    }

    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    const json = await res.json();

    // Support both response shapes:
    // 1) { status: "ok", rows: [...] } OR
    // 2) { total: X, rows: [...] } OR  { total, rows } without status
    const rows = json.rows || [];
    if (rows.length === 0) {
      document.getElementById("usersTbody").innerHTML = "<tr><td colspan='7'>No users found</td></tr>";
    } else {
      renderTable(rows);
    }
  } catch (err) {
    console.error("Search error:", err);
    document.getElementById("usersTbody").innerHTML = "<tr><td colspan='7'>Error searching users</td></tr>";
  }
}

    // create user
  async function createUser() {
  const userid = document.querySelector('#createUserForm [name="userid"]').value.trim();
  const password = document.querySelector('#createUserForm [name="password"]').value.trim();
  const msgDiv = document.getElementById("createUserMsg");

  if (!userid || !password) {
    msgDiv.innerHTML = '<div class="alert alert-warning">Please fill all fields</div>';
    return;
  }

  msgDiv.innerHTML = '<div class="alert alert-info">Creating user...</div>';

  const formData = new FormData();
  formData.append("userid", userid);
  formData.append("password", password);

  try {
    const res = await fetch("/master/create_user", {
      method: "POST",
      body: formData
    });

    const result = await res.json();

    if (result.status === "success") {
      msgDiv.innerHTML = `<div class="alert alert-success">${result.message}</div>`;
      document.getElementById("createUserForm").reset();

      setTimeout(() => {
        const modal = bootstrap.Modal.getInstance(document.getElementById("createUserModal"));
        modal.hide();
        fetchUsers(); // refresh the table (if defined elsewhere)
      }, 1000);
    } else {
      msgDiv.innerHTML =` <div class="alert alert-danger">${result.message}</div>`;
    }
  } catch (error) {
    console.error(error);
    msgDiv.innerHTML = '<div class="alert alert-danger">Server error — please try again.</div>';
  }
}

// 🔸 Clear old message whenever modal opens
document.getElementById("createUserModal").addEventListener("show.bs.modal", () => {
    document.getElementById("createUserMsg").innerHTML = "";   // removes previous success/error
    document.getElementById("createUserForm").reset();         // optional → clears inputs too
});


document.getElementById("lockedBtn").addEventListener("click", () => {
    let modal = new bootstrap.Modal(document.getElementById("lockedModal"));
    loadLockedTable();
    modal.show();
});

// Load locked table rows from existing records[]
async function loadLockedTable() {
    const body = document.getElementById("lockedBody");
    body.innerHTML = "";

    const res = await fetch(`/get_locked_record`); 
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
        `;

        body.appendChild(tr);
    });
}
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

   