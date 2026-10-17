const statuses = ["Pending", "In Progress", "Resolved"];

async function userFromToken(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw new Error("UNAUTHORIZED");
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("UNAUTHORIZED");
  return response.json();
}

function requireAdmin(user) {
  if (!process.env.ADMIN_EMAIL || user.email?.trim().toLowerCase() !== process.env.ADMIN_EMAIL.trim().toLowerCase()) throw new Error("FORBIDDEN");
}

async function db(path, options = {}) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("CONFIGURATION");
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(options.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error("DATABASE");
    error.details = body?.message || body?.hint || body?.details || (typeof body === "string" ? body : JSON.stringify(body)) || "Database request failed.";
    throw error;
  }
  return body;
}

module.exports = async function handler(request, response) {
  try {
    const user = await userFromToken(request);
    requireAdmin(user);
    if (request.method === "GET") {
      const rows = await db("service_requests?select=id,user_id,reference,category,title,description,location,phone,status,priority,department,image_url,image_urls,feedback_rating,feedback_comment,created_at&order=created_at.desc&limit=200");
      return response.status(200).json(rows);
    }
    if (request.method !== "PATCH") return response.status(405).json({ error: "Method not allowed." });
    const id = request.query?.id;
    const data = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const priorities = ["Low", "Normal", "High", "Emergency"];
    const departments = ["General services", "Roads and transport", "Water and sanitation", "Street lighting", "Waste management", "Health services"];
    if (!id || (data?.status && !statuses.includes(data.status)) || (data?.priority && !priorities.includes(data.priority)) || (data?.department && !departments.includes(data.department))) return response.status(400).json({ error: "A valid request update is required." });
    const current = await db(`service_requests?id=eq.${encodeURIComponent(id)}&select=id,user_id,reference,status`);
    if (!current[0]) return response.status(404).json({ error: "Request not found." });
    const changes = {};
    if (data.status) changes.status = data.status;
    if (data.priority) changes.priority = data.priority;
    if (data.department) changes.department = data.department;
    const rows = await db(`service_requests?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) });
    if (data.status && current[0].status !== data.status) {
      await db("request_status_history", { method: "POST", body: JSON.stringify({ request_id: id, changed_by: user.id, previous_status: current[0].status, new_status: data.status, note: `Status changed by administrator` }) });
      await db("notifications", { method: "POST", body: JSON.stringify({ user_id: current[0].user_id, audience: "citizen", request_id: id, title: "Request status updated", message: `${current[0].reference} is now ${data.status}.` }) });
    }
    return response.status(200).json(rows[0]);
  } catch (error) {
    if (error.message === "UNAUTHORIZED") return response.status(401).json({ error: "Please sign in." });
    if (error.message === "FORBIDDEN") return response.status(403).json({ error: "Administrator access required." });
    console.error("Admin request operation failed", error);
    return response.status(500).json({ error: error.details || "The admin operation could not be completed." });
  }
};
