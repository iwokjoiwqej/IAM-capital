// IAM Capital — professional MVP script
// - Inject high-level KPIs (no proprietary strategy details)
// - Mobile menu toggle
// - Theme toggle (saved)

const $ = (sel) => document.querySelector(sel);

const state = {
  // 🔧 Edit anytime (keep high-level, investor-safe)
  kpis: [
    {
      label: "Positioning",
      value: "Systematic",
      sub: "Process-driven approach with defined controls",
    },
    {
      label: "Reporting",
      value: "Monthly",
      sub: "Net-of-fees + risk metrics (when published)",
    },
    {
      label: "Execution",
      value: "Fee-aware",
      sub: "Designed to reduce friction & operational risk",
    },
    {
      label: "Focus",
      value: "Risk-first",
      sub: "Risk governance overrides return optimization",
    },
  ],
};

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderKpis() {
  const grid = $("#kpiGrid");
  if (!grid) return;

  grid.innerHTML = state.kpis.map(k => `
    <div class="kpi">
      <div class="kpiLabel">${escapeHtml(k.label)}</div>
      <div class="kpiVal">${escapeHtml(k.value)}</div>
      <div class="kpiSub">${escapeHtml(k.sub)}</div>
    </div>
  `).join("");
}

function setTheme(theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("iam_theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("iam_theme");
  if (saved) return setTheme(saved);
  setTheme("dark");
}

function initEvents() {
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  const themeBtn = $("#themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      setTheme(isLight ? "dark" : "light");
    });
  }

  // Mobile menu
  const menuBtn = $("#menuBtn");
  const mobileNav = $("#mobileNav");
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", () => {
      const isOpen = mobileNav.classList.toggle("open");
      mobileNav.setAttribute("aria-hidden", String(!isOpen));
    });

    mobileNav.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => {
        mobileNav.classList.remove("open");
        mobileNav.setAttribute("aria-hidden", "true");
      });
    });
  }

  // Disable "coming soon" button
  const dl = $("#downloadBtn");
  if (dl) {
    dl.addEventListener("click", (e) => {
      e.preventDefault();
    });
  }
}

initTheme();
renderKpis();
initEvents();
