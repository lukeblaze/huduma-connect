module.exports = function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response.status(500).json({ error: "Authentication is not configured." });
  return response.status(200).json({ url, anonKey });
};
