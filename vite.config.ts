import { defineConfig, loadEnv } from "vite";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

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

            const systemPrompt =
              "You are a patient AI tutor for kids. Write for an 11-year-old. Keep text simple, accurate, and encouraging. Return ONLY valid JSON.";
            const userPrompt = [
              `Create a micro-lesson for concept: ${conceptLabel} (${conceptId}).`,
              `Student confidence: ${confidencePercent}%. Student age: ${age}.`,
              "Return JSON fields:",
              "- conceptId (string)",
              "- conceptLabel (string)",
              "- teachBlurb (2-3 short sentences, concrete)",
              "- question (one multiple choice question)",
              "- options (array of exactly 4 short options)",
              "- correctIndex (0..3)",
              "- hint (one short hint, no answer giveaway)",
              "Keep the question aligned with reinforcement learning in a maze game.",
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
