import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable, agentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { callGeminiWithHistory, callQwenWithHistory, getAgentSystemPrompt, isArabicDominant } from "../lib/ai.js";

const router = Router();

router.get("/", async (_req, res) => {
  const convs = await db.select().from(conversationsTable).orderBy(desc(conversationsTable.created_at)).limit(20);
  res.json(convs.map(c => ({
    ...c,
    created_at: c.created_at?.toISOString() || new Date().toISOString(),
    last_message_at: c.last_message_at?.toISOString() || null,
  })));
});

router.post("/", async (req, res) => {
  const { agent_id, agent_name, title, initial_message } = req.body;

  if (!agent_id) return res.status(400).json({ error: "agent_id is required" });

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agent_id));
  const agentName = agent?.name || agent_name || agent_id;
  const agentNameAr = agent?.nameAr || agentName;
  const convTitle = title || `محادثة مع ${agentNameAr}`;

  const id = randomUUID();
  const [conv] = await db.insert(conversationsTable).values({
    id,
    agent_id,
    agent_name: agentName,
    title: convTitle,
    message_count: 0,
  }).returning();

  if (initial_message) {
    const msgId = randomUUID();
    await db.insert(messagesTable).values({
      id: msgId,
      conversation_id: id,
      role: "user",
      content: initial_message,
    });

    try {
      const systemPrompt = getAgentSystemPrompt(agent_id, agentName);
      const result = await callGeminiWithHistory(systemPrompt, [], initial_message, "flash");

      await db.insert(messagesTable).values({
        id: randomUUID(),
        conversation_id: id,
        role: "assistant",
        content: result.text,
        model_used: "gemini-2.5-flash",
        tokens_used: result.tokens,
      });

      await db.update(conversationsTable).set({
        message_count: 2,
        last_message_at: new Date(),
      }).where(eq(conversationsTable.id, id));
    } catch (err: any) {
      console.error("AI error on initial message:", err?.message);
    }
  }

  res.status(201).json({
    ...conv,
    created_at: conv.created_at?.toISOString() || new Date().toISOString(),
    last_message_at: initial_message ? new Date().toISOString() : null,
  });
});

router.get("/:conversationId/messages", async (req, res) => {
  const { conversationId } = req.params;
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversation_id, conversationId))
    .orderBy(messagesTable.created_at);
  res.json(msgs.map(m => ({
    ...m,
    created_at: m.created_at?.toISOString() || new Date().toISOString(),
  })));
});

router.post("/:conversationId/messages", async (req, res) => {
  const { conversationId } = req.params;
  const { content, language } = req.body;

  if (!content) return res.status(400).json({ error: "content is required" });

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, conv.agent_id));

  await db.insert(messagesTable).values({
    id: randomUUID(),
    conversation_id: conversationId,
    role: "user",
    content,
  });

  const history = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversation_id, conversationId))
    .orderBy(messagesTable.created_at)
    .limit(20);

  const historyForAI = history
    .filter(m => m.role === "user" || m.role === "assistant")
    .slice(0, -1)
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

  try {
    const systemPrompt = getAgentSystemPrompt(conv.agent_id, conv.agent_name);
    const result = await callGeminiWithHistory(systemPrompt, historyForAI, content, "flash");
    const responseText = result.text;
    const tokensUsed = result.tokens;
    const modelUsed = "gemini-2.5-flash";

    const [response] = await db.insert(messagesTable).values({
      id: randomUUID(),
      conversation_id: conversationId,
      role: "assistant",
      content: responseText,
      model_used: modelUsed,
      tokens_used: tokensUsed,
    }).returning();

    await db.update(conversationsTable).set({
      message_count: conv.message_count + 2,
      last_message_at: new Date(),
    }).where(eq(conversationsTable.id, conversationId));

    res.json({
      ...response,
      created_at: response.created_at?.toISOString() || new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("AI error:", err?.message);
    const fallback = isArabicDominant(content)
      ? "عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى."
      : "Sorry, an error occurred processing your request. Please try again.";
    const [response] = await db.insert(messagesTable).values({
      id: randomUUID(),
      conversation_id: conversationId,
      role: "assistant",
      content: fallback,
      model_used: "error",
      tokens_used: 0,
    }).returning();
    res.json({
      ...response,
      created_at: response.created_at?.toISOString() || new Date().toISOString(),
    });
  }
});

export default router;
