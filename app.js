const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function mkSeries(labels, values) {
  return { labels, values };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const state = {
  kpis: [
    { label: "Since Inception IRR", value: "27.4%", sub: "Illustrative internal format" },
    { label: "Max Drawdown", value: "-6.8%", sub: "Peak-to-trough" },
    { label: "Sharpe Ratio", value: "1.42", sub: "Estimated" },
    { label: "AUM", value: "USD 0.12M", sub: "Build-phase capital base" },
  ],
  activeRange: { irr: "30d" },
  series: {
    irr: {
      formatY: (v) => (v == null || Number.isNaN(Number(v)) ? "-" : `${Number(v).toFixed(1)}%`),
      formatTip: (v) => (v == null || Number.isNaN(Number(v)) ? "-" : `${Number(v).toFixed(2)}%`),
      data: {
        "30d": mkSeries(
          ["Day 1", "Day 6", "Day 11", "Day 16", "Day 21", "Day 26", "Day 30"],
          [14.8, 14.3, 15.2, 15.0, 14.6, 15.4, 15.7]
        ),
        "1y": mkSeries(
          ["Jan", "Mar", "May", "Jul", "Sep", "Nov", "Dec"],
          [9.8, 11.2, 12.4, 11.9, 13.7, 14.8, 15.7]
        ),
        "all": mkSeries(
          ["2025 Q2", "2025 Q3", "2025 Q4", "2026 Q1"],
          [4.1, 12.2, 18.8, 27.4]
        )
      }
    }
  }
};

function renderKpis() {
  const grid = $("#kpiGrid");
  if (!grid) return;
  grid.innerHTML = state.kpis.map((k) => `
    <div class="kpi">
      <div class="kpiLabel">${escapeHtml(k.label)}</div>
      <div class="kpiVal">${escapeHtml(k.value)}</div>
      <div class="kpiSub">${escapeHtml(k.sub)}</div>
    </div>
  `).join("");
}

function setTheme(theme) {
  const root = document.documentElement;
  if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
  localStorage.setItem("iam_theme", theme);
  updateBrandLogos(theme);
}

function updateBrandLogos(theme) {
  const logos = document.querySelectorAll(".brandLogo");
  const isLight = theme === "light";
  logos.forEach((img) => {
    img.classList.remove("logo-missing");
    const darkSrc = img.getAttribute("data-logo-dark") || img.getAttribute("src");
    const lightSrc = img.getAttribute("data-logo-light") || darkSrc;
    img.setAttribute("src", isLight ? lightSrc : darkSrc);
  });
}

function initTheme() {
  const saved = localStorage.getItem("iam_theme");
  setTheme(saved || "light");
}

function makeChart({ canvasId, tipId, getSeries, yFormat, tipFormat }) {
  const canvas = document.getElementById(canvasId);
  const tip = document.getElementById(tipId);
  if (!canvas) return null;

  const ctx = canvas.getContext("2d");
  let geom = null;
  let cached = null;

  function colors() {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    return {
      grid: isLight ? "rgba(12, 18, 32, .10)" : "rgba(255, 255, 255, .10)",
      text: isLight ? "rgba(11, 18, 32, .72)" : "rgba(234, 240, 255, .72)",
      line: isLight ? "rgba(178, 132, 29, .96)" : "rgba(240, 194, 76, .95)",
      fill: isLight ? "rgba(178, 132, 29, .12)" : "rgba(240, 194, 76, .12)",
    };
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 0;
    const cssH = canvas.clientHeight || 0;

    if (!cssW || !cssH) {
      geom = { W: cssW, H: cssH };
      return;
    }

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    geom = { W: cssW, H: cssH };
  }

  function computePoints(labels, values) {
    const { W, H } = geom;
    const pad = 18;
    const x0 = pad;
    const y0 = 14;
    const x1 = W - pad;
    const y1 = H - 18;

    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = (maxV - minV) || 1;

    const n = values.length;
    const pts = values.map((v, i) => {
      const t = n === 1 ? 0 : i / (n - 1);
      const x = x0 + t * (x1 - x0);
      const y = y1 - ((v - minV) / range) * (y1 - y0);
      return { x, y, v, i, label: labels[i] };
    });

    return { pts, bounds: { x0, y0, x1, y1 }, minV, maxV };
  }

  function draw() {
    if (!geom) resize();
    if (!geom || !geom.W || !geom.H) return;

    const { W, H } = geom;
    const { grid, text, line, fill } = colors();

    const s = getSeries();
    if (!s || !Array.isArray(s.labels) || !Array.isArray(s.values) || !s.values.length) return;

    const labels = s.labels;
    const values = s.values.map(Number).filter((v) => !Number.isNaN(v));
    if (!values.length) return;

    const { pts, bounds, minV, maxV } = computePoints(labels, values);
    cached = { pts, bounds, minV, maxV };

    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const yy = bounds.y0 + (i * (bounds.y1 - bounds.y0) / 3);
      ctx.moveTo(bounds.x0, yy);
      ctx.lineTo(bounds.x1, yy);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pts[0].x, bounds.y1);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, bounds.y1);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = line;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.fillStyle = line;
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = text;
    ctx.font = "700 11px Inter, system-ui, sans-serif";
    ctx.textBaseline = "top";

    if (labels.length) {
      ctx.fillText(labels[0], bounds.x0, bounds.y1 + 6);
      const last = labels[labels.length - 1];
      const m = ctx.measureText(last).width;
      ctx.fillText(last, bounds.x1 - m, bounds.y1 + 6);
    }

    ctx.textBaseline = "middle";
    const maxTxt = yFormat(maxV);
    const minTxt = yFormat(minV);

    ctx.fillText(maxTxt, bounds.x1 - ctx.measureText(maxTxt).width, bounds.y0);
    ctx.fillText(minTxt, bounds.x1 - ctx.measureText(minTxt).width, bounds.y1);
  }

  function nearestPoint(px) {
    if (!cached) return null;
    let best = null;
    let bestD = Infinity;
    cached.pts.forEach((p) => {
      const d = Math.abs(p.x - px);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    });
    return best;
  }

  function showTip(p) {
    if (!tip) return;
    tip.innerHTML = `
      <div class="tipRow"><span class="tipKey">Period</span><span class="tipVal">${escapeHtml(p.label)}</span></div>
      <div class="tipRow"><span class="tipKey">Value</span><span class="tipVal">${escapeHtml(tipFormat(p.v))}</span></div>
    `;
    tip.style.left = `${p.x}px`;
    tip.style.top = `${p.y}px`;
    tip.classList.add("show");
    tip.setAttribute("aria-hidden", "false");
  }

  function hideTip() {
    if (!tip) return;
    tip.classList.remove("show");
    tip.setAttribute("aria-hidden", "true");
  }

  const wrap = canvas.parentElement;
  if (wrap) {
    wrap.addEventListener("mousemove", (e) => {
      if (!cached) return;
      const rect = canvas.getBoundingClientRect();
      const p = nearestPoint(e.clientX - rect.left);
      if (p) showTip(p);
    });
    wrap.addEventListener("mouseleave", hideTip);

    wrap.addEventListener("touchstart", (e) => {
      const t = e.touches?.[0];
      if (!t || !cached) return;
      const rect = canvas.getBoundingClientRect();
      const p = nearestPoint(t.clientX - rect.left);
      if (p) showTip(p);
    }, { passive: true });

    wrap.addEventListener("touchend", hideTip);
  }

  return {
    redraw() {
      resize();
      draw();
    }
  };
}

function initRangePills(onChange) {
  $$(".rangePills").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-range]");
      if (!btn) return;

      const target = group.getAttribute("data-target");
      const range = btn.getAttribute("data-range");
      if (target !== "irr" || !range) return;

      state.activeRange[target] = range;
      group.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onChange?.();
    });
  });
}

function initMobileDrawer() {
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
  drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
}

function init() {
  initTheme();
  renderKpis();
  initMobileDrawer();

  const irrChart = makeChart({
    canvasId: "irrChart",
    tipId: "irrTip",
    getSeries: () => state.series.irr.data[state.activeRange.irr],
    yFormat: (v) => state.series.irr.formatY(v),
    tipFormat: (v) => state.series.irr.formatTip(v),
  });

  const redrawAll = () => irrChart?.redraw();

  initRangePills(redrawAll);
  window.addEventListener("resize", redrawAll);

  const themeBtn = $("#themeBtn");
  themeBtn?.addEventListener("click", () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    setTheme(isLight ? "dark" : "light");
    redrawAll();
  });

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  redrawAll();
}

init();




