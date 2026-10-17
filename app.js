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
const notificationSection = document.querySelector("#notifications");
const notificationList = document.querySelector("#notification-list");
const notificationCount = document.querySelector("#notification-count");
const imageInput = document.querySelector("#image");
const imagePreview = document.querySelector("#image-preview");
const adminSearch = document.querySelector("#admin-search");
const adminFilter = document.querySelector("#admin-filter");
const modal = document.querySelector("#request-modal");
const modalContent = document.querySelector("#modal-content");
const toast = document.querySelector("#toast");
let adminRequests = [];
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
  notificationSection.hidden = !session;
  if (!session) adminSection.hidden = true;
  if (isAdminSession()) loadAdmin();
}

function isAdminSession() {
  return Boolean(session?.user?.email && config?.adminEmail &&
    session.user.email.trim().toLowerCase() === config.adminEmail.trim().toLowerCase());
}

async function validateSession() {
  if (!session?.access_token || !config?.url || !config?.anonKey) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${session.access_token}` }
  });
  if (!response.ok) {
    setAuthState(null);
    return null;
  }
  const user = await response.json();
  session.user = user;
  localStorage.setItem("huduma-session", JSON.stringify(session));
  return session;
}

function renderRequests(requests) {
  count.textContent = `${requests.length} request${requests.length === 1 ? "" : "s"}`;
  if (!requests.length) {
    list.innerHTML = '<div class="empty-state"><span class="empty-icon">⌁</span><h3>No requests yet</h3><p>Your submitted requests and their updates will appear here.</p></div>';
    return;
  }
  list.innerHTML = requests.map((request) => `
    <article class="request-card" tabindex="0" data-request-index="${requests.indexOf(request)}">
      <span class="icon icon-blue">↗</span>
      <div><h3>${escapeHtml(request.title)}</h3><p>${escapeHtml(request.category)} · ${escapeHtml(request.reference)} · ${escapeHtml(formatDate(request.created_at))}</p></div>
      <div class="request-card-actions"><span class="request-status">${escapeHtml(request.status || "Received")}</span><button class="text-button" data-view-request="${requests.indexOf(request)}" type="button">View details</button></div>
    </article>`).join("");
  list.querySelectorAll("[data-view-request]").forEach((button) => button.addEventListener("click", () => showRequestModal(requests[button.dataset.viewRequest])));
}

function showRequestModal(request) {
  const images = request.image_urls || (request.image_url ? [request.image_url] : []);
  modalContent.innerHTML = `<p class="modal-reference">${escapeHtml(request.reference)} · ${escapeHtml(formatDate(request.created_at))}</p><p>${escapeHtml(request.description || "No description provided.")}</p><div class="modal-meta"><span><b>Category</b>${escapeHtml(request.category)}</span><span><b>Location</b>${escapeHtml(request.location)}</span><span><b>Status</b>${escapeHtml(request.status || "Pending")}</span><span><b>Priority</b>${escapeHtml(request.priority || "Normal")}</span><span><b>Department</b>${escapeHtml(request.department || "General services")}</span></div><div id="history-timeline" class="history-timeline"><span class="muted">Loading timeline...</span></div>${request.status === "Resolved" && !request.feedback_rating ? `<form id="feedback-form" class="feedback-form"><h3>How was the service?</h3><label for="feedback-rating">Rating</label><select id="feedback-rating" required><option value="">Choose a rating</option><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Okay</option><option value="2">2 - Poor</option><option value="1">1 - Very poor</option></select><label for="feedback-comment">Comment (optional)</label><textarea id="feedback-comment" rows="2" maxlength="500" placeholder="Tell us how we did"></textarea><button class="button button-primary" type="submit">Send feedback</button><div id="feedback-message" class="form-message" hidden></div></form>` : request.feedback_rating ? `<p class="feedback-saved">You rated this service ${escapeHtml(request.feedback_rating)}/5.</p>` : ""}${images.length ? `<div class="modal-gallery">${images.map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="Uploaded request evidence"></a>`).join("")}</div>` : "<p class=\"muted\">No images attached.</p>"}`;
  document.querySelector("#modal-title").textContent = request.title;
  modal.hidden = false;
  document.querySelector("#modal-close").focus();
  loadHistory(request.id);
  const feedbackForm = document.querySelector("#feedback-form");
  if (feedbackForm) feedbackForm.addEventListener("submit", (event) => submitFeedback(event, request.id));
}

async function loadHistory(requestId) {
  const target = document.querySelector("#history-timeline");
  try {
    const response = await fetch(`/api/history?requestId=${encodeURIComponent(requestId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!response.ok) throw new Error("Timeline unavailable.");
    const history = await response.json();
    target.innerHTML = history.map((item) => `<div class="history-item"><span></span><div><strong>${escapeHtml(item.new_status)}</strong><p>${escapeHtml(item.note || "")} · ${escapeHtml(formatDate(item.created_at))}</p></div></div>`).join("") || '<span class="muted">No status history yet.</span>';
  } catch (error) {
    target.innerHTML = `<span class="muted">${escapeHtml(error.message)}</span>`;
  }
}

async function submitFeedback(event, requestId) {
  event.preventDefault();
  const feedbackMessage = document.querySelector("#feedback-message");
  const form = event.currentTarget;
  const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ requestId, rating: form.querySelector("#feedback-rating").value, comment: form.querySelector("#feedback-comment").value }) });
  const result = await response.json().catch(() => ({}));
  feedbackMessage.hidden = false;
  feedbackMessage.className = response.ok ? "form-message" : "form-message form-error";
  feedbackMessage.textContent = result.error || "Thank you for your feedback.";
  if (response.ok) {
    showToast("Feedback saved");
    form.remove();
    await loadRequests();
  }
}

function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => { toast.hidden = true; }, 3200);
}

function renderNotifications(requests, isAdmin = false) {
  const notifications = requests;
  notificationCount.textContent = `${notifications.length} update${notifications.length === 1 ? "" : "s"}`;
  notificationList.innerHTML = notifications.length ? notifications.map((item) => `<article class="notification-item ${item.is_read ? "read" : ""}"><span class="notification-icon">●</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message || item.text)}</p><small>${escapeHtml(formatDate(item.created_at))}</small></div></article>`).join("") : '<div class="empty-state"><h3>No new notifications</h3><p>Updates about your requests will appear here.</p></div>';
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
    const requests = await response.json();
    renderRequests(requests);
    const notificationResponse = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (notificationResponse.ok) renderNotifications(await notificationResponse.json());
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
      adminRequests = requests;
      const totals = await analyticsResponse.json();
      const notificationResponse = await fetch("/api/notifications", { headers });
      if (notificationResponse.ok) renderNotifications(await notificationResponse.json(), true);
      analytics.innerHTML = [["Total", totals.total], ["Pending", totals.pending], ["In progress", totals.inProgress], ["Resolved", totals.resolved]].map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
      renderAdminRequests();
    } catch (error) {
      adminMessage.hidden = false;
      adminMessage.className = "form-message form-error";
      adminMessage.textContent = error.message;
    }
  }

function renderAdminRequests() {
      const query = adminSearch.value.trim().toLowerCase();
      const status = adminFilter.value;
      const requests = adminRequests.filter((request) => {
        const matchesQuery = !query || [request.title, request.reference, request.location, request.category].some((value) => String(value || "").toLowerCase().includes(query));
        return matchesQuery && (status === "all" || request.status === status);
      });
      adminList.innerHTML = requests.length ? requests.map((request) => `
        <article class="admin-row">
          <div class="admin-details"><h3>${escapeHtml(request.title)}</h3><p>${escapeHtml(request.category)} · ${escapeHtml(request.location)} · ${escapeHtml(request.phone)} · ${escapeHtml(request.reference)}</p><p class="admin-description">${escapeHtml(request.description)}</p><div class="admin-links">${(request.image_urls || (request.image_url ? [request.image_url] : [])).map((url, index) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">View image ${index + 1}</a>`).join(" ") || "<span>No images attached</span>"}</div></div>
          <div class="admin-controls"><select data-request-id="${request.id}" data-field="status" aria-label="Update status for ${escapeHtml(request.title)}">
            ${["Pending", "In Progress", "Resolved"].map((status) => `<option ${status === request.status ? "selected" : ""}>${status}</option>`).join("")}
          </select><select data-request-id="${request.id}" data-field="priority" aria-label="Update priority for ${escapeHtml(request.title)}">${["Low", "Normal", "High", "Emergency"].map((priority) => `<option ${priority === (request.priority || "Normal") ? "selected" : ""}>${priority}</option>`).join("")}</select><select data-request-id="${request.id}" data-field="department" aria-label="Assign department for ${escapeHtml(request.title)}">${["General services", "Roads and transport", "Water and sanitation", "Street lighting", "Waste management", "Health services"].map((department) => `<option ${department === (request.department || "General services") ? "selected" : ""}>${department}</option>`).join("")}</select></div>
        </article>`).join("") : '<div class="empty-state"><h3>No submitted requests</h3><p>New citizen requests will appear here.</p></div>';
      adminList.querySelectorAll("select").forEach((select) => select.addEventListener("change", () => updateStatus(select.dataset.requestId, select.value, select.dataset.field)));
}

async function updateStatus(id, value, field = "status") {
    try {
      const response = await fetch(`/api/admin/requests?id=${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ [field]: value }) });
      if (!response.ok) throw new Error("Unable to update request status.");
      await loadAdmin();
      await loadRequests();
      showToast("Request status updated");
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
  submitButton.dataset.originalText = submitButton.textContent;
  submitButton.textContent = "Submitting...";
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
        priority: document.querySelector("#priority").value,
        department: document.querySelector("#department").value,
        images: await readImages()
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to submit request.");
    form.reset();
    message.hidden = false;
    message.className = "form-message";
    message.textContent = `Request submitted successfully. Your reference number is ${result.reference}.`;
    showToast("Request submitted successfully");
    await loadRequests();
    document.querySelector("#requests").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    message.hidden = false;
    message.className = "form-message form-error";
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = submitButton.dataset.originalText;
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

imageInput.addEventListener("change", () => {
  const files = Array.from(imageInput.files);
  imagePreview.innerHTML = files.map((file) => `<span class="preview-item"><img src="${URL.createObjectURL(file)}" alt=""><b>${escapeHtml(file.name)}</b></span>`).join("");
});

adminSearch.addEventListener("input", renderAdminRequests);
adminFilter.addEventListener("change", renderAdminRequests);
document.querySelector("#modal-close").addEventListener("click", () => { modal.hidden = true; });
modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") modal.hidden = true; });
document.querySelector("#menu-toggle").addEventListener("click", (event) => {
  const open = event.currentTarget.getAttribute("aria-expanded") === "true";
  event.currentTarget.setAttribute("aria-expanded", String(!open));
  document.querySelector(".nav").classList.toggle("nav-open", !open);
});
document.querySelector("#theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("huduma-theme", document.body.classList.contains("dark-mode") ? "dark" : "light");
});
if (localStorage.getItem("huduma-theme") === "dark") document.body.classList.add("dark-mode");

document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(button.dataset.scroll).scrollIntoView({ behavior: "smooth" }));
});
document.querySelector("#refresh-admin").addEventListener("click", loadAdmin);

configReady = getConfig().then(async (value) => {
  config = value;
  if (!config.url || !config.anonKey) throw new Error("Authentication configuration is incomplete.");
  await validateSession();
  setAuthState(session);
  loadRequests();
}).catch((error) => {
  config = null;
  authMessage.hidden = false;
  authMessage.className = "form-message form-error";
  authMessage.textContent = error.message;
});
