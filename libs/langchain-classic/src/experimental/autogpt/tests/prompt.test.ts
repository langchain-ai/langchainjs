import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AutoGPTPrompt } from "../prompt.js";

// Mock token counter function
const mockTokenCounter = async (text: string): Promise<number> => text.length;

// Mock vector store retriever interface
// Todo: replace any with actual interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMemory: any = {
  invoke: async () => [{ pageContent: "relevant content", metadata: {} }],
};

describe("AutoGPTPrompt", () => {
  it("should construct full prompt correctly", () => {
    const prompt = new AutoGPTPrompt({
      aiName: "TestAI",
      aiRole: "Assistant",
      tools: [],
      tokenCounter: mockTokenCounter,
      sendTokenLimit: 2500,
    });

    const goals = ["Goal1", "Goal2"];
    const fullPrompt = prompt.constructFullPrompt(goals);
    expect(fullPrompt).toContain("TestAI");
    expect(fullPrompt).toContain("Assistant");
    expect(fullPrompt).toContain("Goal1");
    expect(fullPrompt).toContain("Goal2");
  });

  it("should format messages correctly", async () => {
    const prompt = new AutoGPTPrompt({
      aiName: "TestAI",
      aiRole: "Assistant",
      tools: [],
      tokenCounter: mockTokenCounter,
      sendTokenLimit: 2500,
    });

    const formattedMessages = await prompt.formatMessages({
      goals: ["Goal1"],
      memory: mockMemory,
      messages: [
        new HumanMessage("Hello"),
        new SystemMessage("System message"),
      ],
      user_input: "User input",
    });

    expect(formattedMessages).toHaveLength(4); // Base prompt, time prompt, memory message, and 2 previous messages

    // Check the content of the first message (base prompt)
    expect(formattedMessages[0].content).toContain("TestAI");
    expect(formattedMessages[0].content).toContain("Assistant");
    expect(formattedMessages[0].content).toContain("Goal1");

    // Check the content of the second message (time prompt)
    expect(formattedMessages[1].content).toMatch(
      /\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{1,2}:\d{1,2} (AM|PM)/
    );

    // Check the content of the third message (memory message)
    expect(formattedMessages[2].content).toContain("relevant content");

    //  Check the content of the previous messages
    const humanMessage = formattedMessages.find(
      // eslint-disable-next-line no-instanceof/no-instanceof
      (msg) => msg instanceof HumanMessage
    );
    const systemMessage = formattedMessages.find(
      // eslint-disable-next-line no-instanceof/no-instanceof
      (msg) => msg instanceof SystemMessage
    );

    // Validate HumanMessage
    expect(humanMessage).toBeDefined();

    // Validate SystemMessage
    expect(systemMessage).toBeDefined();

    // Validate user_input
    expect(formattedMessages[3].content).toContain("User input");
  });
});
