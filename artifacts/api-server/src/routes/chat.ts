import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable, modelVersionsTable, alertsTable, driftMetricsTable, latencyMetricsTable } from "@workspace/db";
import { eq, desc, gte } from "drizzle-orm";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are an ML monitoring assistant embedded in a production dashboard called ML Monitor. You help ML engineers and on-call SREs understand what is happening with their models.

Your job:
- Explain alerts in plain, simple language — no jargon unless the user asks
- Help users understand what drift, PSI, KS-statistic, and latency metrics mean in practical terms
- Tell users what action to take next
- Answer questions about how the monitoring system works
- Be direct and concise — engineers are busy

Tone: calm, professional, like a senior engineer who knows the system well. Not robotic, not overly enthusiastic. Never say "Great question!" or similar filler phrases.

When explaining what is wrong, always say:
1. What the problem is (in plain English)
2. Why it matters (user impact potential)
3. What to check or do next

PSI thresholds: below 0.10 = stable, 0.10-0.25 = warning (investigate), above 0.25 = critical (act now).
KS statistic: measures maximum gap between distributions — higher = more different.
p99 latency > 500ms triggers a warning alert.

You have access to current system state which is provided in the context below. Use it to give specific answers.`;

router.post("/chat/message", async (req, res) => {
  const { message, sessionId } = req.body ?? {};
  if (!message || !sessionId) {
    res.status(400).json({ error: "message and sessionId required" });
    return;
  }

  // Fetch current system context
  const [models, activeAlerts, recentDrift, currentLatency] = await Promise.all([
    db.select().from(modelVersionsTable),
    db.select().from(alertsTable).where(eq(alertsTable.status, "active")),
    db.select().from(driftMetricsTable).orderBy(desc(driftMetricsTable.timestamp)).limit(5),
    db.select().from(latencyMetricsTable).orderBy(desc(latencyMetricsTable.timestamp)).limit(4),
  ]);

  const systemContext = `
Current system state:
- Models: ${models.map(m => `${m.name} v${m.version} (${m.status}, ${m.dailyUsers.toLocaleString()} daily users)`).join(", ")}
- Active alerts: ${activeAlerts.length === 0 ? "None" : activeAlerts.map(a => `[${a.severity.toUpperCase()}] ${a.type}: ${a.message}`).join(" | ")}
- Recent drift (latest readings): ${recentDrift.map(d => `model_id=${d.modelId} PSI=${d.psiScore} KS=${d.ksStatistic} severity=${d.driftSeverity}`).join(", ")}
- Recent latency: ${currentLatency.map(l => `model_id=${l.modelId} p99=${l.p99Ms}ms`).join(", ")}
`;

  // Load session history
  const history = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, sessionId))
    .orderBy(chatMessagesTable.createdAt)
    .limit(20);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT + "\n\n" + systemContext },
    ...history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: message },
  ];

  // Save user message
  await db.insert(chatMessagesTable).values({ sessionId, role: "user", content: message });

  // Stream response
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db.insert(chatMessagesTable).values({ sessionId, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "Failed to get response. Check your OpenAI API key." })}\n\n`);
  }
  res.end();
});

router.delete("/chat/session/:sessionId", async (req, res) => {
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, req.params.sessionId));
  res.json({ success: true });
});

export default router;
