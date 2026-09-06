import { Hono } from "hono";
import { env } from "../lib/env";
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";

const router = new Hono();

router.post("/stream", async (c) => {
  // Ensure we have the API key
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return c.json({ error: "OPENROUTER_API_KEY is not configured" }, 500);
  }

  // Parse incoming messages from the frontend
  const body = await c.req.json();
  const messages = body.messages || [];

  try {
    // Generate the streaming response using TanStack AI's chat
    const stream = chat({
      adapter: openRouterText("anthropic/claude-3.5-sonnet"),
      messages: messages,
    });

    return toServerSentEventsResponse(stream);
  } catch (error) {
    console.error("AI Stream Error:", error);
    return c.json({ error: "Failed to stream from AI provider" }, 500);
  }
});

export default router;
