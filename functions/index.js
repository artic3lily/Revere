const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");

const SYSTEM_PROMPT = `
You are a fashion-only assistant for a thrift shopping app named "Revere".
Only discuss fashion, outfits, styling, colors, fabrics, sizing, fit, accessories,
thrift shopping tips, sustainable fashion, and product recommendations.
If the user asks anything outside fashion, refuse briefly and redirect to fashion.
Be friendly, concise, and practical. Ask 1–2 clarifying questions when needed.
`;

exports.fashionChat = onCall(
  {
    secrets: [GROQ_API_KEY],
    allowUnauthenticated: true,
  },
  async (request) => {
    try {
      const messages = request.data?.messages;

      if (!Array.isArray(messages)) {
        throw new HttpsError("invalid-argument", "messages must be an array");
      }

      // ✅ IMPORTANT: read secret from env at runtime
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        logger.error("Missing GROQ_API_KEY in environment");
        throw new HttpsError("failed-precondition", "Server is missing API key");
      }

      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          temperature: 0.7,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        logger.error("Groq API error", { status: resp.status, data });
        throw new HttpsError(
          "internal",
          data?.error?.message || `Groq request failed (${resp.status})`
        );
      }

      const text = data.choices?.[0]?.message?.content?.trim() || "";
      return { role: "assistant", content: text };
    } catch (err) {
      logger.error("fashionChat crashed", err);

      // If it’s already an HttpsError, throw as-is
      if (err instanceof HttpsError) throw err;

      // convert to a proper callable error
      throw new HttpsError("internal", err?.message || "Unknown error");
    }
  }
);
