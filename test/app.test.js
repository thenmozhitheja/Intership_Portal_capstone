const test = require("node:test");
const assert = require("node:assert/strict");
const { app, db } = require("../server");

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
});

test("health endpoint reports service and database status", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.database, "connected");
});

test("internships endpoint returns seeded opportunities", async () => {
  const response = await fetch(`${baseUrl}/api/internships`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length >= 1);
  assert.ok(body.data[0].title);
});

test("application endpoint validates malformed requests", async () => {
  const response = await fetch(`${baseUrl}/api/applications`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ internship_id: 1, applicant_name: "A", applicant_email: "not-an-email" })
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /Name|email/i);
});

test("unknown API routes return JSON 404", async () => {
  const response = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.error, "API endpoint not found.");
});
