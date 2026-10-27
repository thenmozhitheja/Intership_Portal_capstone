# Edvyro Task 5 — Production-Ready Capstone

A polished, responsive full-stack internship portal that brings the previous internship milestones together and demonstrates a complete browse-and-apply user journey.

## Features

- Responsive landing page and internship cards for desktop, tablet and mobile.
- Search internships by title, domain, description or work mode.
- Filter by domain.
- Accessible application dialog with client- and server-side validation.
- REST API built with Express.
- SQLite persistence with foreign-key constraints and duplicate-application prevention.
- Health check at `GET /api/health`.
- Structured request/application logs written to `logs/app.log`.
- Security headers with Helmet, JSON body size limit, parameterized SQL queries and a basic write-endpoint rate limit.
- Regression tests using Node's built-in test runner.
- Seed data added automatically on first run.

## Requirements

- Node.js 20 or newer (Node 22 LTS recommended).
- npm.

## Run locally

1. Extract the project folder.
2. Open a terminal in the extracted folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the server:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000` in your browser.

The SQLite database is created at `data/internships.db` on first start. Logs are written to `logs/app.log`.

## Development mode

```bash
npm run dev
```

## Test

Stop the running server first, then run:

```bash
npm test
```

The tests cover the health endpoint, internship listing, malformed application validation and unknown API routes.

## API reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service and database health |
| `GET` | `/api/internships` | List internships |
| `GET` | `/api/internships?search=python` | Search internships |
| `GET` | `/api/internships?domain=Web%20Development` | Filter by domain |
| `GET` | `/api/internships/:id` | Get one internship |
| `POST` | `/api/applications` | Submit an application |

### Application request example

```json
{
  "internship_id": 1,
  "applicant_name": "Thenmozhi",
  "applicant_email": "student@example.com",
  "skills": "HTML, CSS, JavaScript, Python",
  "motivation": "I want to gain practical experience and improve my development skills."
}
```

A successful request returns HTTP `201`. Validation errors return `400`, unknown internships return `404`, duplicate applications return `409`, and excessive write requests return `429`.

## Engineering decisions

- **Express:** small and understandable routing layer for a student capstone.
- **SQLite + better-sqlite3:** simple local persistence without needing a separate database server.
- **Parameterized queries:** user input is passed as SQL parameters instead of concatenated into SQL statements.
- **Validation at the API boundary:** the server remains authoritative even if client-side validation is bypassed.
- **Structured logs:** JSON logs include timestamp, level, route, status and request duration for easier diagnosis.
- **Health check:** allows a quick check of service and database connectivity.
- **Graceful shutdown:** closes the HTTP server and database connection on termination signals.
- **Accessibility:** semantic landmarks, keyboard-focus styles, a skip link, labelled form controls and live status announcements.
- **Responsive layout:** CSS breakpoints adapt navigation, cards, forms and content for smaller screens.

## Verification checklist

- [ ] `npm install` completes successfully.
- [ ] `npm start` starts the service without errors.
- [ ] Open `http://localhost:3000` and verify internship cards load.
- [ ] Search and domain filters work.
- [ ] Submit a valid application and confirm success feedback.
- [ ] Try an invalid email and confirm the API rejects it.
- [ ] Submit the same email to the same internship twice and confirm the second attempt is rejected.
- [ ] Open `http://localhost:3000/api/health` and confirm `"status": "ok"`.
- [ ] Run `npm test` and record the actual result.
- [ ] Check that `logs/app.log` contains structured entries.
- [ ] Test keyboard navigation and a narrow/mobile viewport.

## Security and production notes

This is a learning capstone, not a security-audited production deployment. Before real public use, add authentication and role-based authorization, CSRF protections if cookie sessions are introduced, a persistent distributed rate limiter, secrets management, database backups, privacy/retention controls, HTTPS deployment, monitoring and dependency scanning. The current application endpoint is intentionally a public demo flow and does not include an administrator dashboard.

## Project structure

```text
edvyro-task5-production-capstone/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── test/
│   └── app.test.js
├── data/                 # created on first run
├── logs/                 # created on first run
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```

## Suggested GitHub description

Production-ready internship portal capstone built with Express, SQLite, HTML, CSS and JavaScript. Includes responsive UI, internship search/filter, application workflow, validation, structured logging, health checks, security headers, and automated API regression tests.
