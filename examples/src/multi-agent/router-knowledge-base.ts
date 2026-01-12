/**
 * Multi-Source Knowledge Router Example
 *
 * This example demonstrates the router pattern for multi-agent systems.
 * A router classifies queries, routes them to specialized agents in parallel,
 * and synthesizes results into a combined response.
 */
import { z } from "zod";
import { tool } from "langchain";
import { withLangGraph } from "@langchain/langgraph/zod";
import {
  StateGraph,
  START,
  END,
  Send,
  MemorySaver,
} from "@langchain/langgraph";

const AgentOutput = z.object({
  source: z.string(),
  result: z.string(),
});

const RouterState = z.object({
  query: z.string(),
  classifications: z.array(
    z.object({
      source: z.enum(["github", "notion", "slack"]),
      query: z.string(),
    })
  ),
  results: withLangGraph(z.array(AgentOutput), {
    reducer: {
      schema: z.array(AgentOutput),
      fn: (current, update) => current.concat(update),
    },
    default: () => [] as z.infer<typeof AgentOutput>[],
  }),
  finalAnswer: z.string(),
});

const searchCode = tool(
  async ({ query, repo }) => {
    return `Found code matching '${query}' in ${repo || "main"}: authentication middleware in src/auth.py`;
  },
  {
    name: "search_code",
    description: "Search code in GitHub repositories.",
    schema: z.object({
      query: z.string(),
      repo: z.string().optional().default("main"),
    }),
  }
);

const searchIssues = tool(
  async ({ query }) => {
    return `Found 3 issues matching '${query}': #142 (API auth docs), #89 (OAuth flow), #203 (token refresh)`;
  },
  {
    name: "search_issues",
    description: "Search GitHub issues and pull requests.",
    schema: z.object({
      query: z.string(),
    }),
  }
);

const searchPrs = tool(
  async (/*{ query }*/) => {
    return `PR #156 added JWT authentication, PR #178 updated OAuth scopes`;
  },
  {
    name: "search_prs",
    description: "Search pull requests for implementation details.",
    schema: z.object({
      query: z.string(),
    }),
  }
);

const searchNotion = tool(
  async (/*{ query }*/) => {
    return `Found documentation: 'API Authentication Guide' - covers OAuth2 flow, API keys, and JWT tokens`;
  },
  {
    name: "search_notion",
    description: "Search Notion workspace for documentation.",
    schema: z.object({
      query: z.string(),
    }),
  }
);

const getPage = tool(
  async (/*{ pageId }*/) => {
    return `Page content: Step-by-step authentication setup instructions`;
  },
  {
    name: "get_page",
    description: "Get a specific Notion page by ID.",
    schema: z.object({
      pageId: z.string(),
    }),
  }
);

const searchSlack = tool(
  async (/*{ query }*/) => {
    return `Found discussion in #engineering: 'Use Bearer tokens for API auth, see docs for refresh flow'`;
  },
  {
    name: "search_slack",
    description: "Search Slack messages and threads.",
    schema: z.object({
      query: z.string(),
    }),
  }
);

const getThread = tool(
  async (/*{ threadId }*/) => {
    return `Thread discusses best practices for API key rotation`;
  },
  {
    name: "get_thread",
    description: "Get a specific Slack thread.",
    schema: z.object({
      threadId: z.string(),
    }),
  }
);

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({ model: "gpt-4o" });

const githubAgent = createAgent({
  model: llm,
  tools: [searchCode, searchIssues, searchPrs],
  systemPrompt: `
You are a GitHub expert. Answer questions about code,
API references, and implementation details by searching
repositories, issues, and pull requests.
  `.trim(),
});

const notionAgent = createAgent({
  model: llm,
  tools: [searchNotion, getPage],
  systemPrompt: `
You are a Notion expert. Answer questions about internal
processes, policies, and team documentation by searching
the organization's Notion workspace.
  `.trim(),
});

const slackAgent = createAgent({
  model: llm,
  tools: [searchSlack, getThread],
  systemPrompt: `
You are a Slack expert. Answer questions by searching
relevant threads and discussions where team members have
shared knowledge and solutions.
  `.trim(),
});

const routerLlm = new ChatOpenAI({ model: "gpt-4o-mini" });

// Define structured output schema for the classifier
const ClassificationResultSchema = z.object({
  // [!code highlight]
  classifications: z
    .array(
      z.object({
        source: z.enum(["github", "notion", "slack"]),
        query: z.string(),
      })
    )
    .describe("List of agents to invoke with their targeted sub-questions"),
});

async function classifyQuery(state: z.infer<typeof RouterState>) {
  const structuredLlm = routerLlm.withStructuredOutput(
    ClassificationResultSchema
  ); // [!code highlight]

  const result = await structuredLlm.invoke([
    {
      role: "system",
      content: `Analyze this query and determine which knowledge bases to consult.
For each relevant source, generate a targeted sub-question optimized for that source.

Available sources:
- github: Code, API references, implementation details, issues, pull requests
- notion: Internal documentation, processes, policies, team wikis
- slack: Team discussions, informal knowledge sharing, recent conversations

Return ONLY the sources that are relevant to the query. Each source should have
a targeted sub-question optimized for that specific knowledge domain.

Example for "How do I authenticate API requests?":
- github: "What authentication code exists? Search for auth middleware, JWT handling"
- notion: "What authentication documentation exists? Look for API auth guides"
(slack omitted because it's not relevant for this technical question)`,
    },
    { role: "user", content: state.query },
  ]);

  return { classifications: result.classifications };
}

function routeToAgents(state: z.infer<typeof RouterState>): Send[] {
  return state.classifications.map(
    (c) => new Send(c.source, { query: c.query }) // [!code highlight]
  );
}

async function queryGithub(state: z.infer<typeof RouterState>) {
  const result = await githubAgent.invoke({
    messages: [{ role: "user", content: state.query }], // [!code highlight]
  });
  return {
    results: [{ source: "github", result: result.messages.at(-1)?.content }],
  };
}

async function queryNotion(state: z.infer<typeof RouterState>) {
  const result = await notionAgent.invoke({
    messages: [{ role: "user", content: state.query }], // [!code highlight]
  });
  return {
    results: [{ source: "notion", result: result.messages.at(-1)?.content }],
  };
}

async function querySlack(state: z.infer<typeof RouterState>) {
  const result = await slackAgent.invoke({
    messages: [{ role: "user", content: state.query }], // [!code highlight]
  });
  return {
    results: [{ source: "slack", result: result.messages.at(-1)?.content }],
  };
}

async function synthesizeResults(state: z.infer<typeof RouterState>) {
  if (state.results.length === 0) {
    return { finalAnswer: "No results found from any knowledge source." };
  }

  // Format results for synthesis
  const formatted = state.results.map(
    (r) =>
      `**From ${r.source.charAt(0).toUpperCase() + r.source.slice(1)}:**\n${r.result}`
  );

  const synthesisResponse = await routerLlm.invoke([
    {
      role: "system",
      content: `Synthesize these search results to answer the original question: "${state.query}"

- Combine information from multiple sources without redundancy
- Highlight the most relevant and actionable information
- Note any discrepancies between sources
- Keep the response concise and well-organized`,
    },
    { role: "user", content: formatted.join("\n\n") },
  ]);

  return { finalAnswer: synthesisResponse.content };
}

const workflow = new StateGraph(RouterState)
  .addNode("classify", classifyQuery)
  .addNode("github", queryGithub)
  .addNode("notion", queryNotion)
  .addNode("slack", querySlack)
  .addNode("synthesize", synthesizeResults)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", routeToAgents, ["github", "notion", "slack"])
  .addEdge("github", "synthesize")
  .addEdge("notion", "synthesize")
  .addEdge("slack", "synthesize")
  .addEdge("synthesize", END)
  .compile();

const result = await workflow.invoke({
  query: "How do I authenticate API requests?",
});

console.log("Original query:", result.query);
console.log("\nClassifications:");
for (const c of result.classifications) {
  console.log(`  ${c.source}: ${c.query}`);
}
console.log(`\n${"=".repeat(60)}\n`);
console.log("Final Answer:");
console.log(result.finalAnswer);

/**
 * Conversational Agent Example
 */
const searchKnowledgeBase = tool(
  async ({ query }) => {
    const result = await workflow.invoke({ query });
    return result.finalAnswer;
  },
  {
    name: "search_knowledge_base",
    description: `Search across multiple knowledge sources (GitHub, Notion, Slack).
Use this to find information about code, documentation, or team discussions.`,
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

const conversationalAgent = createAgent({
  model: llm,
  tools: [searchKnowledgeBase],
  systemPrompt: `
You are a helpful assistant that answers questions about our organization.
Use the search_knowledge_base tool to find information across our code,
documentation, and team discussions.
  `.trim(),
  checkpointer: new MemorySaver(),
});

const config = { configurable: { thread_id: "user-123" } };
let conversationalAgentResult = await conversationalAgent.invoke(
  {
    messages: [
      { role: "user", content: "How do I authenticate API requests?" },
    ],
  },
  config
);
console.log(conversationalAgentResult.messages.at(-1)?.content);

conversationalAgentResult = await conversationalAgent.invoke(
  {
    messages: [
      {
        role: "user",
        content: "What about rate limiting for those endpoints?",
      },
    ],
  },
  config
);
console.log(conversationalAgentResult.messages.at(-1)?.content);
