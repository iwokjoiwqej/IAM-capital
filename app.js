const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  // KPI는 “성과”보다 “운영 가능성/신뢰” 중심이 더 프로임
  kpis: [
    { label: "Capital Base", value: "Proprietary", sub: "Internally managed (indicative)" },
    { label: "Operating History", value: "12+ months", sub: "Live trading experience" },
    { label: "Strategy Scope", value: "Multi-strategy", sub: "Systematic deployment" },
    { label: "Reporting", value: "Monthly", sub: "Net-of-fees format" },
  ],
};

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderKpis(){
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

function setTheme(theme){
  if (theme === "light") document.documentElement.setAttribute("data-theme","light");
  else document.documentElement.removeAttribute("data-theme");
  localStorage.setItem("iam_theme", theme);
}
function initTheme(){
  const saved = localStorage.getItem("iam_theme");
  setTheme(saved || "dark");
}

function closeAllMega(){
  $$(".hasMega").forEach(item => {
    item.classList.remove("open");
    const btn = item.querySelector(".navBtn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  });
}

// Desktop mega-menu behavior:
// - Open on hover
// - Also open/close on click (for trackpads)
// - Close when clicking outside or pressing ESC
function initMegaMenu(){
  const items = $$(".hasMega");

  items.forEach(item => {
    const btn = item.querySelector(".navBtn");
    const mega = item.querySelector(".mega");
    if (!btn || !mega) return;

    const open = () => {
      closeAllMega();
      item.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
    };

    const close = () => {
      item.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    };

    item.addEventListener("mouseenter", open);
    item.addEventListener("mouseleave", close);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = item.classList.contains("open");
      if (isOpen) close();
      else open();
    });

    // If user clicks a link inside mega menu, close it
    mega.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => closeAllMega());
    });
  });

  document.addEventListener("click", (e) => {
    const inside = e.target.closest(".hasMega");
    if (!inside) closeAllMega();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllMega();
  });
}

function initPerformanceToggle(){
  const perfBtn = $("#perfBtn");
  const perfPanel = $("#perfPanel");
  const perfClose = $("#perfClose");

  const open = () => {
    if (!perfPanel) return;
    perfPanel.classList.add("open");
    perfPanel.setAttribute("aria-hidden", "false");
    $("#performance")?.scrollIntoView({behavior:"smooth", block:"start"});
  };
  const close = () => {
    if (!perfPanel) return;
    perfPanel.classList.remove("open");
    perfPanel.setAttribute("aria-hidden", "true");
  };

  perfBtn?.addEventListener("click", open);
  perfClose?.addEventListener("click", close);
}

function initMobileDrawer(){
  const btn = $("#mobileMenuBtn");
  const drawer = $("#mobileDrawer");
  const closeBtn = $("#mobileCloseBtn");
  if (!btn || !drawer || !closeBtn) return;

  const open = () => {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
  };
  const close = () => {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
  };

  btn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  drawer.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", close);
  });
}

function init(){
  initTheme();
  renderKpis();
  initMegaMenu();
  initPerformanceToggle();
  initMobileDrawer();

  const themeBtn = $("#themeBtn");
  themeBtn?.addEventListener("click", () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    setTheme(isLight ? "dark" : "light");
  });

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
}

init();
