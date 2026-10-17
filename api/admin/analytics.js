async function userFromToken(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw new Error("UNAUTHORIZED");
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("UNAUTHORIZED");
  return response.json();
}

async function db(path) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.hint || "Database request failed.");
  return body;
}

module.exports = async function handler(request, response) {
  try {
    if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });
    const user = await userFromToken(request);
    if (!process.env.ADMIN_EMAIL || user.email?.trim().toLowerCase() !== process.env.ADMIN_EMAIL.trim().toLowerCase()) {
      return response.status(403).json({ error: "Administrator access required." });
    }
    const rows = await db("service_requests?select=status&limit=10000");
    return response.status(200).json({
      total: rows.length,
      pending: rows.filter((row) => row.status === "Pending").length,
      inProgress: rows.filter((row) => row.status === "In Progress").length,
      resolved: rows.filter((row) => row.status === "Resolved").length
    });
  } catch (error) {
    console.error("Admin analytics failed", error);
    return response.status(error.message === "UNAUTHORIZED" ? 401 : 500).json({ error: error.message || "Unable to load analytics." });
  }
};
