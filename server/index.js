require("dotenv").config();

const crypto = require("crypto");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mysql = require("mysql2/promise");

const app = express();
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 8080);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

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
