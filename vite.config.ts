import { defineConfig, loadEnv } from "vite";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

function normalizeList(values: unknown, max = 6): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => String(value).trim()).filter(Boolean).slice(0, max);
}

function normalizeMissionContext(input: unknown): Array<{
  missionId: number;
  title: string;
  hook: string;
  intro: string;
  keyFacts: string[];
  watchFor: string[];
  tryIt: string[];
  vocabulary: string[];
}> {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 3).map((item: any) => ({
    missionId: Number(item?.missionId ?? 0),
    title: String(item?.title ?? "Mission"),
    hook: String(item?.hook ?? ""),
    intro: String(item?.intro ?? ""),
    keyFacts: normalizeList(item?.keyFacts, 5),
    watchFor: normalizeList(item?.watchFor, 5),
    tryIt: normalizeList(item?.tryIt, 4),
    vocabulary: normalizeList(item?.vocabulary, 10),
  }));
}

function extractResponseText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  if (Array.isArray(data?.output_text)) {
    const joined = data.output_text.map((part: unknown) => String(part)).join("\n").trim();
    if (joined) return joined;
  }

  const parts: string[] = [];
  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const contentItem of item.content) {
        if (typeof contentItem?.text === "string" && contentItem.text.trim()) {
          parts.push(contentItem.text);
        }
        if (typeof contentItem?.output_text === "string" && contentItem.output_text.trim()) {
          parts.push(contentItem.output_text);
        }
        if (typeof contentItem?.refusal === "string" && contentItem.refusal.trim()) {
          parts.push(contentItem.refusal);
        }
        if (typeof contentItem?.value === "string" && contentItem.value.trim()) {
          parts.push(contentItem.value);
        }
        if (typeof contentItem?.data === "string" && contentItem.data.trim()) {
          parts.push(contentItem.data);
        }
        if (contentItem?.json && typeof contentItem.json === "object") {
          parts.push(JSON.stringify(contentItem.json));
        }
        if (typeof contentItem?.arguments === "string" && contentItem.arguments.trim()) {
          parts.push(contentItem.arguments);
        }
      }
    }
  }

  return parts.join("\n").trim();
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const openAiApiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

  return {
  plugins: [
    {
      name: "local-tutor-api",
      configureServer(server) {
        server.middlewares.use("/api/tutor", async (req, res, next) => {
          if (req.method !== "POST") {
            return next();
          }

          const sendJson = (status: number, body: unknown) => {
            res.statusCode = status;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(body));
          };

          try {
            const apiKey = openAiApiKey;
            if (!apiKey) {
              sendJson(500, {
                ok: false,
                error:
                  "Server missing OPENAI_API_KEY. Add OPENAI_API_KEY to .env.local, then restart npm run dev.",
              });
              return;
            }

            const chunks: Buffer[] = [];
            req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            await new Promise<void>((resolve, reject) => {
              req.on("end", () => resolve());
              req.on("error", reject);
            });

            const raw = Buffer.concat(chunks).toString("utf8");
            const input = raw ? JSON.parse(raw) : {};
            const conceptId = String(input?.conceptId ?? "reward");
            const conceptLabel = String(input?.conceptLabel ?? "Rewards");
            const confidencePercent = Number(input?.confidencePercent ?? 0);
            const age = Number(input?.age ?? 11);
            const gradeLevel = Number(input?.gradeLevel ?? 5);
            const attemptRaw = Number(input?.attempt ?? 1);
            const attempt = Number.isFinite(attemptRaw) ? Math.min(5, Math.max(1, Math.trunc(attemptRaw))) : 1;
            const recentQuestions = Array.isArray(input?.recentQuestions)
              ? input.recentQuestions.map((v: unknown) => String(v).trim()).filter(Boolean).slice(-8)
              : [];
            const recentQuestionBlock = recentQuestions.length
              ? [
                "Do NOT repeat or lightly reword any of these recent questions:",
                ...recentQuestions.map((q: string, i: number) => `${i + 1}. ${q}`),
              ].join("\n")
              : "No recent questions provided.";
            const missionContext = normalizeMissionContext(input?.missionContext);
            const missionContextBlock = missionContext.length
              ? missionContext
                .map((mission) => {
                  const lines = [
                    `Mission ${mission.missionId}: ${mission.title}`,
                    mission.hook ? `Hook: ${mission.hook}` : "",
                    mission.intro ? `Intro: ${mission.intro}` : "",
                    mission.keyFacts.length ? `Key facts: ${mission.keyFacts.join(" | ")}` : "",
                    mission.watchFor.length ? `Watch metrics: ${mission.watchFor.join(" | ")}` : "",
                    mission.tryIt.length ? `Try-it steps: ${mission.tryIt.join(" | ")}` : "",
                    mission.vocabulary.length ? `Vocabulary: ${mission.vocabulary.join(", ")}` : "",
                  ].filter(Boolean);
                  return lines.join("\n");
                })
                .join("\n\n")
              : "Mission context unavailable. Stay aligned with reinforcement learning lessons for kids.";

            const systemPrompt =
              "You are a patient AI tutor for kids. Write for a 5th grader (about age 10-11). Keep text simple, accurate, and encouraging. Return ONLY valid JSON.";
            const userPrompt = [
              `Create a micro-lesson for concept: ${conceptLabel} (${conceptId}).`,
              `Student confidence: ${confidencePercent}%. Student age: ${age}. Grade level: ${gradeLevel}.`,
              `Attempt number: ${attempt}. Use a fresh angle and different wording each attempt.`,
              recentQuestionBlock,
              "Use ONLY the mission context below for facts and metric names.",
              "Use short words and short sentences for 5th grade reading.",
              "If you use a technical word (like reward, episode, explore, exploit, Q-table), define it simply in teachBlurb.",
              "Question should be one sentence and easy to read aloud.",
              "Include one mission metric or dashboard phrase when relevant (example: 'Win rate (last 10 completed tries)').",
              "Do not mention APIs, code, tokens, or system internals.",
              "Mission context:",
              missionContextBlock,
              "Return JSON fields:",
              "- conceptId (string)",
              "- conceptLabel (string)",
              "- teachBlurb (2-3 short sentences, concrete)",
              "- question (one multiple choice question)",
              "- options (array of exactly 4 short options)",
              "- correctIndex (0..3)",
              "- hint (one short hint, no answer giveaway)",
              "Keep the question aligned with reinforcement learning in a maze game.",
              "Make the question scenario and answer choices clearly different from recent questions.",
            ].join("\n");

            const openaiResp = await fetch(OPENAI_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "gpt-5-nano",
                instructions: systemPrompt,
                input: userPrompt,
                reasoning: { effort: "minimal" },
                max_output_tokens: 800,
              }),
            });

            if (!openaiResp.ok) {
              const errText = await openaiResp.text();
              sendJson(openaiResp.status, {
                ok: false,
                error: `OpenAI request failed (${openaiResp.status}): ${errText}`,
              });
              return;
            }

            const data = await openaiResp.json();
            const content = extractResponseText(data);
            if (typeof content !== "string" || !content.trim()) {
              sendJson(502, {
                ok: false,
                error: `OpenAI returned empty content. Raw response: ${JSON.stringify(data).slice(0, 4000)}`,
              });
              return;
            }

            const parsed = JSON.parse(content);
            const pack = {
              conceptId: typeof parsed?.conceptId === "string" ? parsed.conceptId : conceptId,
              conceptLabel: typeof parsed?.conceptLabel === "string" ? parsed.conceptLabel : conceptLabel,
              teachBlurb:
                typeof parsed?.teachBlurb === "string" && parsed.teachBlurb.trim()
                  ? parsed.teachBlurb
                  : "Let’s review this concept with a quick example and question.",
              question: typeof parsed?.question === "string" ? parsed.question : "",
              options: Array.isArray(parsed?.options) ? parsed.options.map((v: unknown) => String(v)) : [],
              correctIndex: Number(parsed?.correctIndex),
              hint: typeof parsed?.hint === "string" ? parsed.hint : "",
            };

            if (!pack.question || pack.options.length !== 4 || !Number.isInteger(pack.correctIndex)) {
              sendJson(502, { ok: false, error: "AI response schema invalid." });
              return;
            }
            if (pack.options.some((option: string) => !option.trim())) {
              sendJson(502, { ok: false, error: "AI response schema invalid (empty option)." });
              return;
            }
            const uniqueOptions = new Set(pack.options.map((option: string) => option.trim().toLowerCase()));
            if (uniqueOptions.size !== 4) {
              sendJson(502, { ok: false, error: "AI response schema invalid (duplicate options)." });
              return;
            }
            const questionWords = pack.question.trim().split(/\s+/).length;
            const teachWords = pack.teachBlurb.trim().split(/\s+/).length;
            if (questionWords > 30 || teachWords > 90) {
              sendJson(502, { ok: false, error: "AI response too long for 5th-grade tutor mode." });
              return;
            }

            sendJson(200, { ok: true, pack });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown tutor error.";
            sendJson(500, { ok: false, error: message });
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          charts: ["chart.js"],
        },
      },
    },
    chunkSizeWarningLimit: 850,
  },
  };
});
