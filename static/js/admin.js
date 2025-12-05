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
      const res = await fetch(`/admin/user/${id}/delete`, { method:'POST' });
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
    const res = await fetch("/admin/create_user", {
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
// theme modal
// ----------------- THEME SWITCHER -----------------
// ----------------- FULL THEME SWITCHER -----------------
const themeadmin = document.getElementById("themeadmin");

function applyLightTheme() {
    // Body + Header
    document.body.style.background = "linear-gradient(135deg, #cfd8ffff 0%, #f2f6ffff 100%)";
    document.body.style.color = "black";
    document.querySelector(".header").style.background = "#e9efff";

    // BOXES
    document.querySelectorAll(".box").forEach(box => {
        box.style.backgroundColor = "#dbd1d1ff";
        box.style.color = "#000";
        box.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)";
    });

    // CARDS
    document.querySelectorAll(".card").forEach(card => {
        card.style.background = "#ebe2e2ff";
        card.style.color = "#000";
    });

    // TABLE HEADER
    document.querySelectorAll(".table thead th").forEach(th => {
        th.style.background = "#cedaf3ff";
        th.style.color = "#000";
    });

    // TABLE ROWS
    document.querySelectorAll(".table tbody td").forEach(td => {
        td.style.background = "#d6ccccff";
        td.style.color = "#000";
    });

    // MODALS
    document.querySelectorAll(".modal-content").forEach(modal => {
        modal.style.background = "#ffffff";
        modal.style.color = "#000";
    });

    // INPUTS
    document.querySelectorAll(".form-control").forEach(inp => {
        inp.style.background = "#ffffff";
        inp.style.color = "#000";
        inp.style.border = "1px solid #ccc";
    });
}

function applyDarkTheme() {
    // Body + Header
    document.body.style.background = "linear-gradient(135deg, #756d6dff 0%, #1c1c1c 100%)";
    document.body.style.color = "#f1f1f1";
    document.querySelector(".header").style.background = "#807b7bff";

    // BOXES
    document.querySelectorAll(".box").forEach(box => {
        box.style.backgroundColor = "#9c9191ff";
        box.style.color = "#f1f1f1";
        box.style.boxShadow = "0 10px 25px rgba(255,255,255,0.08)";
    });

    // CARDS
    document.querySelectorAll(".card").forEach(card => {
        card.style.background = "#292929";
        card.style.color = "#f1f1f1";
    });

    // TABLE HEADER
    document.querySelectorAll(".table thead th").forEach(th => {
        th.style.background = "#7c7575ff";
        th.style.color = "#ffffff";
    });

    // TABLE ROWS
    document.querySelectorAll(".table tbody td").forEach(td => {
        td.style.background = "#757070ff";
        td.style.color = "#e5e5e5";
    });

    // MODALS
    document.querySelectorAll(".modal-content").forEach(modal => {
        modal.style.background = "#7d7676ff";
        modal.style.color = "#f1f1f1";
    });

    // INPUTS
    document.querySelectorAll(".form-control").forEach(inp => {
        inp.style.background = "#857d7dff";
        inp.style.color = "#f1f1f1";
        inp.style.border = "1px solid #555";
    });
}

function applyDefaultTheme() {
    // Body + Header
    document.body.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    document.body.style.color = "#eaf2ff";
    document.querySelector(".header").style.background = "rgb(242, 246, 246)";

    // BOXES
    document.querySelectorAll(".box").forEach(box => {
        box.style.backgroundColor = "rgb(241,253,255)";
        box.style.color = "#151414";
        box.style.boxShadow = "0 10px 25px rgba(0,0,0,0.25)";
    });

    // CARDS
    document.querySelectorAll(".card").forEach(card => {
        card.style.background = "rgba(82,82,181)";
        card.style.color = "#fff";
    });

    // TABLE HEADER
    document.querySelectorAll(".table thead th").forEach(th => {
        th.style.background = "rgb(167,201,249)";
        th.style.color = "#121213";
    });

    // TABLE ROWS
    document.querySelectorAll(".table tbody td").forEach(td => {
        td.style.background = "rgb(244,250,252)";
        td.style.color = "#000";
    });

    // MODALS (reset to your original dark modal)
    document.querySelectorAll(".modal-content").forEach(modal => {
        modal.style.background = "";
        modal.style.color = "";
    });

    // INPUTS
    document.querySelectorAll(".form-control").forEach(inp => {
        inp.style.background = "rgba(255,255,255,0.1)";
        inp.style.color = "#e8efff";
        inp.style.border = "1px solid rgba(255,255,255,0.2)";
    });
}

if (themeadmin) {
    themeadmin.addEventListener("change", () => {
        const theme = themeadmin.value;

        if (theme === "dark") applyDarkTheme();
        else if (theme === "light") applyLightTheme();
        else applyDefaultTheme();
    });
}
