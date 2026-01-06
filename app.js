// IAM Capital MVP site script
// - Injects editable KPIs + Track Record cards
// - Theme toggle (saved in localStorage)

const $ = (sel) => document.querySelector(sel);

const state = {
  // 🔧 Edit these numbers anytime
  kpis: [
    {
      label: "Target AUM (initial)",
      value: "$100k",
      sub: "Proof-size for initial external capital",
    },
    {
      label: "Portfolio DD Cap",
      value: "2–5%",
      sub: "Illustrative firm-level drawdown guardrail",
    },
    {
      label: "Capital Allocation",
      value: "70/30",
      sub: "Stable yield vs quant trading (initial)",
    },
    {
      label: "Execution Bias",
      value: "Maker-first",
      sub: "Fee-aware rules to protect edge",
    },
  ],

  // 🔧 Illustrative monthly cards (edit later with real net-of-fees results)
  months: [
    { name: "2026 • Q1", tag: "Illustrative", net: "+2.4%", dd: "−1.1%", notes: "Stable yield anchor + light quant exposure" },
    { name: "2026 • Q2", tag: "Illustrative", net: "+1.7%", dd: "−0.8%", notes: "Regime filter reduced churn; fees optimized" },
    { name: "2026 • Q3", tag: "Illustrative", net: "+3.1%", dd: "−1.6%", notes: "Momentum basket performed; risk caps respected" },
  ],
};

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

function renderMonths() {
  const grid = $("#trackGrid");
  if (!grid) return;

  grid.innerHTML = state.months.map(m => `
    <div class="monthCard">
      <div class="monthTop">
        <div class="monthName">${escapeHtml(m.name)}</div>
        <div class="monthTag">${escapeHtml(m.tag)}</div>
      </div>
      <div class="monthMeta">
        <div class="metaRow"><div class="metaKey">Net return</div><div class="metaVal">${escapeHtml(m.net)}</div></div>
        <div class="metaRow"><div class="metaKey">Max drawdown</div><div class="metaVal">${escapeHtml(m.dd)}</div></div>
        <div class="metaRow"><div class="metaKey">Notes</div><div class="metaVal">${escapeHtml(m.notes)}</div></div>
      </div>
    </div>
  `).join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

  // Default: dark (finance vibe)
  setTheme("dark");
}

function initEvents() {
  $("#year").textContent = new Date().getFullYear();

  const themeBtn = $("#themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      setTheme(isLight ? "dark" : "light");
    });
  }

  const dl = $("#downloadBtn");
  if (dl) {
    dl.addEventListener("click", () => {
      alert("Sample PDF placeholder. Later you can upload a real investor letter PDF and link it here.");
    });
  }
}

initTheme();
renderKpis();
renderMonths();
initEvents();
