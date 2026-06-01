import Anthropic from "@anthropic-ai/sdk";

export type JobInput = {
  id: string;
  type: "promo" | "lore" | "content" | "strategy";
  prompt: string;
  metadata?: Record<string, any>;
};

export type UnderstandingOutput = {
  jobId: string;
  summary: string;
  intent: string;
  tone: string;
  key_entities: string[];
  suggested_actions: string[];
  risk_flags: string[];
  raw_model_output: string;
};

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function llmUnderstand(job: JobInput): Promise<UnderstandingOutput> {
  const prompt = `
You are the cognitive layer of an operating system called Quantum Star OS.
Your job is to transform raw creative or strategic input into structured understanding that downstream systems can execute on.

INPUT JOB:
${JSON.stringify(job, null, 2)}

Return ONLY valid JSON in this schema:
{
  "summary": "short interpretation of what this job is really asking for",
  "intent": "core underlying goal",
  "tone": "emotional/brand tone inferred",
  "key_entities": ["list", "of", "important", "entities"],
  "suggested_actions": ["action 1", "action 2", "action 3"],
  "risk_flags": ["anything unclear, conflicting, or sensitive"]
}

Do not add commentary. Only return JSON.
`;

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const raw = response.content[0].type === "text"
    ? response.content[0].text
    : "";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error("LLM output was not valid JSON: " + raw);
  }

  return {
    jobId: job.id,
    summary: parsed.summary,
    intent: parsed.intent,
    tone: parsed.tone,
    key_entities: parsed.key_entities,
    suggested_actions: parsed.suggested_actions,
    risk_flags: parsed.risk_flags,
    raw_model_output: raw,
  };
}
