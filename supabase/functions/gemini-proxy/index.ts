// Setup & Deployment instructions for Supabase Edge Function:
// 1. Required Supabase Secrets:
//    - VERTEX_SERVICE_ACCOUNT_JSON (Full JSON contents of the GCP service account key with roles/aiplatform.user)
//    - VERTEX_PROJECT_ID (GCP Project ID, e.g. "stride-prod-12345" — optional if present in service account JSON)
//    - VERTEX_LOCATION (GCP region, e.g. "us-central1" — defaults to "us-central1")
// 2. Deploy using Supabase CLI:
//    supabase functions deploy gemini-proxy --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory token cache to avoid minting a new OAuth2 token on every invocation
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getVertexAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Date.now();
  // Return cached token if valid for at least 5 more minutes
  if (cachedToken && cachedToken.expiresAt > now + 300_000) {
    return cachedToken.accessToken;
  }

  // Normalize PEM key (handle literal escaped newlines from environment strings)
  const normalizedKey = privateKeyPem.replace(/\\n/g, "\n");
  const privateKey = await importPKCS8(normalizedKey, "RS256");

  // Sign RS256 assertion for Google OAuth2
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/cloud-platform",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text();
    throw new Error(`Failed to exchange service account JWT for access token: ${tokenRes.status} ${errorBody}`);
  }

  const tokenData = await tokenRes.json();
  const expiresInSeconds = tokenData.expires_in || 3600;

  cachedToken = {
    accessToken: tokenData.access_token,
    expiresAt: now + expiresInSeconds * 1000,
  };

  return cachedToken.accessToken;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, payload } = await req.json();

    // 2. Resolve Vertex AI credentials from Supabase secrets
    const saRaw = Deno.env.get("VERTEX_SERVICE_ACCOUNT_JSON");
    if (!saRaw) {
      return new Response(
        JSON.stringify({ error: "VERTEX_SERVICE_ACCOUNT_JSON secret is not configured in Supabase" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let serviceAccount: { client_email: string; private_key: string; project_id?: string };
    try {
      serviceAccount = JSON.parse(saRaw);
    } catch {
      return new Response(
        JSON.stringify({ error: "VERTEX_SERVICE_ACCOUNT_JSON is malformed JSON" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectId = Deno.env.get("VERTEX_PROJECT_ID") || serviceAccount.project_id;
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "VERTEX_PROJECT_ID is not configured and not found in service account JSON" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const location = Deno.env.get("VERTEX_LOCATION") || "us-central1";

    // 3. Mint / retrieve OAuth2 Bearer token
    const accessToken = await getVertexAccessToken(
      serviceAccount.client_email,
      serviceAccount.private_key
    );

    // 4. Construct real Vertex AI endpoint (draws directly from Google Cloud credits)
    const vertexEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent`;

    const STRIDE_BASE =
      "You are Stride, a warm and genuinely attentive companion for the user's day. You notice what matters to them and react like someone who's actually paying attention — not a neutral report generator. Stay concise. Don't perform enthusiasm for routine content, but when something is a real achievement, milestone, or win, say so plainly and warmly — a brief, genuine acknowledgment, not a paragraph of hype. Never invent dates or facts that were not mentioned.";

    let prompt = "";
    let systemInstruction = STRIDE_BASE;
    let temperature = 0.45;
    let contents: Array<{ role: string; parts: unknown[] }>;

    if (action === "understand_document") {
      systemInstruction +=
        " If this note or document describes an accomplishment, milestone, or personal best, acknowledge it briefly and specifically — reference the actual numbers and details, don't just say 'great job.' If it's routine content (a grocery list, a meeting note), stay calm and useful without forcing enthusiasm that doesn't fit. Never invent dates or facts that were not mentioned.";
      prompt = `Document Title: ${payload.title || "Untitled"}\n\nContent:\n${payload.text}\n\nProvide a summary under 3 sentences. Return JSON with format: {"summary": string, "extractedDates": string[]}`;
      contents = [{ role: "user", parts: [{ text: prompt }] }];
    } else if (action === "understand_image") {
      if (!payload?.imageBase64) {
        return new Response(
          JSON.stringify({ error: "imageBase64 is required for understand_image", code: "MISSING_IMAGE" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      systemInstruction +=
        " If the image shows a personal achievement (a workout log, a completed project, a milestone), acknowledge what you actually see. If it's a document, receipt, or reference material, summarize what's useful from it. Never invent dates or facts that were not mentioned.";
      prompt = `Image context title: ${payload.title || "Image"}. Describe what is actually visible. Return JSON with format: {"summary": string}`;
      // Vertex generateContent REST JSON uses camelCase inlineData / mimeType
      // (not the Developer API curl convention inline_data / mime_type).
      contents = [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: payload.mimeType || "image/jpeg", data: payload.imageBase64 } },
        ],
      }];
    } else if (action === "extract_actions") {
      systemInstruction =
        "Extract actionable tasks from freeform text. Be fast and accurate. Never invent dates that were not mentioned.";
      temperature = 0.2;
      prompt = `Freeform text: "${payload.freeText}"\n\nReturn JSON array of items: [{"title": string, "project"?: string, "dueDate"?: string, "priority": "low"|"normal"|"high"}]`;
      contents = [{ role: "user", parts: [{ text: prompt }] }];
    } else if (action === "build_daily_plan") {
      systemInstruction += " Given tasks and user schedule, order tasks logically. Never invent dates or facts that were not mentioned.";
      prompt = `Tasks: ${JSON.stringify(payload.tasks)}\nProfile rhythm: ${JSON.stringify(payload.profile)}\n\nReturn JSON: {"orderedTaskIds": string[], "note": string}`;
      contents = [{ role: "user", parts: [{ text: prompt }] }];
    } else if (action === "suggest_related_context") {
      systemInstruction += " Identify which analyzed context items genuinely relate to the given task. Never invent dates or facts that were not mentioned.";
      prompt = `Task: ${payload.taskTitle}\nDescription: ${payload.taskDesc || "None"}\n\nAvailable Context Items:\n${JSON.stringify(payload.candidates)}\n\nReturn JSON: {"relatedContextIds": string[], "reasoning": string}`;
      contents = [{ role: "user", parts: [{ text: prompt }] }];
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vertexRes = await fetch(vertexEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          responseMimeType: "application/json",
          temperature,
        },
      }),
    });

    if (!vertexRes.ok) {
      const errBody = await vertexRes.text();
      const status = vertexRes.status;
      const isRateLimit = status === 429 || errBody.includes("RESOURCE_EXHAUSTED");
      return new Response(
        JSON.stringify({
          error: isRateLimit ? "Gemini rate limit reached" : `Vertex AI error (${status}): ${errBody}`,
        }),
        {
          status: isRateLimit ? 429 : status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const vertexData = await vertexRes.json();
    const rawContent = vertexData.candidates?.[0]?.content?.parts?.[0]?.text;

    // Sanitize any markdown JSON fencing before parsing
    const cleanedJson = (rawContent || "{}")
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(cleanedJson || "{}");

    return new Response(JSON.stringify({ result: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
