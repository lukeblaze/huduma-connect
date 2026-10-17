const adminRequests = require("./requests");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });
  let captured;
  const proxy = { status: (code) => ({ json: (body) => { captured = { code, body }; return captured; } }) };
  await adminRequests({ ...request, method: "GET" }, proxy);
  if (!captured || captured.code !== 200) return response.status(captured?.code || 500).json(captured?.body || { error: "Unable to load analytics." });
  const rows = captured.body;
  return response.status(200).json({ total: rows.length, pending: rows.filter((row) => row.status === "Pending").length, inProgress: rows.filter((row) => row.status === "In Progress").length, resolved: rows.filter((row) => row.status === "Resolved").length });
};
