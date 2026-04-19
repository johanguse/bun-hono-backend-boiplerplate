import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod/v4";
import { env } from "../../lib/env";
import { authMiddleware, requireAuth } from "../../middleware";

const chatRouter = new Hono();

chatRouter.use("*", authMiddleware, requireAuth);

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
});

/**
 * Stream chat completions via OpenRouter (Server-Sent plain text stream).
 * Compatible with Expo / React Native streaming fetch.
 * POST /chat/stream
 */
chatRouter.post("/stream", zValidator("json", chatRequestSchema), async (c) => {
  if (!env.OPENROUTER_API_KEY) {
    return c.json({ detail: "OPENROUTER_API_KEY is not configured" }, 500);
  }

  const { messages } = c.req.valid("json");

  return stream(c, async (s) => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": env.FRONTEND_URL,
        },
        body: JSON.stringify({
          model: env.AI_MODEL,
          messages,
          stream: true,
          max_tokens: env.AI_MAX_TOKENS,
        }),
      });

      if (!response.ok || !response.body) {
        await s.write(`[Error: OpenRouter returned ${response.status}]`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });

        // OpenRouter returns SSE lines: "data: {...}\n\n" — extract content
        for (const line of raw.split("\n")) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const json = JSON.parse(line.slice(6));
            const content: string | undefined = json?.choices?.[0]?.delta?.content;
            if (content) {
              await s.write(content);
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      console.error("Chat stream error:", err);
      await s.write(`\n[Error: ${err instanceof Error ? err.message : "Unknown error"}]`);
    }
  });
});

export default chatRouter;
