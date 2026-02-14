require("dotenv").config();

const crypto = require("crypto");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

const app = express();
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 8080);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 8,
  waitForConnections: true,
  queueLimit: 0,
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(limiter);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (!ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Origin not allowed"), false);
    },
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function badReq(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function sanitize(value, max = 255) {
  if (value == null) return "";
  return String(value).trim().slice(0, max);
}

function ensure(value, name, max = 255) {
  const clean = sanitize(value, max);
  if (!clean) throw badReq(`${name} is required.`);
  return clean;
}

function getIp(req) {
  const header = sanitize(req.headers["x-forwarded-for"] || "", 128);
  if (header) return header.split(",")[0].trim();
  return sanitize(req.ip || "", 64);
}

function checkHoneypot(body) {
  if (sanitize(body.website, 100)) throw badReq("Invalid request.");
}

function timingSafeEq(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_USER || !ADMIN_PASS) {
    return res.status(503).send("Admin dashboard is not configured.");
  }

  const auth = req.headers.authorization || "";
  const m = auth.match(/^Basic\s+(.+)$/i);
  if (!m) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Asthate Admin"');
    return res.status(401).send("Authentication required.");
  }

  let decoded = "";
  try {
    decoded = Buffer.from(m[1], "base64").toString("utf8");
  } catch (_) {
    decoded = "";
  }

  const idx = decoded.indexOf(":");
  const user = idx >= 0 ? decoded.slice(0, idx) : "";
  const pass = idx >= 0 ? decoded.slice(idx + 1) : "";

  if (!timingSafeEq(user, ADMIN_USER) || !timingSafeEq(pass, ADMIN_PASS)) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Asthate Admin"');
    return res.status(401).send("Invalid credentials.");
  }

  return next();
}

const mailer = (() => {
  const host = sanitize(process.env.SMTP_HOST, 200);
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || "true").toLowerCase() === "true";
  const user = sanitize(process.env.SMTP_USER, 200);
  const pass = String(process.env.SMTP_PASS || "");
  const from = process.env.EMAIL_FROM || "Asthate Intake <no-reply@localhost>";
  const to = (process.env.EMAIL_TO || "").split(",").map((v) => v.trim()).filter(Boolean);
  const prefix = process.env.EMAIL_SUBJECT_PREFIX || "[Asthate]";

  if (!to.length) return null;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  return {
    async send({ subject, text }) {
      const fullSubject = `${prefix} ${subject}`.trim();
      await transporter.sendMail({
        from,
        to,
        subject: fullSubject,
        text,
      });
    }
  };
})();

async function safeEmail(payload) {
  if (!mailer) return;
  try {
    await mailer.send(payload);
  } catch (err) {
    // Do not fail the submission because email failed.
    console.error("Email send failed:", err?.message || err);
  }
}

async function pingDb() {
  const conn = await pool.getConnection();
  try {
    await conn.query("SELECT 1");
  } finally {
    conn.release();
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    await pingDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Database unavailable." });
  }
});

app.get("/admin", requireAdmin, async (req, res) => {
  const tab = sanitize(req.query.tab, 20) || "inquiries";

  const [inquiries] = await pool.query(
    "SELECT id, full_name, email, organization, investor_type, jurisdiction, ticket_size, created_at FROM inquiries ORDER BY id DESC LIMIT 200"
  );
  const [ddRequests] = await pool.query(
    "SELECT id, full_name, email, organization, role, nda_status, priority, created_at FROM dd_requests ORDER BY id DESC LIMIT 200"
  );
  const [portalReqs] = await pool.query(
    "SELECT id, email, created_at FROM portal_access_requests ORDER BY id DESC LIMIT 200"
  );

  const active = (name) => (tab === name ? "is-active" : "");
  const renderRows = (rows, cols) =>
    rows
      .map((r) => `<tr>${cols.map((c) => `<td>${escapeHtml(r[c] ?? "")}</td>`).join("")}</tr>`)
      .join("");

  const page = `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin | Asthate</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background: #f5f7fb; color: #121926; }
      header { padding: 18px 22px; background: #0b0b0f; color: #fff; }
      header strong { letter-spacing: .12em; text-transform: uppercase; font-size: 12px; opacity: .9; }
      main { max-width: 1200px; margin: 0 auto; padding: 18px 22px 46px; }
      .tabs { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0 14px; }
      .tab { padding: 10px 12px; border-radius: 999px; background: #fff; border: 1px solid rgba(18,25,38,.14); color: #455468; text-decoration: none; font-weight: 700; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
      .tab.is-active { background: rgba(159,123,45,.12); border-color: rgba(159,123,45,.35); color: #121926; }
      .card { background: #fff; border: 1px solid rgba(18,25,38,.14); border-radius: 14px; overflow: hidden; }
      .cardTop { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; padding: 14px 14px; border-bottom: 1px solid rgba(18,25,38,.08); }
      .cardTop h1 { margin: 0; font-size: 18px; }
      .muted { color: #58677b; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 12px; border-bottom: 1px solid rgba(18,25,38,.08); text-align: left; font-size: 13px; }
      th { background: rgba(159,123,45,.08); color: #51390b; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: 11px; }
      tr:hover td { background: #fafcff; }
      .foot { margin-top: 10px; color: #58677b; font-size: 12px; }
      @media (max-width: 760px) { th:nth-child(n+5), td:nth-child(n+5) { display: none; } }
    </style>
  </head>
  <body>
    <header>
      <strong>Asthate</strong>
      <div class="muted" style="color: rgba(255,255,255,.7)">Intake Admin (latest 200)</div>
    </header>
    <main>
      <div class="tabs">
        <a class="tab ${active("inquiries")}" href="/admin?tab=inquiries">Inquiries</a>
        <a class="tab ${active("dd")}" href="/admin?tab=dd">DD Requests</a>
        <a class="tab ${active("portal")}" href="/admin?tab=portal">Portal Requests</a>
      </div>

      ${tab === "dd"
        ? `<section class="card">
            <div class="cardTop"><h1>DD Requests</h1><div class="muted">Name, email, NDA status, priority</div></div>
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Organization</th><th>Role</th><th>NDA</th><th>Priority</th><th>Created</th></tr></thead>
              <tbody>${renderRows(ddRequests, ["id","full_name","email","organization","role","nda_status","priority","created_at"])}</tbody>
            </table>
          </section>`
        : tab === "portal"
        ? `<section class="card">
            <div class="cardTop"><h1>Portal Requests</h1><div class="muted">Access link requests</div></div>
            <table>
              <thead><tr><th>ID</th><th>Email</th><th>Created</th></tr></thead>
              <tbody>${renderRows(portalReqs, ["id","email","created_at"])}</tbody>
            </table>
          </section>`
        : `<section class="card">
            <div class="cardTop"><h1>Inquiries</h1><div class="muted">Investor profile intake</div></div>
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Organization</th><th>Type</th><th>Jurisdiction</th><th>Ticket</th><th>Created</th></tr></thead>
              <tbody>${renderRows(inquiries, ["id","full_name","email","organization","investor_type","jurisdiction","ticket_size","created_at"])}</tbody>
            </table>
          </section>`
      }

      <div class="foot">Tip: set ADMIN_USER/ADMIN_PASS and (optionally) SMTP_* in server .env.</div>
    </main>
  </body>
  </html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(page);
});

app.post("/api/inquiry", async (req, res, next) => {
  try {
    checkHoneypot(req.body);

    const fullName = ensure(req.body.full_name, "full_name", 150);
    const email = ensure(req.body.email, "email", 190);
    const organization = ensure(req.body.organization, "organization", 190);
    const investorType = ensure(req.body.investor_type, "investor_type", 80);
    const jurisdiction = ensure(req.body.jurisdiction, "jurisdiction", 120);
    const ticketSize = ensure(req.body.ticket_size, "ticket_size", 80);
    const notes = sanitize(req.body.notes, 4000);
    const ipAddress = getIp(req);
    const userAgent = sanitize(req.headers["user-agent"], 255);

    await pool.execute(
      `INSERT INTO inquiries
        (full_name, email, organization, investor_type, jurisdiction, ticket_size, notes, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fullName, email, organization, investorType, jurisdiction, ticketSize, notes || null, ipAddress || null, userAgent || null]
    );

    await safeEmail({
      subject: `New Inquiry: ${fullName}`,
      text:
        `New investor inquiry received.\n\n` +
        `Name: ${fullName}\n` +
        `Email: ${email}\n` +
        `Organization: ${organization}\n` +
        `Investor Type: ${investorType}\n` +
        `Jurisdiction: ${jurisdiction}\n` +
        `Ticket Size: ${ticketSize}\n` +
        `IP: ${ipAddress}\n\n` +
        `Notes:\n${notes || "-"}\n`,
    });

    res.status(201).json({ ok: true, message: "Inquiry submitted successfully." });
  } catch (err) {
    next(err);
  }
});

app.post("/api/dd-request", async (req, res, next) => {
  try {
    checkHoneypot(req.body);

    const fullName = ensure(req.body.full_name, "full_name", 150);
    const email = ensure(req.body.email, "email", 190);
    const organization = ensure(req.body.organization, "organization", 190);
    const role = ensure(req.body.role, "role", 120);
    const ndaStatus = ensure(req.body.nda_status, "nda_status", 80);
    const priority = ensure(req.body.priority, "priority", 80);
    const requestedItems = sanitize(req.body.requested_items, 4000);
    const ipAddress = getIp(req);
    const userAgent = sanitize(req.headers["user-agent"], 255);

    await pool.execute(
      `INSERT INTO dd_requests
        (full_name, email, organization, role, nda_status, priority, requested_items, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fullName, email, organization, role, ndaStatus, priority, requestedItems || null, ipAddress || null, userAgent || null]
    );

    await safeEmail({
      subject: `New DD Request: ${fullName}`,
      text:
        `New DD request submitted.\n\n` +
        `Name: ${fullName}\n` +
        `Email: ${email}\n` +
        `Organization: ${organization}\n` +
        `Role: ${role}\n` +
        `NDA Status: ${ndaStatus}\n` +
        `Priority: ${priority}\n` +
        `IP: ${ipAddress}\n\n` +
        `Requested Items:\n${requestedItems || "-"}\n`,
    });

    res.status(201).json({ ok: true, message: "DD request submitted successfully." });
  } catch (err) {
    next(err);
  }
});

app.post("/api/portal-request", async (req, res, next) => {
  try {
    checkHoneypot(req.body);

    const email = ensure(req.body.email, "email", 190);
    const passphrase = ensure(req.body.passphrase, "passphrase", 255);
    const passphraseHash = crypto.createHash("sha256").update(passphrase).digest("hex");
    const ipAddress = getIp(req);
    const userAgent = sanitize(req.headers["user-agent"], 255);

    await pool.execute(
      `INSERT INTO portal_access_requests
        (email, passphrase_hash, ip_address, user_agent)
       VALUES (?, ?, ?, ?)`,
      [email, passphraseHash, ipAddress || null, userAgent || null]
    );

    await safeEmail({
      subject: `New Portal Access Request: ${email}`,
      text:
        `New portal access request.\n\n` +
        `Email: ${email}\n` +
        `IP: ${ipAddress}\n`,
    });

    res.status(201).json({ ok: true, message: "Portal access request submitted." });
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  const status = Number(err.statusCode) || 500;
  const message = status >= 500 ? "Server error." : err.message || "Request failed.";
  res.status(status).json({ ok: false, message });
});

app.listen(PORT, () => {
  console.log(`Asthate intake API listening on :${PORT}`);
});
