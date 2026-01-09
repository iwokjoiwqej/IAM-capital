const $ = (sel) => document.querySelector(sel);

const state = {
  // 요청한 Firm Snapshot 4개 구성으로 고정
  kpis: [
    { label: "AUM", value: "94.2K USD", sub: "Indicative (internally managed)" },
    { label: "IRR", value: "24.7%", sub: "Illustrative placeholder" },
    { label: "Team", value: "17", sub: "Core headcount" },
    { label: "Operating History", value: "12+ months", sub: "Live trading experience" },
  ],
    // Placeholder series (edit anytime)
  aumSeries: {
    labels: ["Q1", "Q2", "Q3", "Q4", "Q1", "Q2"],
    values: [42000, 51000, 61000, 73000, 86000, 94200],
    suffix: " USD"
  },
  irrSeries: {
    labels: ["Q1", "Q2", "Q3", "Q4", "Q1", "Q2"],
    values: [12.4, 18.1, 15.6, 21.0, 23.5, 24.7],
    suffix: "%"
  },

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
  
    drawLineChart("aumChart", state.aumSeries.labels, state.aumSeries.values, {
    format: (v) => `${Math.round(v/1000)}K`
  });

  drawLineChart("irrChart", state.irrSeries.labels, state.irrSeries.values, {
    format: (v) => `${v.toFixed(1)}%`
  });

  // If theme toggles, redraw charts (so text/grid colors update)
  const themeBtn = $("#themeBtn");
  themeBtn?.addEventListener("click", () => {
    setTimeout(() => {
      drawLineChart("aumChart", state.aumSeries.labels, state.aumSeries.values, { format: (v)=>`${Math.round(v/1000)}K` });
      drawLineChart("irrChart", state.irrSeries.labels, state.irrSeries.values, { format: (v)=>`${v.toFixed(1)}%` });
    }, 0);
  });

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

  drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
}

function init(){
  initTheme();
  renderKpis();
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

function drawLineChart(canvasId, labels, values, opts={}){
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext("2d");

  // scale for high-DPI screens
  const dpr = window.devicePixelRatio || 1;
  const cssW = c.clientWidth || c.width;
  const cssH = c.clientHeight || c.height;
  c.width = Math.round(cssW * dpr);
  c.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const W = cssW, H = cssH;
  ctx.clearRect(0,0,W,H);

  const pad = 18;
  const x0 = pad, y0 = pad;
  const x1 = W - pad, y1 = H - pad;

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = (maxV - minV) || 1;

  // theme-aware colors
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const grid = isLight ? "rgba(12,18,32,.10)" : "rgba(255,255,255,.10)";
  const text = isLight ? "rgba(11,18,32,.70)" : "rgba(234,240,255,.70)";
  const line = isLight ? "rgba(77,163,255,.95)" : "rgba(77,163,255,.95)";
  const fill = isLight ? "rgba(77,163,255,.12)" : "rgba(77,163,255,.10)";

  // grid lines (3)
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let i=0;i<3;i++){
    const yy = y0 + (i*(y1-y0)/2);
    ctx.moveTo(x0, yy);
    ctx.lineTo(x1, yy);
  }
  ctx.stroke();

  // map points
  const n = values.length;
  const pts = values.map((v,i)=>{
    const t = n===1 ? 0 : i/(n-1);
    const x = x0 + t*(x1-x0);
    const y = y1 - ((v - minV)/range)*(y1-y0);
    return {x,y,v,i};
  });

  // area fill
  ctx.beginPath();
  ctx.moveTo(pts[0].x, y1);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.lineTo(pts[pts.length-1].x, y1);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  // line
  ctx.beginPath();
  pts.forEach((p,idx)=>{
    if(idx===0) ctx.moveTo(p.x,p.y);
    else ctx.lineTo(p.x,p.y);
  });
  ctx.strokeStyle = line;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // points
  pts.forEach(p=>{
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2, 0, Math.PI*2);
    ctx.fillStyle = line;
    ctx.fill();
  });

  // labels (first/last only for clean look)
  ctx.fillStyle = text;
  ctx.font = "800 11px Inter, system-ui, sans-serif";
  ctx.textBaseline = "top";
  if(labels?.length){
    ctx.fillText(labels[0], x0, y1 + 6);
    const last = labels[labels.length-1];
    const m = ctx.measureText(last).width;
    ctx.fillText(last, x1 - m, y1 + 6);
  }

  // min/max on right
  ctx.textBaseline = "middle";
  const maxText = (opts.format ? opts.format(maxV) : String(maxV));
  const minText = (opts.format ? opts.format(minV) : String(minV));
  const mx = ctx.measureText(maxText).width;
  ctx.fillText(maxText, x1 - mx, y0);
  const mn = ctx.measureText(minText).width;
  ctx.fillText(minText, x1 - mn, y1);
}
