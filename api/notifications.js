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
    if (request.method === "GET") {
      const isAdmin = process.env.ADMIN_EMAIL && user.email?.trim().toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase();
      const filter = isAdmin ? `or=(user_id.eq.${encodeURIComponent(user.id)},audience.eq.admin)` : `user_id=eq.${encodeURIComponent(user.id)}`;
      const rows = await db(`notifications?select=id,request_id,title,message,is_read,created_at&${filter}&order=created_at.desc&limit=50`);
      return response.status(200).json(rows);
    }
    if (request.method !== "PATCH") return response.status(405).json({ error: "Method not allowed." });
    const id = request.query?.id;
    if (!id) return response.status(400).json({ error: "A notification id is required." });
    const rows = await db(`notifications?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ is_read: true }) });
    return response.status(200).json(rows[0] || {});
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return response.status(401).json({ error: "Please sign in." });
    console.error("Notification operation failed", error);
    return response.status(500).json({ error: error.message || "Notifications are unavailable." });
  }
};
