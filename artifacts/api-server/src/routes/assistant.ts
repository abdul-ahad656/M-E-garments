import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import {
  QueryShoppingAssistantBody,
  QueryShoppingAssistantResponse,
} from "@workspace/api-zod";
import {
  isCommerceReady,
  searchProducts,
} from "../lib/commerce-repository";
import { isAiAvailable, markAiTemporarilyUnavailable } from "../lib/ai-status";

const router: IRouter = Router();

type ShoppingIntent = {
  query: string;
  gender: string | null;
  age: number | null;
  category: string | null;
  color: string | null;
  occasion: string | null;
  maxPrice: number | null;
};

let cachedModel: { id: string; expiresAt: number } | undefined;

async function resolveOpenAIModel(openai: OpenAI): Promise<string> {
  if (cachedModel && Date.now() < cachedModel.expiresAt) {
    return cachedModel.id;
  }

  const available = await openai.models.list();
  const ids = new Set(available.data.map((model) => model.id));
  const model = [
    "gpt-5.1-mini",
    "gpt-5-mini",
    "gpt-4.1-mini",
    "gpt-4o-mini",
  ].find((candidate) => ids.has(candidate));
  if (!model) {
    throw new Error("No supported OpenAI text model is available to this project");
  }
  cachedModel = { id: model, expiresAt: Date.now() + 10 * 60_000 };
  return model;
}

function normalizeIntent(value: unknown): ShoppingIntent {
  const intent =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const text = (key: string) =>
    typeof intent[key] === "string" && intent[key]
      ? String(intent[key]).slice(0, 80)
      : null;
  const number = (key: string) =>
    typeof intent[key] === "number" && Number.isFinite(intent[key])
      ? Math.max(0, Number(intent[key]))
      : null;

  return {
    query: text("query") ?? "",
    gender: text("gender"),
    age: number("age"),
    category: text("category"),
    color: text("color"),
    occasion: text("occasion"),
    maxPrice: number("maxPrice"),
  };
}

router.post("/assistant/query", async (req, res) => {
  const parsed = QueryShoppingAssistantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Please enter a shopping question.",
      code: "INVALID_QUERY",
    });
    return;
  }

  if (!(await isCommerceReady())) {
    res.status(503).json({
      error:
        "The shopping assistant needs a live catalog before it can recommend products.",
      code: "CATALOG_NOT_CONFIGURED",
    });
    return;
  }

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey || !isAiAvailable()) {
    res.status(503).json({
      error:
        "The AI shopping assistant is not connected yet. No recommendation was generated.",
      code: "AI_NOT_CONFIGURED",
    });
    return;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const model = await resolveOpenAIModel(openai);
    const interpretation = await openai.chat.completions.create({
      model,
      max_completion_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract kidswear shopping intent. Return JSON only with keys query, gender, age, category, color, occasion, maxPrice. Use null for unknown values. Never invent a product, price, policy, size, or availability.",
        },
        { role: "user", content: parsed.data.message },
      ],
    });
    const raw = interpretation.choices[0]?.message.content ?? "{}";
    const intent = normalizeIntent(JSON.parse(raw));
    const catalogQuery = [
      intent.query,
      intent.gender,
      intent.category,
      intent.color,
      intent.occasion,
    ]
      .filter(Boolean)
      .join(" ");
    const terms = catalogQuery
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const candidates = await searchProducts(terms, 12);
    const products = candidates
      .filter((product) => product.availableForSale)
      .filter(
        (product) =>
          intent.maxPrice === null ||
          Number(product.price.amount) <= intent.maxPrice,
      )
      .slice(0, 6);

    const message =
      products.length > 0
        ? `I found ${products.length} available ${
            products.length === 1 ? "option" : "options"
          } in the live M&E catalog that match your request. Prices and availability shown below come directly from the store catalog.`
        : "I couldn't find an available product in the live M&E catalog that matches those details. Try broadening the color, occasion, category, or budget.";

    const data = QueryShoppingAssistantResponse.parse({
      conversationId: parsed.data.conversationId ?? randomUUID(),
      message,
      products,
    });
    res.json(data);
  } catch (error) {
    if (
      error instanceof OpenAI.APIError &&
      (error.status === 403 || error.status === 429)
    ) {
      markAiTemporarilyUnavailable();
    }
    req.log.error({ err: error }, "Grounded shopping assistant failed");
    res.status(503).json({
      error:
        "The shopping assistant is temporarily unavailable. No recommendation was generated.",
      code: "ASSISTANT_UNAVAILABLE",
    });
  }
});

export default router;