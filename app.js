const authSection = document.querySelector("#auth");
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const authToggle = document.querySelector("#auth-toggle");
const authSubmit = document.querySelector("#auth-submit");
const logoutButton = document.querySelector("#logout-button");
const form = document.querySelector("#request-form");
const list = document.querySelector("#request-list");
const count = document.querySelector("#request-count");
const message = document.querySelector("#form-message");
let authMode = "signin";
let config;
let session = JSON.parse(localStorage.getItem("huduma-session") || "null");

async function getConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("Authentication is not configured.");
  return response.json();
}

async function authRequest(path, options = {}) {
  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    ...options,
    headers: { apikey: config.anonKey, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error_description || result.msg || result.message || "Authentication failed.");
  return result;
}

function setAuthState(nextSession) {
  session = nextSession;
  if (session) localStorage.setItem("huduma-session", JSON.stringify(session));
  else localStorage.removeItem("huduma-session");
  authSection.hidden = Boolean(session);
  logoutButton.hidden = !session;
  form.closest(".section").hidden = !session;
  document.querySelector("#requests").hidden = !session;
}

function renderRequests(requests) {
  count.textContent = `${requests.length} request${requests.length === 1 ? "" : "s"}`;
  if (!requests.length) {
    list.innerHTML = '<div class="empty-state"><span class="empty-icon">⌁</span><h3>No requests yet</h3><p>Your submitted requests and their updates will appear here.</p></div>';
    return;
  }
  list.innerHTML = requests.map((request) => `
    <article class="request-card">
      <span class="icon icon-blue">↗</span>
      <div><h3>${escapeHtml(request.title)}</h3><p>${escapeHtml(request.category)} · ${escapeHtml(request.reference)} · ${escapeHtml(formatDate(request.created_at))}</p></div>
      <span class="request-status">${escapeHtml(request.status || "Received")}</span>
    </article>`).join("");
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

async function loadRequests() {
  if (!session) return;
  try {
    const response = await fetch("/api/requests", { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!response.ok) throw new Error("Unable to load requests.");
    renderRequests(await response.json());
  } catch (error) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">!</span><h3>Requests are temporarily unavailable</h3><p>${escapeHtml(error.message)} Please refresh and try again.</p></div>`;
  }
}

authToggle.addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  authSubmit.textContent = authMode === "signin" ? "Sign in" : "Create account";
  authToggle.textContent = authMode === "signin" ? "Create account" : "I already have an account";
  document.querySelector("#auth-title").textContent = authMode === "signin" ? "Sign in to manage your requests" : "Create your free account";
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authSubmit.disabled = true;
  authMessage.hidden = true;
  try {
    const email = document.querySelector("#auth-email").value.trim();
    const password = document.querySelector("#auth-password").value;
    if (authMode === "signup") {
      await authRequest("signup", { method: "POST", body: JSON.stringify({ email, password }) });
      authMessage.hidden = false;
      authMessage.textContent = "Account created. Check your email to confirm it, then sign in.";
      authMode = "signin";
      authSubmit.textContent = "Sign in";
      authToggle.textContent = "Create account";
      return;
    }
    const result = await authRequest("token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
    setAuthState(result);
    await loadRequests();
  } catch (error) {
    authMessage.hidden = false;
    authMessage.className = "form-message form-error";
    authMessage.textContent = error.message;
  } finally {
    authSubmit.disabled = false;
  }
});

logoutButton.addEventListener("click", () => setAuthState(null));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({
      title: document.querySelector("#title").value.trim(),
      category: document.querySelector("#category").value,
      description: document.querySelector("#description").value.trim(),
      location: document.querySelector("#location").value.trim(),
      phone: document.querySelector("#phone").value.trim()
    })
  }).then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to submit request.");
    form.reset();
    message.hidden = false;
    message.className = "form-message";
    message.textContent = `Request submitted successfully. Your reference number is ${result.reference}.`;
    await loadRequests();
    document.querySelector("#requests").scrollIntoView({ behavior: "smooth" });
  }).catch((error) => {
    message.hidden = false;
    message.className = "form-message form-error";
    message.textContent = error.message;
  }).finally(() => {
    submitButton.disabled = false;
  });
});

document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(button.dataset.scroll).scrollIntoView({ behavior: "smooth" }));
});

getConfig().then((value) => {
  config = value;
  setAuthState(session);
  loadRequests();
}).catch((error) => {
  authMessage.hidden = false;
  authMessage.className = "form-message form-error";
  authMessage.textContent = error.message;
});
