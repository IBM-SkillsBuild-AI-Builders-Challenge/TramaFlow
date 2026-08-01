import { NextResponse } from "next/server";

export async function GET() {
  const apiKey     = process.env.WATSONX_API_KEY;
  const projectId  = process.env.WATSONX_PROJECT_ID;
  const modelId    = process.env.WATSONX_MODEL    ?? "meta-llama/llama-3-3-70b-instruct";
  const serviceUrl = process.env.WATSONX_URL      ?? "https://us-south.ml.cloud.ibm.com";

  const missing: string[] = [];
  if (!apiKey)    missing.push("WATSONX_API_KEY");
  if (!projectId) missing.push("WATSONX_PROJECT_ID");
  if (missing.length > 0) {
    return NextResponse.json(
      { status: "error", message: `Missing: ${missing.join(", ")}` },
      { status: 500 }
    );
  }

  try {
    // 1. Get IAM token
    const tokenRes = await fetch("https://iam.cloud.ibm.com/identity/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey!)}`,
    });
    if (!tokenRes.ok) {
      throw new Error(`IAM error: ${tokenRes.status} ${await tokenRes.text()}`);
    }
    const { access_token } = await tokenRes.json();

    // 2. Ping watsonx with a minimal message
    const chatRes = await fetch(
      `${serviceUrl}/ml/v1/text/chat?version=2023-05-29`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          model_id:    modelId,
          project_id:  projectId,
          messages:    [{ role: "user", content: "Reply with only the word OK." }],
          max_tokens:  10,
          temperature: 0,
        }),
      }
    );
    if (!chatRes.ok) {
      throw new Error(`watsonx error: ${chatRes.status} ${await chatRes.text()}`);
    }
    const data  = await chatRes.json();
    const reply = data?.choices?.[0]?.message?.content ?? "(no reply)";

    return NextResponse.json({
      status: "ok",
      model:  modelId,
      reply:  reply.slice(0, 100),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status:  "error",
        message: err instanceof Error ? err.message : "Unknown error",
        hint:    "Check your WATSONX_API_KEY and WATSONX_PROJECT_ID in .env.local",
      },
      { status: 500 }
    );
  }
}
