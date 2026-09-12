// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This is a minimal, secure proxy for Google Cloud Vertex AI / Gemini.
// Secrets:
// VERTEX_PROJECT_ID, VERTEX_LOCATION (e.g. us-central1), VERTEX_SERVICE_ACCOUNT_KEY or GEMINI_API_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // 2. Resolve Vertex AI or Gemini API key from environment secrets
    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VERTEX_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini / Vertex API credentials not configured in Supabase secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Gemini 1.5 Flash endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    let prompt = "";
    let systemInstruction = "You are Stride AI, an intelligent executive productivity engine.";

    if (action === "understand_document") {
      systemInstruction += " Analyze the document objectively. Return a concise summary of the key commitments, dates, and takeaways.";
      prompt = `Document Title: ${payload.title || "Untitled"}\n\nContent:\n${payload.text}\n\nProvide a summary under 3 sentences. Return JSON with format: {"summary": string, "extractedDates": string[]}`;
    } else if (action === "understand_image") {
      systemInstruction += " Analyze this visual context note. Summarize visible text, action items, or whiteboard notes.";
      prompt = `Image context title: ${payload.title || "Image"}. Return JSON with format: {"summary": string}`;
    } else if (action === "extract_actions") {
      systemInstruction += " Extract actionable tasks from freeform text. Never invent dates that were not mentioned.";
      prompt = `Freeform text: "${payload.freeText}"\n\nReturn JSON array of items: [{"title": string, "project"?: string, "dueDate"?: string, "priority": "low"|"normal"|"high"}]`;
    } else if (action === "build_daily_plan") {
      systemInstruction += " Given tasks and user schedule, order tasks logically.";
      prompt = `Tasks: ${JSON.stringify(payload.tasks)}\nProfile rhythm: ${JSON.stringify(payload.profile)}\n\nReturn JSON: {"orderedTaskIds": string[], "note": string}`;
    } else if (action === "suggest_related_context") {
      systemInstruction += " Identify which analyzed context items genuinely relate to the given task.";
      prompt = `Task: ${payload.taskTitle}\nDescription: ${payload.taskDesc || "None"}\n\nAvailable Context Items:\n${JSON.stringify(payload.candidates)}\n\nReturn JSON: {"relatedContextIds": string[], "reasoning": string}`;
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      return new Response(JSON.stringify({ error: `Gemini API error: ${geminiRes.status} ${errBody}` }), {
        status: geminiRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiRes.json();
    const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawContent || "{}");

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
