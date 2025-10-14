import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "../chat_models.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("Files API with Code Execution", () => {
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

      // Create ChatAnthropic model with code execution beta header
      const model = new ChatAnthropic({
        model: "claude-3-5-haiku-20241022",
        temperature: 0,
        clientOptions: {
          defaultHeaders: {
            "anthropic-beta": "code-execution-2025-08-25,files-api-2025-04-14",
          },
        },
      });

      // Define the built-in code_execution tool
      const codeExecutionTool = {
        type: "code_execution_20250825" as const,
        name: "code_execution",
      };

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
      const result = await model.invoke([message], {
        tools: [codeExecutionTool],
      });

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

      // The response should contain text with the calculated average
      const textBlocks = content.filter(
        (block) =>
          typeof block === "object" && "type" in block && block.type === "text"
      );
      const responseText = textBlocks
        .map((block) =>
          typeof block === "object" && "text" in block ? block.text : ""
        )
        .join(" ")
        .toLowerCase();

      // The response should mention the average age (30)
      expect(responseText).toMatch(/average|mean/i);
      expect(responseText).toMatch(/30/);
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    }
  }, 60000);
});
