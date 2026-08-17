/* ម៉ឺនុយសម្រាប់ទូរស័ព្ទ */
const menuBtn = document.getElementById("menuBtn");
const mainNav = document.getElementById("mainNav");

menuBtn?.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(open));
});

document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuBtn?.setAttribute("aria-expanded", "false");
  });
});

/* ពន្លឺ / ងងឹត */
const themeToggle = document.getElementById("themeToggle");
const themeMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  themeToggle?.setAttribute("aria-pressed", String(isDark));
  themeMeta?.setAttribute("content", isDark ? "#071321" : "#fffaf2");
  localStorage.setItem("asl-theme", theme);
}

const savedTheme = localStorage.getItem("asl-theme");
if (savedTheme) {
  applyTheme(savedTheme);
} else {
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

themeToggle?.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark-mode");
  applyTheme(isDark ? "light" : "dark");
});

/* វីដេអូណែនាំ */
const modal = document.getElementById("introModal");
const watchIntro = document.getElementById("watchIntro");
const closeModal = document.querySelector(".close-modal");

function openModal() {
  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
}

function closeIntroModal() {
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
}

watchIntro?.addEventListener("click", openModal);
closeModal?.addEventListener("click", closeIntroModal);

modal?.addEventListener("click", (event) => {
  if (event.target === modal) closeIntroModal();
});

/* ចូលគណនី / ចុះឈ្មោះ */
const authModal = document.getElementById("authModal");
const authClose = document.querySelector(".auth-close");
const authTabs = document.querySelectorAll(".auth-tab");
const authForms = document.querySelectorAll(".auth-form");
const authDemoMessage = document.getElementById("authDemoMessage");

function showAuthPanel(panel) {
  authTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authTab === panel);
  });

  authForms.forEach((form) => {
    form.classList.toggle("active", form.dataset.authPanel === panel);
  });

  if (authDemoMessage) {
    authDemoMessage.hidden = true;
    authDemoMessage.textContent = "";
  }
}

function openAuth(panel = "login") {
  showAuthPanel(panel);
  authModal?.classList.add("open");
  authModal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeAuth() {
  authModal?.classList.remove("open");
  authModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

document.querySelectorAll(".login-open").forEach((btn) => {
  btn.addEventListener("click", () => openAuth("login"));
});

document.querySelectorAll(".signup-open").forEach((btn) => {
  btn.addEventListener("click", () => openAuth("signup"));
});

document.querySelectorAll(".switch-to-signup").forEach((btn) => {
  btn.addEventListener("click", () => showAuthPanel("signup"));
});

document.querySelectorAll(".switch-to-login").forEach((btn) => {
  btn.addEventListener("click", () => showAuthPanel("login"));
});

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => showAuthPanel(tab.dataset.authTab));
});

authClose?.addEventListener("click", closeAuth);

authModal?.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuth();
});

document.querySelectorAll(".password-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const input = button.parentElement.querySelector("input");
    if (!input) return;

    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.textContent = show ? "🙈" : "👁";
  });
});

document.getElementById("loginForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (authDemoMessage) {
    authDemoMessage.hidden = false;
    authDemoMessage.textContent =
      "ទម្រង់ចូលគណនីបានត្រៀមរួច។ ដើម្បីប្រើគណនីពិត ត្រូវភ្ជាប់ទៅប្រព័ន្ធគណនីអ្នកប្រើនៅផ្នែកខាងក្រោយ។";
  }
});

document.getElementById("signupForm")?.addEventListener("submit", (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const password = form.elements.password?.value || "";
  const confirmPassword = form.elements.confirmPassword?.value || "";

  if (password !== confirmPassword) {
    if (authDemoMessage) {
      authDemoMessage.hidden = false;
      authDemoMessage.textContent = "ពាក្យសម្ងាត់ទាំងពីរមិនដូចគ្នាទេ។";
    }
    return;
  }

  if (authDemoMessage) {
    authDemoMessage.hidden = false;
    authDemoMessage.textContent =
      "ទម្រង់ចុះឈ្មោះបានត្រៀមរួច។ ដើម្បីបង្កើតគណនីពិត ត្រូវភ្ជាប់ទៅប្រព័ន្ធគណនីអ្នកប្រើនៅផ្នែកខាងក្រោយ។";
  }
});


document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeIntroModal();
    if (authModal?.classList.contains("open")) closeAuth();
  }
});
