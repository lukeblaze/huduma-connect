const requiredFields = ["title", "category", "description", "location", "phone"];

function json(status, body) {
  return {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body)
  };
}

function configurationError() {
  return json(500, { error: "The service is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel." });
}

async function supabaseRequest(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("CONFIGURATION");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Supabase request failed", response.status, body);
    throw new Error("DATABASE");
  }
  return body;
}

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const rows = await supabaseRequest("service_requests?select=id,reference,category,title,status,created_at&order=created_at.desc&limit=50");
      return response.status(200).json(rows);
    }
    if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });

    const data = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    if (!data || requiredFields.some((field) => typeof data[field] !== "string" || !data[field].trim())) {
      return response.status(400).json({ error: "Please complete all required fields." });
    }
    const values = Object.fromEntries(requiredFields.map((field) => [field, data[field].trim()]));
    if (values.title.length > 80 || values.description.length > 500) {
      return response.status(400).json({ error: "The title or description is too long." });
    }
    const reference = `HC-${Date.now().toString().slice(-7)}`;
    const rows = await supabaseRequest("service_requests", {
      method: "POST",
      body: JSON.stringify({ ...values, reference, status: "Received" })
    });
    const created = rows[0];
    return response.status(201).json({
      id: created.id,
      reference: created.reference,
      category: created.category,
      title: created.title,
      status: created.status,
      created_at: created.created_at
    });
  } catch (error) {
    if (error.message === "CONFIGURATION") return response.status(500).json(configurationError().body);
    return response.status(500).json({ error: "The request could not be completed. Please try again." });
  }
};
