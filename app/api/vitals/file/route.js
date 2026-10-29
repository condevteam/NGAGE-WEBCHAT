export async function POST(request) {
  const backend = process.env.CHAT_BACKEND_URL || process.env.NEXT_PUBLIC_CHAT_BACKEND_URL || "http://localhost:9090";
  try {
    const response = await fetch(`${backend}/api/external/chatbot/vital-file`, {
      method: "POST",
      body: await request.formData(),
      cache: "no-store",
    });
    const raw = await response.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      body = { error: response.ok ? "Unexpected upload response" : "Upload failed" };
    }
    return new Response(JSON.stringify(body), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json({ error: "Upload service is unavailable" }, { status: 502 });
  }
}
