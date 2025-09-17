/**
 * Post Model Hook
 *
 * The post-model hook runs AFTER the model generates a response, allowing for post-processing, validation,
 * human-in-the-loop approval, and modification of the model's output before it reaches the user.
 *
 * Why this is important:
 * - Quality assurance layer independent of prompt engineering
 * - Enforces safety/compliance policies consistently across all outputs
 * - Enables observable, auditable response transformations (easy to test/log)
 * - Provides a single place to tune business rules without touching tools
 *
 * When to use:
 * - You need guardrails on every response (family-friendly, brand voice, legal)
 * - You want deterministic checks (no extra model calls) before delivery
 * - You must gate certain categories (legal/medical/financial) for human review
 * - You want to aggregate metrics on moderation and quality improvements
 */

import fs from "node:fs/promises";
import { createAgent, tool, AIMessage, MemorySaver } from "langchain";
import { interrupt } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Product database
 */
const db = {
  "kids tablet": {
    price: "$199",
    features: "Educational apps, parental controls",
  },
  "smart tv": {
    price: "$499",
    features: "4K resolution, smart home integration",
  },
  "baby monitor": {
    price: "$149",
    features: "Night vision, two-way audio",
  },
} as const;

/**
 * Minimal tool (kept tiny to focus on post-model logic)
 */
const productInfoTool = tool(
  async (input: { product: string }) => {
    const key = input.product.toLowerCase() as keyof typeof db;
    if (!db[key]) {
      return `Sorry, I don't have data for "${input.product}".`;
    }

    return `${input.product.toUpperCase()}\nPrice: ${
      db[key].price
    }\nFeatures: ${db[key].features}`;
  },
  {
    name: "product_info",
    description: "Get basic product info",
    schema: z.object({ product: z.string() }),
  }
);

/**
 * Rule-based checks (deterministic evals)
 */
function containsProfanity(text: string): boolean {
  return /(damn|hell|stupid|idiot|crap|sucks)/i.test(text);
}

function simplifyTechnicalJargon(text: string): string | null {
  const map: Array<[RegExp, string]> = [
    [/\bapi\b/gi, "system"],
    [/\bbackend\b/gi, "our systems"],
    [/\bdatabase\b/gi, "our records"],
    [/\bserver\b/gi, "our system"],
    [/\balgorithm\b/gi, "our process"],
  ];
  let updated = text;
  let changed = false;
  for (const [re, repl] of map) {
    if (re.test(updated)) {
      updated = updated.replace(re, repl);
      changed = true;
    }
  }
  return changed ? updated : null;
}

function mitigateCompliance(text: string): string | null {
  let updated = text;
  let changed = false;
  const map: Array<[RegExp, string]> = [
    [/\bguarantee\b/gi, "aim to provide"],
    [/\bpromise\b/gi, "strive to"],
    [/100% safe/gi, "designed with safety in mind"],
    [/never fails/gi, "designed for reliability"],
  ];
  for (const [re, repl] of map) {
    if (re.test(updated)) {
      updated = updated.replace(re, repl);
      changed = true;
    }
  }
  return changed ? updated : null;
}

function detectHallucinations(text: string): {
  suspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (/(100%|guaranteed|never fails|perfectly safe)/i.test(text)) {
    reasons.push("Absolute guarantee language");
  }
  const knownProducts = ["kids tablet"];
  const lower = text.toLowerCase();
  if (/\b(product|item|model)\b/i.test(text)) {
    const mentionsProductCategory =
      /\btablet|tv|monitor|camera|laptop|phone\b/i.test(text);
    const referencesKnown = knownProducts.some((p) => lower.includes(p));
    if (mentionsProductCategory && !referencesKnown) {
      reasons.push("References product category without a known catalog item");
    }
  }
  return { suspicious: reasons.length > 0, reasons };
}

/**
 * Metrics for demo
 */
const stats = {
  total: 0,
  profanityFiltered: 0,
  jargonSimplified: 0,
  complianceMitigated: 0,
  hallucinationFlagged: 0,
  humanGateInserted: 0,
};

/**
 * Agent with post-model hook
 */
const agent = createAgent({
  llm: new ChatOpenAI({ model: "gpt-4o", temperature: 0.7 }),
  tools: [productInfoTool],
  checkpointer: new MemorySaver(),
  postModelHook: function postModelHook(state) {
    stats.total += 1;

    /**
     * Inspect last user message to deterministically trigger certain checks
     */
    const lastUser = [...state.messages].reverse().find((m) => {
      const t = m.getType();
      return t === "human";
    });
    const lastUserText =
      (lastUser && typeof (lastUser as any).content === "string"
        ? ((lastUser as any).content as string)
        : "") || "";

    /**
     * get last textual content
     */
    const lastText = [...state.messages]
      .reverse()
      .find(
        (m) =>
          typeof m.content === "string" &&
          (m.content as string).trim().length > 0
      );
    const original = (lastText?.content as string) || "";

    console.log("\n🔍 Post-Model Analysis:");
    console.log(
      `Original response: "${original ? original.slice(0, 80) : "..."}..."`
    );

    let modified = original;
    let touched = false;

    // User-intent driven gates (apply even if model output is safe)
    const userHasProfanity = /(damn|hell|stupid|idiot|crap|sucks)/i.test(
      lastUserText
    );
    const userHasTechJargon =
      /\b(api|backend|database|server|algorithm)\b/i.test(lastUserText);
    const userHasGuarantee =
      /(100%|guarantee|never fails|perfectly safe)/i.test(lastUserText);
    const userHasLegalThreat = /\b(attorney|lawyer|lawsuit|sue)\b/i.test(
      lastUserText
    );

    if (userHasLegalThreat && !touched) {
      stats.humanGateInserted += 1;
      const resumeWith = interrupt({
        value:
          "🚨 Legal-risk detected from user input → human review gate inserted",
      });
      touched = true;
      modified = `${modified}\n\n⏸️ Human Review: ${resumeWith}`.trim();
    }

    if (userHasProfanity && !touched) {
      modified =
        "I understand this is frustrating. Let's keep it respectful so I can help effectively. How can I assist you today?";
      stats.profanityFiltered += 1;
      touched = true;
      console.log("⚠️  Filtered due to user profanity");
    }

    if (userHasTechJargon && !touched) {
      const simplified = simplifyTechnicalJargon(modified);
      modified =
        simplified ||
        `${modified}\n\nIn simple terms: I can help with clear product details like features, price, and availability.`;
      stats.jargonSimplified += 1;
      touched = true;
      console.log("🔧 Simplified based on user technical phrasing");
    }

    if (userHasGuarantee && !touched) {
      const mitigated = mitigateCompliance(modified);
      modified =
        mitigated ||
        `${modified}\n\n⚖️ Note: We avoid absolute guarantees. We aim to provide safe, reliable products and will share documented specs only.`;
      stats.complianceMitigated += 1;
      touched = true;
      console.log("⚖️  Mitigated based on user guarantee wording");
    }

    /**
     * 1) Profanity filter
     */
    if (containsProfanity(modified)) {
      modified =
        "I apologize, but I'll rephrase to keep this family-friendly. How can I assist you today?";
      stats.profanityFiltered += 1;
      touched = true;
      console.log("⚠️  Filtered inappropriate content");
    }

    /**
     * 2) Technical jargon simplification
     */
    if (!touched) {
      const simplified = simplifyTechnicalJargon(modified);
      if (simplified) {
        modified = simplified;
        stats.jargonSimplified += 1;
        touched = true;
        console.log("🔧 Simplified technical language");
      }
    }

    /**
     * 3) Compliance wording mitigation
     */
    if (!touched) {
      const mitigated = mitigateCompliance(modified);
      if (mitigated) {
        modified = mitigated;
        stats.complianceMitigated += 1;
        touched = true;
        console.log("⚖️  Mitigated compliance risks");
      }
    }

    /**
     * 4) Hallucination heuristics + human-in-the-loop gate
     */
    const hallucination = detectHallucinations(modified);
    if (hallucination.suspicious) {
      stats.hallucinationFlagged += 1;
      modified += `\n\n⚠️ Note: Certain claims were adjusted pending verification (${hallucination.reasons.join(
        "; "
      )}).`;
      console.log(
        "🧐 Flagged potential hallucinations:",
        hallucination.reasons
      );
      /**
       * Require approval for high-risk content
       */
      stats.humanGateInserted += 1;
      const resumeWith = interrupt({
        value:
          "Human Review Required: A human agent will review before this is sent.",
      });
      modified += `\n\n⏸️ Human Review: ${resumeWith}.`;
      touched = true;
    }

    if (touched) {
      console.log(`Modified response: "${modified.slice(0, 80)}..."`);
      return {
        ...state,
        messages: [...state.messages.slice(0, -1), new AIMessage(modified)],
      };
    }

    console.log("✅ Response approved without modification");
    return state;
  },
  prompt: `You are a helpful customer service assistant for FamilyStore.
- Keep language simple and family-friendly.
- When asked about a product, use product_info if needed.
- Avoid absolute guarantees or risky claims; focus on safety and clarity.`,
});

const configurable = {
  thread_id: crypto.randomUUID(),
};

/**
 * 1) Product inquiry (may get enhancement/left unchanged)
 */
await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          "Tell me about the kids tablet. Is it 100% safe and guaranteed?",
      },
    ],
  },
  { configurable }
);

const case1Resumed = await agent.invoke(null, {
  configurable,
});
console.log("Product Inquiry:", case1Resumed.messages.at(-1)?.content);

/**
 * 2) Technical phrasing (will be simplified)
 */
configurable.thread_id = crypto.randomUUID();
await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          "How does your backend API handle product database queries for the kids tablet?",
      },
    ],
  },
  { configurable }
);
const case2Resumed = await agent.invoke(null, {
  configurable,
});
console.log("Technical Query:", case2Resumed.messages.at(-1)?.content);

/**
 * 3) Inappropriate + risky phrasing (filter + gate)
 */
const case3 = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          "This is damn overpriced and 100% safe you said — I might talk to an attorney.",
      },
    ],
  },
  { configurable }
);
console.log("High-Risk Case:", case3.messages.at(-1)?.content);

/**
 * Stats
 */
console.log(`\n📊 Post-Model Hook Statistics:
Total processed: ${stats.total}
Profanity filtered: ${stats.profanityFiltered}
Jargon simplified: ${stats.jargonSimplified}
Compliance mitigated: ${stats.complianceMitigated}
Hallucination flags: ${stats.hallucinationFlagged}
Human approval gates: ${stats.humanGateInserted}
`);

/**
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await agent.drawMermaidPng());

/**
 * Example Output:
 * 🔍 Post-Model Analysis:
 * Original response: "Tell me about the kids tablet. Is it 100% safe and guaranteed?..."
 * ⚖️  Mitigated based on user guarantee wording
 * 🧐 Flagged potential hallucinations: [ 'Absolute guarantee language' ]
 *
 * 🔍 Post-Model Analysis:
 * Original response: "Tell me about the kids tablet. Is it 100% safe and guaranteed?..."
 * ⚖️  Mitigated based on user guarantee wording
 * 🧐 Flagged potential hallucinations: [ 'Absolute guarantee language' ]
 * Modified response: "Tell me about the kids tablet. Is it designed with safety in mind and guaranteed..."
 * Product Inquiry: Tell me about the kids tablet. Is it designed with safety in mind and guaranteed?
 *
 * ⚠️ Note: Certain claims were adjusted pending verification (Absolute guarantee language).
 *
 * ⏸️ Human Review: it's ok!.
 *
 * 🔍 Post-Model Analysis:
 * Original response: "I'm here to assist with product information and customer service-related queries..."
 * 🔧 Simplified based on user technical phrasing
 * 🧐 Flagged potential hallucinations: [ 'References product category without a known catalog item' ]
 *
 * 🔍 Post-Model Analysis:
 * Original response: "I'm here to assist with product information and customer service-related queries..."
 * 🔧 Simplified based on user technical phrasing
 * 🧐 Flagged potential hallucinations: [ 'References product category without a known catalog item' ]
 * Modified response: "I'm here to assist with product information and customer service-related queries..."
 * Technical Query: I'm here to assist with product information and customer service-related queries. If you have questions about the kids' tablet product itself, like its features, I can help with that. But for detailed technical information about our our systems system and how it handles our records queries, you might need to contact our technical support team directly. Let me know if there's anything else you'd like to know!
 *
 * ⚠️ Note: Certain claims were adjusted pending verification (References product category without a known catalog item).
 *
 * ⏸️ Human Review: it's ok!.
 *
 * 🔍 Post-Model Analysis:
 * Original response: "I'm sorry to hear you're upset. Let's address your concerns one step at a time. ..."
 * High-Risk Case: I'm sorry to hear you're upset. Let's address your concerns one step at a time. If you have any specific questions about the kids' tablet, like its price or safety features, I'd be happy to provide you with more information. Your satisfaction is important to us, and we're here to help!
 *
 * 📊 Post-Model Hook Statistics:
 * Total processed: 5
 * Profanity filtered: 0
 * Jargon simplified: 2
 * Compliance mitigated: 2
 * Hallucination flags: 4
 * Human approval gates: 5
 */
