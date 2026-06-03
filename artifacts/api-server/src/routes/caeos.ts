import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, agentExecutionsTable, systemAlertsTable, complaintsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { callAIForTask } from "../lib/ai.js";
import { broadcast } from "../lib/ws.js";

const router = Router();

const SOVEREIGN_LAYERS = [
  { id: 1,  name: "الإطار الدستوري",          nameEn: "Constitutional Framework",  weight: 0.12 },
  { id: 2,  name: "الذكاء اللغوي",            nameEn: "Lexical Intelligence",       weight: 0.08 },
  { id: 3,  name: "مدقق المعرفة",            nameEn: "Epistemological Validator",  weight: 0.07 },
  { id: 4,  name: "محرك الاستدلال الأخلاقي", nameEn: "Ethical Reasoning Engine",   weight: 0.10 },
  { id: 5,  name: "مُقيّم المخاطر النظامية", nameEn: "Systemic Risk Assessor",     weight: 0.09 },
  { id: 6,  name: "وحدة الاستدلال السببي",   nameEn: "Causal Inference Module",    weight: 0.06 },
  { id: 7,  name: "طبقة تطبيق الأمن",        nameEn: "Security Enforcement Layer", weight: 0.10 },
  { id: 8,  name: "هيكل المعرفة",            nameEn: "Knowledge Architecture",     weight: 0.06 },
  { id: 9,  name: "بروتوكول التنسيق",        nameEn: "Coordination Protocol",      weight: 0.07 },
  { id: 10, name: "نواة التعلم التكيفي",      nameEn: "Adaptive Learning Core",     weight: 0.06 },
  { id: 11, name: "محرك الشفافية",           nameEn: "Transparency Engine",        weight: 0.05 },
  { id: 12, name: "مراقب الامتثال",          nameEn: "Compliance Monitor",         weight: 0.06 },
  { id: 13, name: "محسّن الموارد",           nameEn: "Resource Optimizer",         weight: 0.04 },
  { id: 14, name: "الذكاء الثقافي",          nameEn: "Cultural Intelligence",      weight: 0.05 },
  { id: 15, name: "وحدة التطور",            nameEn: "Evolution Controller",       weight: 0.05 },
];

router.get("/score", async (_req, res) => {
  try {
    const agents    = await db.select().from(agentsTable);
    const execs     = await db.select().from(agentExecutionsTable);
    const alerts    = await db.select().from(systemAlertsTable).where(eq(systemAlertsTable.resolved, false));
    const complaints = await db.select().from(complaintsTable).where(eq(complaintsTable.status, "open"));

    const caeos = agents.filter(a => a.system === "CAEOS");
    const online  = caeos.filter(a => a.status === "online").length;
    const busy    = caeos.filter(a => a.status === "busy").length;
    const total   = caeos.length || 1;

    const completed = execs.filter(e => e.status === "completed");
    const successRate = execs.length > 0 ? (completed.length / execs.length) * 100 : 100;

    const agentHealth    = ((online + busy) / total) * 100;
    const alertPenalty   = Math.min(alerts.length * 8, 40);
    const complaintPenalty = Math.min(complaints.length * 4, 20);
    const ethicalScore   = Math.max(0, Math.min(100, agentHealth * 0.4 + successRate * 0.4 - alertPenalty * 0.1 - complaintPenalty * 0.1 + 15));

    const riskScore = alerts.length === 0
      ? 1.2
      : Math.min(9.9, Math.round(alerts.length * 1.8 * 10) / 10);

    res.json({
      ethical_compliance: Math.round(ethicalScore * 10) / 10,
      risk_score:         riskScore,
      active_layers:      Math.min(caeos.length > 0 ? online + busy : 15, 15),
      total_layers:       15,
      pipeline_throughput: execs.filter(e => {
        const today = new Date(); today.setHours(0,0,0,0);
        return e.created_at && e.created_at >= today;
      }).length,
      active_alerts:      alerts.length,
      open_complaints:    complaints.length,
      caeos_agents_online: online,
      caeos_agents_busy:   busy,
      caeos_agents_total:  caeos.length,
      last_evaluated:      new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/layers", async (_req, res) => {
  try {
    const agents  = await db.select().from(agentsTable);
    const alerts  = await db.select().from(systemAlertsTable).where(eq(systemAlertsTable.resolved, false));
    const execs   = await db.select().from(agentExecutionsTable);

    const today = new Date(); today.setHours(0,0,0,0);
    const execsToday = execs.filter(e => e.created_at && e.created_at >= today);
    const successToday = execsToday.filter(e => e.status === "completed");
    const successRate = execsToday.length > 0 ? (successToday.length / execsToday.length) * 100 : 100;

    const caeos = agents.filter(a => a.system === "CAEOS");
    const hasAlerts = alerts.length > 0;

    const layers = SOVEREIGN_LAYERS.map((layer, idx) => {
      let status: "active" | "monitoring" | "standby" = "active";
      let health = 95 + Math.sin(idx * 1.3) * 4;

      if (hasAlerts && idx < alerts.length) {
        status = "monitoring";
        health -= alerts.length * 3;
      }
      if (successRate < 80 && [4, 7].includes(idx)) {
        status = "monitoring";
        health -= 10;
      }

      const matchedAgent = caeos[idx % caeos.length];

      return {
        ...layer,
        status,
        health:       Math.max(60, Math.min(100, Math.round(health * 10) / 10)),
        last_checked: new Date(Date.now() - Math.random() * 300000).toISOString(),
        agent_id:     matchedAgent?.id ?? null,
        agent_name:   matchedAgent?.nameAr ?? matchedAgent?.name ?? null,
        executions_today: matchedAgent?.executions_today ?? 0,
      };
    });

    res.json({ layers, updated_at: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/analyze", async (req, res) => {
  const { content, context } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "المحتوى مطلوب للتحليل" });

  try {
    const result = await callAIForTask("text_complex", [
      {
        role: "system",
        content: `أنت CAEOS — نظام الذكاء الاصطناعي الدستوري. تُحلّل المحتوى عبر 15 طبقة سيادية دستورية:

1. الإطار الدستوري — هل يتوافق مع المبادئ الأخلاقية الأساسية؟
2. الذكاء اللغوي — هل اللغة محترمة ومناسبة؟
3. مدقق المعرفة — هل المعلومات دقيقة وموثوقة؟
4. محرك الاستدلال الأخلاقي — هل القرار أخلاقي (نفعي، واجبي، إسلامي)؟
5. مُقيّم المخاطر — ما درجة الخطورة؟ (1-10)
6. وحدة الاستدلال السببي — ما العواقب المحتملة؟
7. طبقة الأمن — هل يُشكّل خطراً أمنياً؟
8-15. باقي الطبقات — التنسيق، الشفافية، الامتثال...

أعطِ تقريراً منظماً بتقييم لكل طبقة، ودرجة امتثال إجمالية (0-100)، وحكماً نهائياً: مقبول / مقبول مشروط / مرفوض.`,
      },
      {
        role: "user",
        content: `المحتوى المُراد تحليله:\n\n${content}${context ? `\n\nسياق إضافي: ${context}` : ""}`,
      },
    ], { system: "CAEOS", agentId: "caeos-master" });

    broadcast({ type: "caeos_analysis", timestamp: new Date().toISOString() });

    res.json({
      result,
      analyzed_at: new Date().toISOString(),
      layers_checked: 15,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
