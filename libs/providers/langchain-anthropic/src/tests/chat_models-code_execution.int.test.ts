import { describe, it, expect, beforeEach } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "../chat_models.js";
import { extractGeneratedFiles } from "../utils/extractGeneratedFiles.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("Files API with Code Execution", () => {
  let model: ReturnType<ChatAnthropic["bindTools"]>;

  beforeEach(() => {
    // Create ChatAnthropic model with code execution beta header and bind tools
    const baseModel = new ChatAnthropic({
      model: "claude-3-5-haiku-20241022",
      temperature: 0,
      clientOptions: {
        defaultHeaders: {
          "anthropic-beta": "code-execution-2025-08-25,files-api-2025-04-14",
        },
      },
    });

    // Bind the code_execution tool
    model = baseModel.bindTools([
      {
        type: "code_execution_20250825" as const,
        name: "code_execution",
      },
    ]);
  });

  it("should handle createMessageWithFiles using container_upload blocks", async () => {
    // Create Anthropic client for Files API
    const anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Create a temporary CSV file
    const csvContent =
      "name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,Chicago";
    const tmpDir = os.tmpdir();
    const tmpFilePath = path.join(tmpDir, "test_data.csv");
    fs.writeFileSync(tmpFilePath, csvContent);

    try {
      // Upload file using Anthropic Files API
      const fileUpload = await anthropicClient.beta.files.upload({
        file: fs.createReadStream(tmpFilePath),
      });

      // Create a message with container_upload block
      const message = new HumanMessage({
        content: [
          {
            type: "text",
            text: "Analyze this CSV data and tell me the average age",
          },
          { type: "container_upload", file_id: fileUpload.id },
        ],
      });

      // Invoke the model with the file
      const result = await model.invoke([message]);

      // Verify the result is an AIMessage
      expect(result).toBeInstanceOf(AIMessage);

      // The response should contain content blocks
      const content = Array.isArray(result.content) ? result.content : [];
      expect(content.length).toBeGreaterThan(0);

      // Verify that code_execution tool was used (server_tool_use block)
      expect(
        content.some(
          (block) =>
            typeof block === "object" &&
            "type" in block &&
            block.type === "server_tool_use"
        )
      ).toBe(true);

      // Verify that we got a code execution result
      expect(
        content.some(
          (block) =>
            typeof block === "object" &&
            "type" in block &&
            block.type === "bash_code_execution_tool_result"
        )
      ).toBe(true);

      // The response should mention the average age (30)
      expect(result.text).toMatch(/average|mean/i);
      expect(result.text).toMatch(/30/);
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    }
  }, 60000);

  it("should pass container and file outputs across multiple turns", async () => {
    // First invocation: Calculate mean and avg, store to file
    const firstMessage = new HumanMessage(
      "Calculate the mean and average of these numbers: 10, 20, 30, 40, 50. Store the results in a file called 'results.txt'."
    );

    const firstResult = await model.invoke([firstMessage]);

    // Verify first result succeeded
    expect(firstResult).toBeInstanceOf(AIMessage);

    // Extract container ID from first response
    const container = (firstResult as AIMessage).additional_kwargs
      ?.container as { id: string; expires_at: string } | undefined;
    expect(container?.id).toBeTruthy();

    // Verify file output was created using extractGeneratedFilesAnthropic
    const fileIds = extractGeneratedFiles(
      firstResult as unknown as Anthropic.Beta.BetaMessage
    );
    expect(fileIds.length).toBeGreaterThan(0);

    // Second invocation: Read the file with same container
    // This should succeed because we apply the workaround in message_inputs.ts
    const secondMessage = new HumanMessage(
      "What are the contents of the results.txt file?"
    );

    const secondResult = await model.invoke(
      [firstMessage, firstResult, secondMessage],
      {
        container: container?.id, // Pass container to reuse files
      }
    );

    // Verify second result succeeded
    expect(secondResult).toBeInstanceOf(AIMessage);
    const secondContent = Array.isArray(secondResult.content)
      ? secondResult.content
      : [];
    expect(secondContent.length).toBeGreaterThan(0);

    // Verify the same container was reused
    const secondContainer = (secondResult as AIMessage).additional_kwargs
      ?.container as { id: string; expires_at: string } | undefined;
    expect(secondContainer?.id).toBe(container?.id);

    expect(secondResult.text).toMatch(/30/);
  }, 60000);
});
