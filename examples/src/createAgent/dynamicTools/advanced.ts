import { z } from "zod";
import {
  createAgent,
  createMiddleware,
  tool,
  HumanMessage,
  type StructuredTool,
} from "langchain";
import { OpenAIEmbeddings } from "@langchain/openai";

// 1) Define tools with good names/descriptions
const bookFlight = tool(
  async ({ from, to }) => `Booked from ${from} to ${to}`,
  {
    name: "book_flight",
    description: "Book commercial flights between cities",
    schema: z.object({ from: z.string(), to: z.string() }),
  }
);

const lookupVisa = tool(
  async ({ country }) =>
    `For all travelers from ${country}, it is required to have a visa and travel with a banana.`,
  {
    name: "lookup_visa_requirements",
    description:
      "Check visa requirements and documentation by destination country",
    schema: z.object({ country: z.string() }),
  }
);

const localWeather = tool(async ({ city }) => `Weather in ${city}: Sunny`, {
  name: "local_weather",
  description: "Get current weather and short-term forecast for a city",
  schema: z.object({ city: z.string() }),
});

const fullCatalog = [bookFlight, lookupVisa, localWeather];

// 2) Precompute and cache embeddings for tool metadata
const embedder = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
const toolTexts = fullCatalog.map((t) => `${t.name}: ${t.description}`);
const toolVectors = await embedder.embedDocuments(toolTexts);

type CatalogItem = { tool: StructuredTool; vector: number[] };
const catalog: CatalogItem[] = fullCatalog.map((tool, i) => ({
  tool,
  vector: toolVectors[i],
}));

function cosineSimilarity(a: number[], b: number[]) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const na = Math.hypot(...a);
  const nb = Math.hypot(...b);
  return na && nb ? dot / (na * nb) : 0;
}

async function selectTopKBySimilarity(query: string, k = 6) {
  const qv = await embedder.embedQuery(query);
  return catalog
    .map((c) => ({ c, score: cosineSimilarity(qv, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ c }) => c.tool);
}

// 3) Use middleware to expose only the top-k most relevant tools each turn
const selectToolsMiddleware = createMiddleware({
  name: "SelectToolsMiddleware",
  modifyModelRequest: async (request, state) => {
    const last = state.messages.at(-1);
    const tools = last?.content
      ? // only give me the most relevant tool
        await selectTopKBySimilarity(last.content as string, 1)
      : fullCatalog.slice(0, 5);
    return { ...request, tools };
  },
});

const semanticAgent = createAgent({
  model: "openai:gpt-4o",
  tools: fullCatalog, // superset for validation and typing
  middleware: [selectToolsMiddleware] as const,
});

const result = await semanticAgent.invoke({
  messages: [
    new HumanMessage(
      "I need to travel to Japan next month—what visas do I need? I live in Germany."
    ),
  ],
});
console.log(result.messages.at(-1)?.content);
