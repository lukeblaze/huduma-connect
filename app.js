const form = document.querySelector("#request-form");
const list = document.querySelector("#request-list");
const count = document.querySelector("#request-count");
const message = document.querySelector("#form-message");

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
  try {
    const response = await fetch("/api/requests");
    if (!response.ok) throw new Error("Unable to load requests.");
    renderRequests(await response.json());
  } catch (error) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">!</span><h3>Requests are temporarily unavailable</h3><p>${escapeHtml(error.message)} Please refresh and try again.</p></div>`;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

loadRequests();
