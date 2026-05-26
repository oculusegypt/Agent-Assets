import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable, agentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const AGENT_RESPONSES: Record<string, (prompt: string, lang: string) => string> = {
  "acis-master": (p, l) => l === "ar"
    ? `أنا المنسق الرئيسي لـ ACIS. لقد تلقيت طلبك: "${p.substring(0, 100)}". سأقوم بتوزيع المهام على وكلاء التخصص المناسبين — مؤلف القصة، المخرج، ومصمم المؤثرات الصوتية — وسأنسق عملية الإنتاج الكاملة.`
    : `I am the ACIS Master Orchestrator. I've received your request. I'll dispatch this to the Story Architect, Director Agent, and Sound & Music specialist simultaneously for maximum efficiency.`,
  "billie": (p, l) => l === "ar"
    ? `أنا بيليه، المشرف الأعلى للنظام. لقد حللت طلبك وفحصت حالة جميع الوكلاء. النظام يعمل بكفاءة ${Math.floor(90 + Math.random() * 10)}%. هل تريد مني تحليلاً أعمق أو تحديث أي وكيل؟`
    : `I'm Billie, the Supreme Supervisor. I've analyzed your query and checked all agent statuses. System efficiency is at ${Math.floor(90 + Math.random() * 10)}%. Would you like me to run a deeper analysis or update any agents?`,
  "nexus": (p, l) => l === "ar"
    ? `أنا NEXUS، نظام تشغيل المكتب الذكي. تلقيت مهمتك وقيّمت مستوى المخاطرة: ${Math.floor(Math.random() * 5)}/10. سأوزع العمل على الوكلاء المناسبين وأراقب التنفيذ.`
    : `I am NEXUS Office OS. I've assessed your task with a risk score of ${Math.floor(Math.random() * 5)}/10. I'll dispatch it to the appropriate sub-agents and monitor execution.`,
  "story-architect": (p, l) => l === "ar"
    ? `أنا مؤلف القصة. سأبني البنية الدرامية لمشروعك: ثلاثة فصول، قوس عاطفي واضح، وشخصيات محددة بدقة. الجنس: ${Math.random() > 0.5 ? "دراما" : "ملحمة"}. أسلوب السرد: خطي مع ذكريات.`
    : `I'm the Story Architect. I'll structure your narrative with a 3-act framework, defined character arcs, and emotional beats. Genre detected: ${Math.random() > 0.5 ? "Drama" : "Epic"}. Proceeding to full story bible.`,
};

router.get("/", async (_req, res) => {
  const convs = await db.select().from(conversationsTable).orderBy(desc(conversationsTable.created_at)).limit(20);
  res.json(convs.map(c => ({
    ...c,
    created_at: c.created_at?.toISOString() || new Date().toISOString(),
    last_message_at: c.last_message_at?.toISOString() || null,
  })));
});

router.post("/", async (req, res) => {
  const { agent_id, title, initial_message } = req.body;
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agent_id));
  const agentName = agent?.name || agent_id;

  const id = randomUUID();
  const [conv] = await db.insert(conversationsTable).values({
    id,
    agent_id,
    agent_name: agentName,
    title,
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

    const lang = /[\u0600-\u06FF]/.test(initial_message) ? "ar" : "en";
    const responseText = AGENT_RESPONSES[agent_id]?.(initial_message, lang)
      || AGENT_RESPONSES.billie(initial_message, lang);

    await db.insert(messagesTable).values({
      id: randomUUID(),
      conversation_id: id,
      role: "assistant",
      content: responseText,
      model_used: agent?.model || "gemini-2.5-pro",
      tokens_used: Math.floor(Math.random() * 800) + 100,
    });

    await db.update(conversationsTable).set({
      message_count: 2,
      last_message_at: new Date(),
    }).where(eq(conversationsTable.id, id));
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

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, conv.agent_id));

  await db.insert(messagesTable).values({
    id: randomUUID(),
    conversation_id: conversationId,
    role: "user",
    content,
  });

  const lang = language || (/[\u0600-\u06FF]/.test(content) ? "ar" : "en");
  const responseText = AGENT_RESPONSES[conv.agent_id]?.(content, lang)
    || AGENT_RESPONSES.billie(content, lang);

  const [response] = await db.insert(messagesTable).values({
    id: randomUUID(),
    conversation_id: conversationId,
    role: "assistant",
    content: responseText,
    model_used: agent?.model || "gemini-2.5-pro",
    tokens_used: Math.floor(Math.random() * 1200) + 150,
  }).returning();

  await db.update(conversationsTable).set({
    message_count: conv.message_count + 2,
    last_message_at: new Date(),
  }).where(eq(conversationsTable.id, conversationId));

  res.json({
    ...response,
    created_at: response.created_at?.toISOString() || new Date().toISOString(),
  });
});

export default router;
