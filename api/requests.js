const requiredFields = ["title", "category", "description", "location", "phone"];

function json(status, body) {
  return {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body)
  };
}

function configurationError() {
  return json(500, { error: "The service is not configured. Add Supabase variables in Vercel." });
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
    const error = new Error("DATABASE");
    error.details = body?.message || body?.hint || body?.details || "";
    throw error;
  }
  return body;
}

async function getUser(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) throw new Error("UNAUTHORIZED");
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error("UNAUTHORIZED");
  return response.json();
}

module.exports = async function handler(request, response) {
  try {
    const user = await getUser(request);
    if (request.method === "GET") {
      const rows = await supabaseRequest(`service_requests?select=id,reference,category,title,status,created_at&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=50`);
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
    const imageUrls = await uploadImages(data.images || (data.image ? [data.image] : []), reference);
    const rows = await supabaseRequest("service_requests", {
      method: "POST",
      body: JSON.stringify({ ...values, reference, status: "Pending", user_id: user.id, image_url: imageUrls[0] || null, image_urls: imageUrls })
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
    if (error.message === "UNAUTHORIZED") return response.status(401).json({ error: "Please sign in to continue." });
    if (error.message === "IMAGE") return response.status(400).json({ error: "The image must be a PNG, JPEG, or WebP file smaller than 3 MB." });
    if (error.message === "CONFIGURATION") return response.status(500).json(configurationError().body);
    console.error("Request handler failed", error);
    return response.status(500).json({ error: error.details || "The request could not be completed. Please try again." });
  }
};

async function uploadImages(images, reference) {
  if (!Array.isArray(images) || images.length > 5) throw new Error("IMAGE");
  const urls = [];
  for (const [index, image] of images.entries()) {
    if (!image || !/^data:image\/(png|jpeg|webp);base64,/.test(image.data) || image.data.length > 4_500_000) throw new Error("IMAGE");
    const content = Buffer.from(image.data.split(",")[1], "base64");
    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    const path = `requests/${reference}-${index + 1}.${extension}`;
    const response = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/request-images/${path}`, { method: "POST", headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": image.type, "x-upsert": "true" }, body: content });
    if (!response.ok) {
      const storageError = await response.json().catch(() => ({}));
      const error = new Error("IMAGE");
      error.details = storageError.message || storageError.error || `Storage upload failed (${response.status}).`;
      throw error;
    }
    urls.push(`${process.env.SUPABASE_URL}/storage/v1/object/public/request-images/${path}`);
  }
  return urls;
}
