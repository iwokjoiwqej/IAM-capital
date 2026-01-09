const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/**
 * Data idea:
 * - 30D: daily points
 * - 1Y: weekly points (or monthly)
 * - ALL: monthly points
 * 지금은 샘플 데이터. 너가 values만 바꾸면 됨.
 */
const state = {
  kpis: [
    { label: "AUM", value: "94.2K USD", sub: "Indicative (internally managed)" },
    { label: "IRR", value: "24.7%", sub: "Illustrative placeholder" },
    { label: "Team", value: "17", sub: "Core headcount" },
    { label: "Operating History", value: "12+ months", sub: "Live trading experience" },
  ],

  ranges: ["30d", "1y", "all"],
  activeRange: { aum: "30d", irr: "30d" },

  series: {
    aum: {
      unit: "USD",
      formatY: (v) => v >= 1000 ? `${Math.round(v/1000)}K` : `${Math.round(v)}`,
      formatTip: (v) => `$${Number(v).toLocaleString()}`,
      data: {
        // daily-ish points (short)
        "30d": mkSeries(
          ["Day 1","Day 6","Day 11","Day 16","Day 21","Day 26","Day 30"],
          [82000, 83500, 84800, 86200, 88000, 91500, 94200]
        ),
        // weekly-ish
        "1y": mkSeries(
          ["Jan","Mar","May","Jul","Sep","Nov","Dec"],
          [42000, 50000, 56000, 61000, 70000, 86000, 94200]
        ),
        // monthly-ish
        "all": mkSeries(
          ["2026","2026 H2","2027 H1","2027 H2","2027"],
          [24000, 42000, 61000, 83000, 94200]
        ),
      }
    },

    irr: {
      unit: "%",
      formatY: (v) => `${v.toFixed(1)}%`,
      formatTip: (v) => `${v.toFixed(2)}%`,
      data: {
        "30d": mkSeries(
          ["Day 1","Day 6","Day 11","Day 16","Day 21","Day 26","Day 30"],
          [18.2, 19.1, 18.7, 20.4, 21.0, 23.5, 24.7]
        ),
        "1y": mkSeries(
          ["Jan","Mar","May","Jul","Sep","Nov","Dec"],
          [12.4, 16.1, 14.8, 18.7, 17.2, 22.3, 24.7]
        ),
        "all": mkSeries(
          ["2024","2024 H2","2025 H1","2025 H2","2026"],
          [8.6, 12.4, 16.8, 20.3, 24.7]
        ),
      }
    },
  }
};

function mkSeries(labels, values){
  return { labels, values };
}

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

/* ======================
   CHART ENGINE (Canvas)
   ====================== */
function makeChart({ canvasId, tipId, getSeries, yFormat, tipFormat }){
  const canvas = document.getElementById(canvasId);
  const tip = document.getElementById(tipId);
  if (!canvas) return null;

  const ctx = canvas.getContext("2d");
  let geom = null;
  let cached = null;

  function colors(){
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    return {
      grid: isLight ? "rgba(12,18,32,.10)" : "rgba(255,255,255,.10)",
      text: isLight ? "rgba(11,18,32,.72)" : "rgba(234,240,255,.72)",
      line: "rgba(77,163,255,.95)",
      fill: isLight ? "rgba(77,163,255,.12)" : "rgba(77,163,255,.10)",
      dot: "rgba(124,92,255,.95)",
    };
  }

  function resize(){
    // match CSS size
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    geom = { W: cssW, H: cssH };
  }

  function computePoints(labels, values){
    const { W, H } = geom;
    const pad = 18;
    const x0 = pad, y0 = 14;
    const x1 = W - pad, y1 = H - 18;

    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = (maxV - minV) || 1;

    const n = values.length;
    const pts = values.map((v,i)=>{
      const t = n===1 ? 0 : i/(n-1);
      const x = x0 + t*(x1-x0);
      const y = y1 - ((v - minV)/range)*(y1-y0);
      return {x,y,v,i,label:labels[i]};
    });

    return { pts, bounds:{x0,y0,x1,y1}, minV, maxV };
  }

  function draw(){
    if (!geom) resize();
    const { W, H } = geom;
    const { grid, text, line, fill } = colors();

    const s = getSeries();
    if (!s) return;
    const labels = s.labels;
    const values = s.values;

    const { pts, bounds, minV, maxV } = computePoints(labels, values);
    cached = { pts, bounds, minV, maxV, labels, values };

    ctx.clearRect(0,0,W,H);

    // grid (4 lines)
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0;i<4;i++){
      const yy = bounds.y0 + (i*(bounds.y1-bounds.y0)/3);
      ctx.moveTo(bounds.x0, yy);
      ctx.lineTo(bounds.x1, yy);
    }
    ctx.stroke();

    // area fill
    ctx.beginPath();
    ctx.moveTo(pts[0].x, bounds.y1);
    pts.forEach(p=>ctx.lineTo(p.x,p.y));
    ctx.lineTo(pts[pts.length-1].x, bounds.y1);
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
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // dots
    ctx.fillStyle = line;
    pts.forEach(p=>{
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.4, 0, Math.PI*2);
      ctx.fill();
    });

    // axis labels (clean): first/last label only
    ctx.fillStyle = text;
    ctx.font = "900 11px Inter, system-ui, sans-serif";
    ctx.textBaseline = "top";
    if (labels.length){
      ctx.fillText(labels[0], bounds.x0, bounds.y1 + 6);
      const last = labels[labels.length-1];
      const m = ctx.measureText(last).width;
      ctx.fillText(last, bounds.x1 - m, bounds.y1 + 6);
    }

    // right scale (max/min)
    ctx.textBaseline = "middle";
    const maxTxt = yFormat(maxV);
    const minTxt = yFormat(minV);
    const mx = ctx.measureText(maxTxt).width;
    ctx.fillText(maxTxt, bounds.x1 - mx, bounds.y0);
    const mn = ctx.measureText(minTxt).width;
    ctx.fillText(minTxt, bounds.x1 - mn, bounds.y1);
  }

  function nearestPoint(px){
    if (!cached) return null;
    // nearest in x
    let best = null, bestD = Infinity;
    for(const p of cached.pts){
      const d = Math.abs(p.x - px);
      if (d < bestD){ bestD = d; best = p; }
    }
    return best;
  }

  function showTip(p, clientX, clientY){
    if (!tip) return;
    tip.innerHTML = `
      <div class="tipRow"><span class="tipKey">Period</span><span class="tipVal">${escapeHtml(p.label)}</span></div>
      <div class="tipRow"><span class="tipKey">Value</span><span class="tipVal">${escapeHtml(tipFormat(p.v))}</span></div>
    `;
    tip.style.left = `${clientX}px`;
    tip.style.top  = `${clientY}px`;
    tip.classList.add("show");
    tip.setAttribute("aria-hidden","false");
  }

  function hideTip(){
    if (!tip) return;
    tip.classList.remove("show");
    tip.setAttribute("aria-hidden","true");
  }

  // events for tooltip
  const wrap = canvas.parentElement;
  if (wrap){
    wrap.addEventListener("mousemove", (e) => {
      if (!cached) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const p = nearestPoint(x);
      if (!p) return;

      // place tooltip near point (inside wrap coords)
      const tx = p.x;
      const ty = p.y;

      showTip(p, tx, ty);
    });

    wrap.addEventListener("mouseleave", hideTip);
    wrap.addEventListener("touchstart", (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      const rect = canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const p = nearestPoint(x);
      if (!p) return;
      showTip(p, p.x, p.y);
    }, { passive:true });
    wrap.addEventListener("touchend", hideTip);
  }

  // public API
  return {
    redraw(){
      resize();
      draw();
    }
  };
}

/* ======================
   RANGE PILLS
   ====================== */
function initRangePills(onChange){
  $$(".rangePills").forEach(group => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-range]");
      if (!btn) return;

      const target = group.getAttribute("data-target"); // aum or irr
      const range = btn.getAttribute("data-range");
      if (!target || !range) return;

      state.activeRange[target] = range;

      // set active class
      group.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      onChange?.(target, range);
    });
  });
}

/* ======================
   Mobile menu
   ====================== */
function initMobileDrawer(){
  const btn = $("#mobileMenuBtn");
  const drawer = $("#mobileDrawer");
  const closeBtn = $("#mobileCloseBtn");
  if (!btn || !drawer || !closeBtn) return;

  const open = () => { drawer.classList.add("open"); drawer.setAttribute("aria-hidden","false"); };
  const close = () => { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden","true"); };

  btn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
}

function init(){
  initTheme();
  renderKpis();
  initMobileDrawer();

  // Charts
  const aumChart = makeChart({
    canvasId: "aumChart",
    tipId: "aumTip",
    getSeries: () => state.series.aum.data[state.activeRange.aum],
    yFormat: (v) => state.series.aum.formatY(v),
    tipFormat: (v) => state.series.aum.formatTip(v),
  });

  const irrChart = makeChart({
    canvasId: "irrChart",
    tipId: "irrTip",
    getSeries: () => state.series.irr.data[state.activeRange.irr],
    yFormat: (v) => state.series.irr.formatY(v),
    tipFormat: (v) => state.series.irr.formatTip(v),
  });

  function redrawAll(){
    aumChart?.redraw();
    irrChart?.redraw();
  }

  // Range pills behavior
  initRangePills(() => redrawAll());

  // Redraw on resize
  window.addEventListener("resize", () => redrawAll());

  // Theme
  const themeBtn = $("#themeBtn");
  themeBtn?.addEventListener("click", () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    setTheme(isLight ? "dark" : "light");
    // redraw to update grid/text contrast
    setTimeout(redrawAll, 0);
  });

  // Footer year
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  // initial draw
  redrawAll();
}

init();
