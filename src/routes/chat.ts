import { Hono } from "hono";
import { env } from "../lib/env";
import { createOpenRouter } from "@tanstack/ai";
import { streamText } from "@tanstack/ai";

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

  // Initialize the native OpenRouter adapter
  const openrouter = createOpenRouter({
    apiKey: apiKey,
  });

  try {
    // Generate the streaming response using TanStack AI's streamText
    const result = await streamText({
      model: openrouter("anthropic/claude-3.5-sonnet"), // Default model, can be made dynamic
      messages: messages,
      // You can add TanStack server functions here in the tools array if desired:
      // tools: { ... },
    });

    // streamText returns a Response object heavily optimized for standard Web Streams
    return result.toDataStreamResponse();
  } catch (error) {
    console.error("AI Stream Error:", error);
    return c.json({ error: "Failed to stream from AI provider" }, 500);
  }
});

export default router;
