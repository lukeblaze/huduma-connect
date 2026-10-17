async function userFromToken(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw new Error("UNAUTHORIZED");
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("UNAUTHORIZED");
  return response.json();
}

async function db(path, options = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(options.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Database request failed.");
  return body;
}

module.exports = async function handler(request, response) {
  try {
    const user = await userFromToken(request);
    if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
    const data = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const rating = Number(data?.rating);
    if (!data?.requestId || !Number.isInteger(rating) || rating < 1 || rating > 5) return response.status(400).json({ error: "Choose a rating from 1 to 5." });
    const requests = await db(`service_requests?id=eq.${encodeURIComponent(data.requestId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,status`);
    if (!requests[0]) return response.status(404).json({ error: "Request not found." });
    if (requests[0].status !== "Resolved") return response.status(400).json({ error: "Feedback is available after a request is resolved." });
    const rows = await db(`service_requests?id=eq.${encodeURIComponent(data.requestId)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ feedback_rating: rating, feedback_comment: String(data.comment || "").trim().slice(0, 500), feedback_at: new Date().toISOString() }) });
    return response.status(200).json(rows[0]);
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return response.status(401).json({ error: "Please sign in." });
    console.error("Feedback operation failed", error);
    return response.status(500).json({ error: error.message || "Feedback could not be saved." });
  }
};
