import { z } from "zod";
import {
  createMiddleware,
  createMiddlewareAgent,
  HumanMessage,
  MemorySaver,
} from "langchain";
import { Command, interrupt } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

/**
 * Simple Human in the Loop (HITL) Middleware
 *
 * This middleware demonstrates how to interrupt execution when information is missing
 * and resume with human-provided input.
 */
export const humanInTheLoopMiddleware = createMiddleware({
  name: "HumanInTheLoopMiddleware",

  beforeModel: (state) => {
    // Check if the user's question is missing critical information
    const lastUserMessage = [...state.messages]
      .reverse()
      .find((msg) => msg instanceof HumanMessage);

    if (!lastUserMessage) {
      return;
    }

    const userContent = lastUserMessage.content.toString().toLowerCase();

    // Interrupt to ask for clarification
    const clarification = interrupt({
      type: "missing_information",
      question: "Which country or state's capital are you asking about?",
      originalQuery: userContent,
    });

    // Add the clarification as a new message
    console.log(`\n✅ Human provided clarification: "${clarification}"`);

    // eslint-disable-next-line consistent-return
    return {
      messages: [
        ...state.messages,
        new HumanMessage(`The capital of ${clarification}`),
      ],
      clarificationRequested: true,
    };
  },
});

const agent = createMiddlewareAgent({
  model: "openai:gpt-4o-mini",
  tools: [],
  checkpointer,
  middlewares: [humanInTheLoopMiddleware] as const,
});

console.log("🚀 Human in the Loop Example - Missing Information Flow");
console.log("========================================================");
console.log(
  "\nThis example shows how the agent interrupts when information is missing"
);
console.log("and resumes with human-provided input.\n");

const threadId = "example-thread-123";

// Step 1: Initial invocation with incomplete information
console.log("📝 Step 1: User asks incomplete question");
console.log('   User: "What\'s the capital?"');

const result = await agent.invoke(
  {
    messages: [new HumanMessage("What's the capital?")],
  },
  {
    configurable: {
      thread_id: threadId,
    },
    context: {
      checkForMissingInfo: true,
    },
  }
);

// This won't be reached due to interruption
console.log("\nFinal message:", result.messages.at(-1)?.content);

// Step 2: Resume with the missing information
console.log("📝 Step 2: Resuming with clarification");
console.log('   Human provides: "France"');

// Resume the graph with the clarification
const resumedResult = await agent.invoke(
  new Command({ resume: "France" }), // No new input needed, we're resuming
  {
    configurable: {
      thread_id: threadId,
    },
  }
);

console.log("\n✅ Agent successfully resumed!");
console.log("Final answer:", resumedResult.messages.at(-1)?.content);
