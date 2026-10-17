async function userFromToken(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw new Error("UNAUTHORIZED");
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("UNAUTHORIZED");
  return response.json();
}

module.exports = async function handler(request, response) {
  try {
    const user = await userFromToken(request);
    const requestId = request.query?.requestId;
    if (!requestId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return response.status(400).json({ error: "A request id is required." });
    const url = `${process.env.SUPABASE_URL}/rest/v1/request_status_history?select=id,previous_status,new_status,note,created_at,request_id&request_id=eq.${encodeURIComponent(requestId)}&order=created_at.asc`;
    const rows = await fetch(url, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!rows.ok) throw new Error("History is unavailable.");
    const history = await rows.json();
    const owner = await fetch(`${process.env.SUPABASE_URL}/rest/v1/service_requests?id=eq.${encodeURIComponent(requestId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!(await owner.json()).length) return response.status(404).json({ error: "Request not found." });
    return response.status(200).json(history);
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return response.status(401).json({ error: "Please sign in." });
    console.error("History operation failed", error);
    return response.status(500).json({ error: error.message || "History is unavailable." });
  }
};
