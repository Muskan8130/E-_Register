
// Client-side validation is basic, Flask handles the real security check.
(function() {
 const form = document.querySelector('form');
 form.addEventListener('submit', (e) => {
 const uid = document.querySelector('input[name="user_id"]').value.trim();
 const pwd = document.querySelector('input[name="password"]').value;
 
        // This is mainly a UX check to prevent empty submissions
 if (!uid || !pwd) {
 e.preventDefault();
 alert('Please enter both User ID and Password. ');
}
});
 })();
 //---------------------------------new them script-----------------------------------/
// Theme change feature
const themeSelect = document.getElementById("theme");
const body = document.body;

themeSelect.addEventListener("change", (e) => {
  const value = e.target.value;
if (value === "light") {
    body.style.background = "linear-gradient(135deg, #e7d8ff 0%, #f3d1dc 100%)";
    body.style.color = "#2c1f33";
    document.querySelector(".card").style.background = "linear-gradient(135deg, #f8e9ff, #f5d9e5)";
    document.querySelector(".card").style.color = "#2c1f33";

    // Input, label aur placeholder ke colors fix
    document.querySelectorAll("input, textarea, select").forEach(el => {
        el.style.backgroundColor = "#f7eff9";   // halki lavender background
        el.style.color = "#2c1f33";             // dark readable text
        el.style.border = "1px solid #c3a4d6";  // soft border
    });

    document.querySelectorAll("label").forEach(el => {
        el.style.color = "#2c1f33"; // label clearly visible
    });
}

  else if (value === "dark") {
    body.style.background = "linear-gradient(135deg, #000000 0%, #232526 100%)";
    body.style.background = "linear-gradient(135deg, #2a2d35 0%, #3b4252 100%)";
    body.style.color = "#fff";
    document.querySelector(".card").style.background = "linear-gradient(135deg, #3a3a3a, #555)";
    document.querySelector(".card").style.color = "#fff";
     // Input, label aur placeholder ke colors fix
    document.querySelectorAll("input, textarea, select").forEach(el => {
        el.style.backgroundColor = "white";   // halki lavender background
        el.style.color = "#2c1f33";             // dark readable text
        el.style.border = "1px solid #c3a4d6";  // soft border
    });

    document.querySelectorAll("label").forEach(el => {
        el.style.color = "black"; // label clearly visible
    });
  } 
  else {
    // Default theme (your original one)
    body.style.background = "linear-gradient(135deg, #182848 0%, #4b6cb7 100%)";
    body.style.color = "#eaf2ff";
    document.querySelector(".card").style.background = "linear-gradient(135deg, #2c4573 0%, #5384f7 100%)";
    document.querySelector(".card").style.color = "#e0e0e0";
  }
});
 //---------------------------------new them script-----------------------------------/
 //----------------------------game-------------------------------------------/
 const words = [
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

    let currentIndex = 0;
    let scrambled = "";

    const modal = document.getElementById("gameModal");
    const playBtn = document.getElementById("playGameBtn");
    const closeBtn = document.querySelector(".close");
    const scrambledWordEl = document.getElementById("scrambledWord");
    const userAnswer = document.getElementById("userAnswer");
    const submitBtn = document.getElementById("submitBtn");
    const messageEl = document.getElementById("message");
    const progressEl = document.getElementById("progress");

    // Shuffle Word Function
    function shuffle(word) {
      const arr = word.split("");
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr.join("");
    }

    // Load Next Word
    function nextWord() {
      if (currentIndex >= words.length) {
        scrambledWordEl.textContent = "---";
        messageEl.style.color = "#007bff";
        messageEl.textContent = "🎉 You solved all the words!";
        userAnswer.style.display = "none";
        submitBtn.style.display = "none";
        progressEl.textContent = `Completed ${words.length}/${words.length}`;
        return;
      }

      const word = words[currentIndex];
      scrambled = shuffle(word);
      if (scrambled === word) scrambled = shuffle(word);
      scrambledWordEl.textContent = scrambled;
      userAnswer.value = "";
      messageEl.textContent = "";
      progressEl.textContent = `Word ${currentIndex + 1} of ${words.length}`;
      userAnswer.focus();
    }

    // Submit Answer
    submitBtn.addEventListener("click", () => {
      const answer = userAnswer.value.trim().toLowerCase();
      if (answer === words[currentIndex].toLowerCase()) {
        messageEl.style.color = "#28a745";
        messageEl.textContent = "✅ Congratulations! Correct!";
        currentIndex++;
        setTimeout(nextWord, 1500);
      } else {
        messageEl.style.color = "#dc3545";
        messageEl.textContent = "❌ Wrong! Try again.";
      }
    });

    // Modal Controls
    playBtn.addEventListener("click", () => {
      modal.style.display = "flex";
      currentIndex = 0;
      nextWord();
    });

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });

    userAnswer.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitBtn.click();
    });