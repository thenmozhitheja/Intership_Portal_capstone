const grid = document.getElementById("internship-grid");
const searchInput = document.getElementById("search-input");
const domainFilter = document.getElementById("domain-filter");
const resultCount = document.getElementById("result-count");
const message = document.getElementById("message");
const dialog = document.getElementById("apply-dialog");
const form = document.getElementById("application-form");
const formMessage = document.getElementById("form-message");
const submitButton = document.getElementById("submit-application");
let allInternships = [];
let searchTimer;

document.getElementById("year").textContent = new Date().getFullYear();

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

async function checkHealth() {
  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  try {
    const health = await requestJson("/api/health");
    dot.className = "status-dot online";
    text.textContent = health.database === "connected" ? "Portal online · database connected" : "Portal online";
  } catch {
    dot.className = "status-dot offline";
    text.textContent = "Service temporarily unavailable";
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function roleIcon(domain) {
  const d = String(domain).toLowerCase();
  if (d.includes("data")) return ["▥", "green-bg"];
  if (d.includes("backend") || d.includes("python")) return ["⌘", "blue-bg"];
  if (d.includes("ai") || d.includes("prompt")) return ["✧", "orange-bg"];
  return ["✳", ""];
}
function renderInternships(items) {
  if (!items.length) {
    grid.innerHTML = '<div class="empty-state"><strong>No matching opportunities yet.</strong>Try a different search term or domain.</div>';
    resultCount.textContent = "0 opportunities";
    return;
  }
  resultCount.textContent = `${items.length} ${items.length === 1 ? "opportunity" : "opportunities"}`;
  grid.innerHTML = items.map(item => {
    const [icon, color] = roleIcon(item.domain);
    return `<article class="internship-card">
      <div class="card-topline"><span class="role-icon ${color}" aria-hidden="true">${icon}</span><span class="badge">${item.applications_open ? "● Accepting applications" : "Applications closed"}</span></div>
      <h3>${escapeHtml(item.title)}</h3>
      <span class="domain-label">${escapeHtml(item.domain)}</span>
      <p class="card-description">${escapeHtml(item.description)}</p>
      <div class="card-meta"><span aria-label="Work mode">◷ ${escapeHtml(item.mode)}</span><span aria-label="Duration">▦ ${Number(item.duration_weeks)} weeks</span><span aria-label="Applications received">♧ ${Number(item.application_count || 0)} applied</span></div>
      <div class="card-bottomline"><small>Practical learning · Career growth</small><button class="apply-button" data-apply="${Number(item.id)}" ${item.applications_open ? "" : "disabled"}>${item.applications_open ? "Apply now →" : "Closed"}</button></div>
    </article>`;
  }).join("");
}
function applyFilters() {
  const term = searchInput.value.trim().toLowerCase();
  const domain = domainFilter.value;
  const filtered = allInternships.filter(item => {
    const matchesTerm = !term || [item.title, item.domain, item.description, item.mode].some(value => String(value).toLowerCase().includes(term));
    return matchesTerm && (!domain || item.domain === domain);
  });
  renderInternships(filtered);
}
async function loadInternships() {
  grid.innerHTML = '<div class="loading-card">Finding opportunities for you…</div>';
  message.hidden = true;
  try {
    const result = await requestJson("/api/internships");
    allInternships = result.data || [];
    const domains = [...new Set(allInternships.map(item => item.domain))].sort();
    domainFilter.innerHTML = '<option value="">All domains</option>' + domains.map(domain => `<option value="${escapeHtml(domain)}">${escapeHtml(domain)}</option>`).join("");
    applyFilters();
  } catch (error) {
    grid.innerHTML = '<div class="empty-state"><strong>We couldn’t load opportunities.</strong>Please check that the server is running, then refresh.</div>';
    resultCount.textContent = "Unable to load";
    message.textContent = error.message;
    message.hidden = false;
  }
}
function openApplication(id) {
  const item = allInternships.find(internship => Number(internship.id) === Number(id));
  if (!item) return;
  form.reset();
  document.getElementById("internship-id").value = item.id;
  document.getElementById("dialog-title").textContent = "Apply for this role";
  document.getElementById("dialog-role").textContent = `${item.title} · ${item.domain}`;
  formMessage.textContent = "";
  formMessage.className = "form-message";
  dialog.showModal();
  document.getElementById("applicant-name").focus();
}

grid.addEventListener("click", event => {
  const button = event.target.closest("[data-apply]");
  if (button && !button.disabled) openApplication(button.dataset.apply);
});
document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilters, 150);
});
domainFilter.addEventListener("change", applyFilters);

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  submitButton.disabled = true;
  submitButton.textContent = "Submitting…";
  formMessage.textContent = "";
  formMessage.className = "form-message";
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.internship_id = Number(payload.internship_id);
  try {
    const result = await requestJson("/api/applications", { method: "POST", body: JSON.stringify(payload) });
    formMessage.textContent = result.message || "Application submitted successfully.";
    formMessage.className = "form-message success";
    form.reset();
    await loadInternships();
    setTimeout(() => dialog.close(), 1400);
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.className = "form-message";
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Submit application <span aria-hidden="true">→</span>';
  }
});

checkHealth();
loadInternships();
setInterval(checkHealth, 30000);
