import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import {
  codeExecutionMiddleware,
  createAgent,
  MemoryFileProvider,
} from "langchain";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChatAnthropic } from "../../chat_models.js";
import { AnthropicContainerProvider } from "../containerProvider.js";

const thread = {
  configurable: {
    thread_id: "test-123",
  },
};

describe("dataAnalysisMiddleware integration tests", () => {
  let model: ChatAnthropic;
  let outputDir: string;
  const testDataPath = "test_data.csv";
  const fullTestDataPath = join(__dirname, "fixtures", testDataPath);

  beforeAll(() => {
    model = new ChatAnthropic({
      model: "claude-sonnet-4-20250514", // Haiku is a bit too dumb
    });

    // Create temporary directory for test outputs
    outputDir = mkdtempSync(join(tmpdir(), "langchain-test-"));
  });

  afterAll(() => {
    // Clean up temporary directory
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it(
    "should upload file, analyze data, and download generated files",
    {
      timeout: 120000, // 2 minute timeout for API calls
    },
    async () => {
      const middleware = codeExecutionMiddleware(
        new AnthropicContainerProvider(),
        new MemoryFileProvider()
      );

      // Create agent with data analysis middleware
      const agent = createAgent({
        model,
        middleware: [middleware],
        checkpointer: new MemorySaver(),
      });

      // Invoke agent with analysis task
      const result1 = await agent.invoke(
        {
          messages: new HumanMessage("Filter to just widget A"),
          files: [
            await middleware.addFile(
              testDataPath,
              await fs.readFile(fullTestDataPath)
            ),
          ],
        },
        thread
      );

      // Verify first response
      expect(result1.messages).toBeTruthy();
      expect(result1.messages.length).toBeGreaterThan(0);

      const result2 = await agent.invoke(
        {
          messages: new HumanMessage(
            "Turn that into a graph of sales and units over time."
          ),
        },
        thread
      );

      // Verify second response and extract generated files
      expect(result2.messages).toBeTruthy();
      expect(result2.messages.length).toBeGreaterThan(0);

      const generatedImages = middleware
        .files(result2)
        .filter(({ type, path }) => type === "tool" && path.endsWith(".png"));

      expect(generatedImages.length).toBeGreaterThan(0);

      for (const img of generatedImages) {
        const content = await img.getContent();
        expect(content.length).toBeGreaterThan(0);
        // Basic check that it's a PNG file
        expect(content.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      }
    }
  );
});
