/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import { stateFileSystemMiddleware } from "../stateFileSystem.js";
import { createAgent } from "../../index.js";
import { FakeToolCallingChatModel } from "../../tests/utils.js";

function createMockModel() {
  const invokeCallback = vi
    .fn()
    .mockResolvedValue(new AIMessage("Response from model"));
  return {
    getName: () => "mock",
    bindTools: vi.fn().mockReturnThis(),
    _streamResponseChunks: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: invokeCallback,
    lc_runnable: true,
    _modelType: "mock",
    _generate: vi.fn(),
    _llmType: () => "mock",
  };
}

describe("stateFileSystemMiddleware", () => {
  it("should update system prompt with filesystem tools description", async () => {
    const model = createMockModel() as unknown as LanguageModelLike;
    const middleware = stateFileSystemMiddleware();

    const agent = createAgent({
      model,
      middleware: [middleware] as const,
    });

    const messages = [new HumanMessage("Hello")];

    await agent.invoke({ messages });

    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as any).mock.calls[0];
    const [firstMessage] = callArgs[0];

    // Check that system message exists and contains filesystem tools info
    expect(firstMessage.type).toBe("system");
    expect(firstMessage.content).toContain("Filesystem Tools");
    expect(firstMessage.content).toContain("ls");
    expect(firstMessage.content).toContain("read_file");
    expect(firstMessage.content).toContain("write_file");
    expect(firstMessage.content).toContain("edit_file");
  });

  it("should contribute 4 tools (ls, read_file, write_file, edit_file)", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response from model")],
    });

    const bindToolsSpy = vi.spyOn(model, "bindTools");
    const middleware = stateFileSystemMiddleware();

    const agent = createAgent({
      model,
      middleware: [middleware] as const,
    });

    const messages = [new HumanMessage("Hello")];

    await agent.invoke({ messages });

    // Check that bindTools was called with the tools
    expect(bindToolsSpy).toHaveBeenCalled();
    const bindToolsArgs = bindToolsSpy.mock.calls[0];
    const tools = bindToolsArgs[0];

    // Should have 4 tools
    expect(tools).toHaveLength(4);

    // Extract tool names
    const toolNames = tools.map((tool: any) => tool.name);

    // Verify all 4 expected tools are present
    expect(toolNames).toContain("ls");
    expect(toolNames).toContain("read_file");
    expect(toolNames).toContain("write_file");
    expect(toolNames).toContain("edit_file");
  });
});
