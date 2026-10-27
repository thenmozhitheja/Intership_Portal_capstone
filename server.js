const express = require("express");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const dataDir = path.join(ROOT, "data");
const logsDir = path.join(ROOT, "logs");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });

const logFile = path.join(logsDir, "app.log");
function log(level, message, meta = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  });
  console.log(entry);
  fs.appendFile(logFile, entry + "\n", () => {});
}

const db = new Database(path.join(dataDir, "internships.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS internships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    domain TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'Remote',
    duration_weeks INTEGER NOT NULL DEFAULT 4,
    description TEXT NOT NULL,
    applications_open INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    internship_id INTEGER NOT NULL,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    skills TEXT NOT NULL DEFAULT '',
    motivation TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    UNIQUE (internship_id, applicant_email)
  );
`);

const count = db.prepare("SELECT COUNT(*) AS total FROM internships").get().total;
if (count === 0) {
  const seed = db.prepare(`
    INSERT INTO internships (title, domain, mode, duration_weeks, description, applications_open)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  const examples = [
    ["Frontend Developer Intern", "Web Development", "Remote", 6, "Build responsive interfaces using HTML, CSS and JavaScript."],
    ["Python Backend Intern", "Backend Development", "Hybrid", 8, "Create REST APIs, validate requests and work with relational databases."],
    ["Data Analytics Intern", "Data Analytics", "Remote", 4, "Clean datasets, explore trends and present findings clearly."],
    ["Prompt Engineering Intern", "AI & Prompt Engineering", "Remote", 4, "Design, evaluate and document prompts for practical workflows."]
  ];
  const transaction = db.transaction(rows => rows.forEach(row => seed.run(...row)));
  transaction(examples);
}

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

// Small in-memory rate limiter for write endpoints; no additional dependency required.
const writeHits = new Map();
function writeRateLimit(req, res, next) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const recent = (writeHits.get(key) || []).filter(t => now - t < 60_000);
  if (recent.length >= 20) {
    log("warn", "Rate limit exceeded", { ip: key, path: req.path });
    return res.status(429).json({ error: "Too many requests. Please try again in a minute." });
  }
  recent.push(now);
  writeHits.set(key, recent);
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of writeHits.entries()) {
    const active = hits.filter(t => now - t < 60_000);
    if (active.length) writeHits.set(key, active);
    else writeHits.delete(key);
  }
}, 60_000).unref();

app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => log("info", "HTTP request", {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration_ms: Date.now() - started
  }));
  next();
});

app.get("/api/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", service: "edvyro-internship-portal", database: "connected", timestamp: new Date().toISOString() });
  } catch (error) {
    log("error", "Health check failed", { error: error.message });
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.get("/api/internships", (req, res) => {
  const search = String(req.query.search || "").trim().slice(0, 100);
  const domain = String(req.query.domain || "").trim().slice(0, 80);
  const rows = db.prepare(`
    SELECT i.*,
      (SELECT COUNT(*) FROM applications a WHERE a.internship_id = i.id) AS application_count
    FROM internships i
    WHERE (? = '' OR i.title LIKE ? OR i.domain LIKE ? OR i.description LIKE ?)
      AND (? = '' OR i.domain = ?)
    ORDER BY i.created_at DESC, i.id DESC
  `).all(search, `%${search}%`, `%${search}%`, `%${search}%`, domain, domain);
  res.json({ data: rows });
});

app.get("/api/internships/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid internship id." });
  const row = db.prepare("SELECT * FROM internships WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Internship not found." });
  res.json({ data: row });
});

app.post("/api/applications", writeRateLimit, (req, res) => {
  const internshipId = Number(req.body.internship_id);
  const name = String(req.body.applicant_name || "").trim();
  const email = String(req.body.applicant_email || "").trim().toLowerCase();
  const skills = String(req.body.skills || "").trim().slice(0, 500);
  const motivation = String(req.body.motivation || "").trim().slice(0, 1500);

  if (!Number.isInteger(internshipId) || internshipId < 1) {
    return res.status(400).json({ error: "Choose a valid internship." });
  }
  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ error: "Name must contain 2–80 characters." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (skills.length > 500 || motivation.length > 1500) {
    return res.status(400).json({ error: "One of the fields is too long." });
  }
  const internship = db.prepare("SELECT id, applications_open FROM internships WHERE id = ?").get(internshipId);
  if (!internship) return res.status(404).json({ error: "Internship not found." });
  if (!internship.applications_open) return res.status(409).json({ error: "Applications are closed for this internship." });

  try {
    const result = db.prepare(`
      INSERT INTO applications (internship_id, applicant_name, applicant_email, skills, motivation)
      VALUES (?, ?, ?, ?, ?)
    `).run(internshipId, name, email, skills, motivation);
    log("info", "Application created", { application_id: result.lastInsertRowid, internship_id: internshipId });
    res.status(201).json({ message: "Application submitted successfully.", application_id: result.lastInsertRowid });
  } catch (error) {
    if (String(error.code).includes("SQLITE_CONSTRAINT_UNIQUE")) {
      return res.status(409).json({ error: "This email has already applied for this internship." });
    }
    log("error", "Application creation failed", { error: error.message });
    res.status(500).json({ error: "Could not submit application. Please try again." });
  }
});

app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use(express.static(path.join(ROOT, "public")));

app.use((err, req, res, next) => {
  log("error", "Unhandled request error", { error: err.message, path: req.path });
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Unexpected server error." });
});

if (require.main === module) {
  const server = app.listen(PORT, () => log("info", "Server started", { port: PORT, env: process.env.NODE_ENV || "development" }));
  const shutdown = () => {
    log("info", "Server shutting down");
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

module.exports = { app, db };
