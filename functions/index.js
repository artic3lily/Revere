const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");

// Initialize admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

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

      // IMPORTANT: read secret from env at runtime
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

// ✅ Secure endpoint to edit post details - validates ownership and sold status
exports.editPost = onCall(async (request) => {
  try {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be signed in to edit posts");
    }

    const { postId, caption, price, tags } = request.data;

    if (!postId) {
      throw new HttpsError("invalid-argument", "postId is required");
    }

    // Validate inputs
    if (caption !== undefined && !caption.toString().trim()) {
      throw new HttpsError("invalid-argument", "Caption cannot be empty");
    }
    if (price !== undefined) {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        throw new HttpsError("invalid-argument", "Price must be a valid positive number");
      }
    }
    if (tags !== undefined && !Array.isArray(tags)) {
      throw new HttpsError("invalid-argument", "Tags must be an array");
    }

    const db = admin.firestore();
    const postRef = db.collection("posts").doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists()) {
      throw new HttpsError("not-found", "Post not found");
    }

    const postData = postSnap.data();

    // ✅ Verify user owns the post
    if (postData.ownerId !== userId) {
      throw new HttpsError("permission-denied", "You can only edit your own posts");
    }

    // ✅ CRITICAL: Prevent editing if post is sold
    if (postData.sold === true) {
      throw new HttpsError(
        "failed-precondition",
        "Cannot edit posts that have already been sold"
      );
    }

    // Prepare update data
    const updateData = {};
    if (caption !== undefined) updateData.caption = caption.toString().trim();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (tags !== undefined) updateData.tags = tags.filter(t => t.trim()).map(t => t.trim());

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    // Perform update
    await postRef.update(updateData);

    logger.info(`Post ${postId} edited by user ${userId}`);
    return { success: true, message: "Post updated successfully" };
  } catch (err) {
    logger.error("editPost error:", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err?.message || "Failed to edit post");
  }
});
