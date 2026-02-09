const OPENAI_API_URL = "https://api.openai.com/v1/responses";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function buildPrompt(input) {
  const conceptId = String(input?.conceptId ?? "reward");
  const conceptLabel = String(input?.conceptLabel ?? "Rewards");
  const confidencePercent = Number(input?.confidencePercent ?? 0);
  const age = Number(input?.age ?? 11);

  return {
    conceptId,
    system:
      "You are a patient AI tutor for kids. Write for an 11-year-old. Keep text simple, accurate, and encouraging. Return ONLY valid JSON.",
    user: [
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
    ].join("\n"),
  };
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  if (Array.isArray(data?.output_text)) {
    const joined = data.output_text.map((part) => String(part)).join("\n").trim();
    if (joined) return joined;
  }

  const parts = [];
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

function parseTutorPack(text, fallbackConceptId) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response was not a JSON object.");
  }

  const pack = {
    conceptId: typeof parsed.conceptId === "string" ? parsed.conceptId : fallbackConceptId,
    conceptLabel: typeof parsed.conceptLabel === "string" ? parsed.conceptLabel : "Concept",
    teachBlurb: typeof parsed.teachBlurb === "string" ? parsed.teachBlurb : "",
    question: typeof parsed.question === "string" ? parsed.question : "",
    options: Array.isArray(parsed.options) ? parsed.options.map((v) => String(v)) : [],
    correctIndex: Number(parsed.correctIndex),
    hint: typeof parsed.hint === "string" ? parsed.hint : "",
  };

  if (!pack.question || pack.options.length !== 4) {
    throw new Error("AI response missing question/options.");
  }
  if (!Number.isInteger(pack.correctIndex) || pack.correctIndex < 0 || pack.correctIndex > 3) {
    throw new Error("AI response has invalid correctIndex.");
  }
  if (!pack.teachBlurb) {
    pack.teachBlurb = "Let’s review this concept with a quick example and question.";
  }
  return pack;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 500, { ok: false, error: "Server missing OPENAI_API_KEY." });
  }

  try {
    const { conceptId, system, user } = buildPrompt(req.body ?? {});
    const openaiResp = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        instructions: system,
        input: user,
        reasoning: { effort: "minimal" },
        max_output_tokens: 800,
      }),
    });

    if (!openaiResp.ok) {
      const errText = await openaiResp.text();
      return json(res, openaiResp.status, {
        ok: false,
        error: `OpenAI request failed (${openaiResp.status}): ${errText}`,
      });
    }

    const data = await openaiResp.json();
    const content = extractResponseText(data);
    if (typeof content !== "string" || !content.trim()) {
      return json(res, 502, {
        ok: false,
        error: `OpenAI returned empty content. Raw response: ${JSON.stringify(data).slice(0, 4000)}`,
      });
    }

    const pack = parseTutorPack(content, conceptId);
    return json(res, 200, { ok: true, pack });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown tutor error.";
    return json(res, 500, { ok: false, error: message });
  }
}
