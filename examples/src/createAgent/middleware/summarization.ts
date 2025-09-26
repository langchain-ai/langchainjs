import { createAgent, HumanMessage, AIMessage, BaseMessage } from "langchain";
import { summarizationMiddleware, countTokensApproximately } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { LoremIpsum } from "lorem-ipsum";

// Initialize lorem ipsum generator
const lorem = new LoremIpsum({
  sentencesPerParagraph: {
    max: 8,
    min: 4,
  },
  wordsPerSentence: {
    max: 16,
    min: 4,
  },
});

// Create a summarization model
const summarizationModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.3,
});

// Create summarization middleware with a low token threshold for demo purposes
const summaryMiddleware = summarizationMiddleware({
  model: summarizationModel,
  maxTokensBeforeSummary: 2000, // Low threshold to trigger summarization quickly
  messagesToKeep: 5, // Keep only the last 5 messages after summarization
  tokenCounter: countTokensApproximately, // Use the built-in token counter
});

// Create the agent with summarization middleware
const agent = createAgent({
  model: "openai:gpt-4o-mini",
  tools: [],
  middleware: [summaryMiddleware] as const,
});

console.log("🚀 Summarization Middleware Example");
console.log("==================================");
console.log("\nThis example demonstrates automatic conversation summarization");
console.log("when token limits are approached.\n");

// Generate a long conversation history
const messages: BaseMessage[] = [];

// Add initial context
messages.push(
  new HumanMessage(
    "I'm working on a complex software project and need your help. Let me describe the architecture..."
  )
);

// Generate several exchanges with lorem ipsum content
for (let i = 0; i < 8; i += 1) {
  // Human describes various aspects of their project
  const humanContent = `
Here's another aspect of my project:

${lorem.generateParagraphs(2)}

Additionally, I'm facing these challenges:
${lorem.generateParagraphs(1)}

What are your thoughts on this?
  `.trim();

  messages.push(new HumanMessage(humanContent));

  // AI provides detailed responses
  const aiContent = `
Thank you for sharing those details. Based on what you've described:

${lorem.generateParagraphs(2)}

Here are my recommendations:
1. ${lorem.generateSentences(1)}
2. ${lorem.generateSentences(1)}
3. ${lorem.generateSentences(1)}

${lorem.generateParagraphs(1)}
  `.trim();

  messages.push(new AIMessage(aiContent));
}

// Calculate total tokens before summarization
const totalTokensBefore = countTokensApproximately(messages);
console.log(
  `📊 Token count before summarization: ~${totalTokensBefore} tokens`
);
console.log(`📝 Number of messages: ${messages.length}`);

// Add a final question that will trigger summarization
messages.push(
  new HumanMessage(
    "Given everything we've discussed, what's the most important thing I should focus on first?"
  )
);

console.log("\n🔄 Invoking agent (this will trigger summarization)...\n");

// Invoke the agent - this should trigger summarization
const result = await agent.invoke({
  messages,
});

// Check if summarization occurred
const resultMessages = result.messages;
const systemMessage = resultMessages[0];

const systemContent =
  typeof systemMessage?.content === "string" ? systemMessage.content : "";
if (systemMessage && systemContent.includes("Previous conversation summary:")) {
  console.log("✅ Summarization triggered!");
  console.log(
    `📝 Number of messages after summarization: ${resultMessages.length}`
  );

  // Calculate tokens after summarization
  const totalTokensAfter = countTokensApproximately(resultMessages);
  console.log(
    `📊 Token count after summarization: ~${totalTokensAfter} tokens`
  );
  console.log(
    `💾 Token reduction: ${Math.round(
      (1 - totalTokensAfter / totalTokensBefore) * 100
    )}%`
  );

  console.log("\n📋 Summary content:");
  console.log("================");
  const summaryContent = systemContent
    .split("## Previous conversation summary:")[1]
    ?.trim();
  if (summaryContent) {
    console.log(summaryContent);
  }

  console.log("\n🤖 Agent's final response:");
  console.log("========================");
  const lastContent = resultMessages[resultMessages.length - 1].content;
  console.log(
    typeof lastContent === "string" ? lastContent : JSON.stringify(lastContent)
  );
} else {
  console.log(
    "❌ Summarization was not triggered (message count or token threshold not reached)"
  );
  console.log("\n🤖 Agent's response:");
  const lastContent = resultMessages[resultMessages.length - 1].content;
  console.log(
    typeof lastContent === "string" ? lastContent : JSON.stringify(lastContent)
  );
}

// Demonstrate continuing the conversation after summarization
console.log("\n\n📝 Continuing the conversation...");
console.log("================================");

const continuedResult = await agent.invoke({
  messages: [
    ...resultMessages,
    new HumanMessage(
      "Thanks! Can you remind me what the main challenges were that I mentioned earlier?"
    ),
  ],
});

console.log("\n🤖 Agent's response (using summarized context):");
console.log("===========================================");
const finalContent =
  continuedResult.messages[continuedResult.messages.length - 1].content;
console.log(
  typeof finalContent === "string" ? finalContent : JSON.stringify(finalContent)
);
