const authSection = document.querySelector("#auth");
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const authToggle = document.querySelector("#auth-toggle");
const authSubmit = document.querySelector("#auth-submit");
const logoutButton = document.querySelector("#logout-button");
const adminSection = document.querySelector("#admin");
const adminList = document.querySelector("#admin-list");
const analytics = document.querySelector("#analytics");
const adminMessage = document.querySelector("#admin-message");
const form = document.querySelector("#request-form");
const list = document.querySelector("#request-list");
const count = document.querySelector("#request-count");
const message = document.querySelector("#form-message");
let authMode = "signin";
let config;
let configReady;
let session = JSON.parse(localStorage.getItem("huduma-session") || "null");

async function getConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("Authentication is not configured.");
  return response.json();
}

async function authRequest(path, options = {}) {
  await configReady;
  if (!config?.url || !config?.anonKey) throw new Error("Authentication configuration is missing. Please refresh and try again.");
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
  if (!session) adminSection.hidden = true;
  if (isAdminSession()) loadAdmin();
}

function isAdminSession() {
  return Boolean(session?.user?.email && config?.adminEmail &&
    session.user.email.trim().toLowerCase() === config.adminEmail.trim().toLowerCase());
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

async function loadAdmin() {
    if (!isAdminSession()) return;
    adminSection.hidden = false;
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [requestsResponse, analyticsResponse] = await Promise.all([
        fetch("/api/admin/requests", { headers }),
        fetch("/api/admin/analytics", { headers })
      ]);
      if (!requestsResponse.ok) {
        const details = await requestsResponse.json().catch(() => ({}));
        throw new Error(details.error || "Unable to load admin requests.");
      }
      if (!analyticsResponse.ok) {
        const details = await analyticsResponse.json().catch(() => ({}));
        throw new Error(details.error || "Unable to load admin analytics.");
      }
      const requests = await requestsResponse.json();
      const totals = await analyticsResponse.json();
      analytics.innerHTML = [["Total", totals.total], ["Pending", totals.pending], ["In progress", totals.inProgress], ["Resolved", totals.resolved]].map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
      adminList.innerHTML = requests.length ? requests.map((request) => `
        <article class="admin-row">
          <div><h3>${escapeHtml(request.title)}</h3><p>${escapeHtml(request.category)} · ${escapeHtml(request.location)} · ${escapeHtml(request.phone)} · ${escapeHtml(request.reference)}</p>${(request.image_urls || (request.image_url ? [request.image_url] : [])).map((url, index) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">View image ${index + 1}</a>`).join(" ")}</div>
          <select data-request-id="${request.id}" aria-label="Update status for ${escapeHtml(request.title)}">
            ${["Pending", "In Progress", "Resolved"].map((status) => `<option ${status === request.status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </article>`).join("") : '<div class="empty-state"><h3>No submitted requests</h3><p>New citizen requests will appear here.</p></div>';
      adminList.querySelectorAll("select").forEach((select) => select.addEventListener("change", () => updateStatus(select.dataset.requestId, select.value)));
    } catch (error) {
      adminMessage.hidden = false;
      adminMessage.className = "form-message form-error";
      adminMessage.textContent = error.message;
    }
  }

async function updateStatus(id, status) {
    try {
      const response = await fetch(`/api/admin/requests?id=${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error("Unable to update request status.");
      await loadAdmin();
      await loadRequests();
    } catch (error) {
      adminMessage.hidden = false;
      adminMessage.className = "form-message form-error";
      adminMessage.textContent = error.message;
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
  try {
    await configReady;
    if (!session?.access_token) throw new Error("Please sign in before submitting a request.");
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        title: document.querySelector("#title").value.trim(),
        category: document.querySelector("#category").value,
        description: document.querySelector("#description").value.trim(),
        location: document.querySelector("#location").value.trim(),
        phone: document.querySelector("#phone").value.trim(),
        images: await readImages()
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to submit request.");
    form.reset();
    message.hidden = false;
    message.className = "form-message";
    message.textContent = `Request submitted successfully. Your reference number is ${result.reference}.`;
    await loadRequests();
    document.querySelector("#requests").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    message.hidden = false;
    message.className = "form-message form-error";
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }

});

async function readImages() {
  const files = Array.from(document.querySelector("#image").files);
  if (files.length > 5) throw new Error("You can attach up to 5 images.");
  if (files.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type))) {
    throw new Error("Only PNG, JPEG, and WebP images are supported.");
  }
  const images = await Promise.all(files.map((file) => compressImage(file)));
  if (images.reduce((total, image) => total + image.data.length, 0) > 4_000_000) {
    throw new Error("The selected images are too large together. Choose fewer or smaller images.");
  }
  return images;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve({
        name: file.name,
        type: "image/jpeg",
        data: canvas.toDataURL("image/jpeg", 0.78)
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read an image."));
    };
    image.src = objectUrl;
  });
}

document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(button.dataset.scroll).scrollIntoView({ behavior: "smooth" }));
});
document.querySelector("#refresh-admin").addEventListener("click", loadAdmin);

configReady = getConfig().then((value) => {
  config = value;
  if (!config.url || !config.anonKey) throw new Error("Authentication configuration is incomplete.");
  setAuthState(session);
  loadRequests();
}).catch((error) => {
  config = null;
  authMessage.hidden = false;
  authMessage.className = "form-message form-error";
  authMessage.textContent = error.message;
});
