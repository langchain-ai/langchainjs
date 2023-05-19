import { test, expect } from "@jest/globals";
import * as uuid from "uuid";
import { CallbackManager } from "../manager.js";
import { BaseCallbackHandler, BaseCallbackHandlerInput } from "../base.js";
import {
  AgentAction,
  AgentFinish,
  BaseChatMessage,
  ChainValues,
  HumanChatMessage,
  LLMResult,
} from "../../schema/index.js";

class FakeCallbackHandler extends BaseCallbackHandler {
  name = `fake-${uuid.v4()}`;

  starts = 0;

  ends = 0;

  errors = 0;

  chainStarts = 0;

  chainEnds = 0;

  llmStarts = 0;

  llmEnds = 0;

  llmStreams = 0;

  toolStarts = 0;

  toolEnds = 0;

  agentEnds = 0;

  texts = 0;

  constructor(inputs?: BaseCallbackHandlerInput) {
    super(inputs);
  }

  async handleLLMStart(
    _llm: { name: string },
    _prompts: string[]
  ): Promise<void> {
    this.starts += 1;
    this.llmStarts += 1;
  }

  async handleLLMEnd(_output: LLMResult): Promise<void> {
    this.ends += 1;
    this.llmEnds += 1;
  }

  async handleLLMNewToken(_token: string): Promise<void> {
    this.llmStreams += 1;
  }

  async handleLLMError(_err: Error): Promise<void> {
    this.errors += 1;
  }

  async handleChainStart(
    _chain: { name: string },
    _inputs: ChainValues
  ): Promise<void> {
    this.starts += 1;
    this.chainStarts += 1;
  }

  async handleChainEnd(_outputs: ChainValues): Promise<void> {
    this.ends += 1;
    this.chainEnds += 1;
  }

  async handleChainError(_err: Error): Promise<void> {
    this.errors += 1;
  }

  async handleToolStart(
    _tool: { name: string },
    _input: string
  ): Promise<void> {
    this.starts += 1;
    this.toolStarts += 1;
  }

  async handleToolEnd(_output: string): Promise<void> {
    this.ends += 1;
    this.toolEnds += 1;
  }

  async handleToolError(_err: Error): Promise<void> {
    this.errors += 1;
  }

  async handleText(_text: string): Promise<void> {
    this.texts += 1;
  }

  async handleAgentAction(_action: AgentAction): Promise<void> {
    this.starts += 1;
    this.toolStarts += 1;
  }

  async handleAgentEnd(_action: AgentFinish): Promise<void> {
    this.ends += 1;
    this.agentEnds += 1;
  }

  copy(): FakeCallbackHandler {
    const newInstance = new FakeCallbackHandler();
    newInstance.name = this.name;
    newInstance.starts = this.starts;
    newInstance.ends = this.ends;
    newInstance.errors = this.errors;
    newInstance.chainStarts = this.chainStarts;
    newInstance.chainEnds = this.chainEnds;
    newInstance.llmStarts = this.llmStarts;
    newInstance.llmEnds = this.llmEnds;
    newInstance.llmStreams = this.llmStreams;
    newInstance.toolStarts = this.toolStarts;
    newInstance.toolEnds = this.toolEnds;
    newInstance.agentEnds = this.agentEnds;
    newInstance.texts = this.texts;

    return newInstance;
  }
}

class FakeCallbackHandlerWithChatStart extends FakeCallbackHandler {
  chatModelStarts = 0;

  async handleChatModelStart(
    _llm: { name: string },
    _messages: BaseChatMessage[][]
  ): Promise<void> {
    this.starts += 1;
    this.chatModelStarts += 1;
  }
}

test("CallbackManager", async () => {
  const manager = new CallbackManager();
  const handler1 = new FakeCallbackHandler();
  const handler2 = new FakeCallbackHandler();
  manager.addHandler(handler1);
  manager.addHandler(handler2);

  const llmCb = await manager.handleLLMStart({ name: "test" }, ["test"]);
  await llmCb.handleLLMEnd({ generations: [] });
  await llmCb.handleLLMNewToken("test");
  await llmCb.handleLLMError(new Error("test"));
  const chainCb = await manager.handleChainStart(
    { name: "test" },
    { test: "test" }
  );
  await chainCb.handleChainEnd({ test: "test" });
  await chainCb.handleChainError(new Error("test"));
  const toolCb = await manager.handleToolStart({ name: "test" }, "test");
  await toolCb.handleToolEnd("test");
  await toolCb.handleToolError(new Error("test"));
  await chainCb.handleText("test");
  await chainCb.handleAgentAction({
    tool: "test",
    toolInput: "test",
    log: "test",
  });
  await chainCb.handleAgentEnd({ returnValues: { test: "test" }, log: "test" });

  for (const handler of [handler1, handler2]) {
    expect(handler.starts).toBe(4);
    expect(handler.ends).toBe(4);
    expect(handler.errors).toBe(3);
    expect(handler.llmStarts).toBe(1);
    expect(handler.llmEnds).toBe(1);
    expect(handler.llmStreams).toBe(1);
    expect(handler.chainStarts).toBe(1);
    expect(handler.chainEnds).toBe(1);
    expect(handler.toolStarts).toBe(2);
    expect(handler.toolEnds).toBe(1);
    expect(handler.agentEnds).toBe(1);
    expect(handler.texts).toBe(1);
  }
});

test("CallbackManager Chat Message Handling", async () => {
  const manager = new CallbackManager();
  const handler1 = new FakeCallbackHandler();
  const handler2 = new FakeCallbackHandlerWithChatStart();
  manager.addHandler(handler1);
  manager.addHandler(handler2);

  const llmCb = await manager.handleChatModelStart({ name: "test" }, [
    [new HumanChatMessage("test")],
  ]);
  await llmCb.handleLLMEnd({ generations: [] });
  // Everything treated as llm in handler 1
  expect(handler1.llmStarts).toBe(1);
  expect(handler2.llmStarts).toBe(0);
  expect(handler2.chatModelStarts).toBe(1);
  // These should all be treated the same
  for (const handler of [handler1, handler2]) {
    expect(handler.starts).toBe(1);
    expect(handler.ends).toBe(1);
    expect(handler.errors).toBe(0);
    expect(handler.llmEnds).toBe(1);
  }
});

test("CallbackHandler with ignoreLLM", async () => {
  const handler = new FakeCallbackHandler({
    ignoreLLM: true,
  });
  const manager = new CallbackManager();
  manager.addHandler(handler);
  const llmCb = await manager.handleLLMStart({ name: "test" }, ["test"]);
  await llmCb.handleLLMEnd({ generations: [] });
  await llmCb.handleLLMNewToken("test");
  await llmCb.handleLLMError(new Error("test"));

  expect(handler.starts).toBe(0);
  expect(handler.ends).toBe(0);
  expect(handler.errors).toBe(0);
  expect(handler.llmStarts).toBe(0);
  expect(handler.llmEnds).toBe(0);
  expect(handler.llmStreams).toBe(0);
});

test("CallbackHandler with ignoreChain", async () => {
  const handler = new FakeCallbackHandler({
    ignoreChain: true,
  });
  const manager = new CallbackManager();
  manager.addHandler(handler);
  const chainCb = await manager.handleChainStart(
    { name: "test" },
    { test: "test" }
  );
  await chainCb.handleChainEnd({ test: "test" });
  await chainCb.handleChainError(new Error("test"));

  expect(handler.starts).toBe(0);
  expect(handler.ends).toBe(0);
  expect(handler.errors).toBe(0);
  expect(handler.chainStarts).toBe(0);
  expect(handler.chainEnds).toBe(0);
});

test("CallbackHandler with ignoreAgent", async () => {
  const handler = new FakeCallbackHandler({
    ignoreAgent: true,
  });
  const manager = new CallbackManager();
  manager.addHandler(handler);
  const toolCb = await manager.handleToolStart({ name: "test" }, "test");
  await toolCb.handleToolEnd("test");
  await toolCb.handleToolError(new Error("test"));
  const chainCb = await manager.handleChainStart(
    { name: "agent_executor" },
    {}
  );
  await chainCb.handleAgentAction({
    tool: "test",
    toolInput: "test",
    log: "test",
  });
  await chainCb.handleAgentEnd({ returnValues: { test: "test" }, log: "test" });

  expect(handler.starts).toBe(1);
  expect(handler.ends).toBe(0);
  expect(handler.errors).toBe(0);
  expect(handler.toolStarts).toBe(0);
  expect(handler.toolEnds).toBe(0);
  expect(handler.agentEnds).toBe(0);
});

test("CallbackManager with child manager", async () => {
  const llmRunId = "llmRunId";
  const chainRunId = "chainRunId";
  let llmWasCalled = false;
  let chainWasCalled = false;
  const manager = CallbackManager.fromHandlers({
    async handleLLMStart(
      _llm: { name: string },
      _prompts: string[],
      runId?: string,
      parentRunId?: string
    ) {
      expect(runId).toBe(llmRunId);
      expect(parentRunId).toBe(chainRunId);
      llmWasCalled = true;
    },
    async handleChainStart(
      _chain: { name: string },
      _inputs: ChainValues,
      runId?: string,
      parentRunId?: string
    ) {
      expect(runId).toBe(chainRunId);
      expect(parentRunId).toBe(undefined);
      chainWasCalled = true;
    },
  });
  const chainCb = await manager.handleChainStart(
    { name: "test" },
    { test: "test" },
    chainRunId
  );
  await chainCb.getChild().handleLLMStart({ name: "test" }, ["test"], llmRunId);
  expect(llmWasCalled).toBe(true);
  expect(chainWasCalled).toBe(true);
});

test("CallbackManager with child manager inherited handlers", async () => {
  const callbackManager1 = new CallbackManager();
  const handler1 = new FakeCallbackHandler();
  const handler2 = new FakeCallbackHandler();
  const handler3 = new FakeCallbackHandler();
  const handler4 = new FakeCallbackHandler();

  callbackManager1.setHandlers([handler1, handler2]);
  expect(callbackManager1.handlers).toEqual([handler1, handler2]);
  expect(callbackManager1.inheritableHandlers).toEqual([handler1, handler2]);

  const callbackManager2 = callbackManager1.copy([handler3, handler4]);
  expect(callbackManager2.handlers).toEqual([
    handler1,
    handler2,
    handler3,
    handler4,
  ]);
  expect(callbackManager2.inheritableHandlers).toEqual([
    handler1,
    handler2,
    handler3,
    handler4,
  ]);

  const callbackManager3 = callbackManager1.copy([handler3, handler4], false);
  expect(callbackManager3.handlers).toEqual([
    handler1,
    handler2,
    handler3,
    handler4,
  ]);
  expect(callbackManager3.inheritableHandlers).toEqual([handler1, handler2]);

  const chainCb = await callbackManager3.handleChainStart(
    { name: "test" },
    { test: "test" }
  );
  const childManager = chainCb.getChild();
  expect(childManager.handlers.map((h) => h.name)).toEqual([
    handler1.name,
    handler2.name,
  ]);
  expect(childManager.inheritableHandlers.map((h) => h.name)).toEqual([
    handler1.name,
    handler2.name,
  ]);

  const toolCb = await childManager.handleToolStart({ name: "test" }, "test");
  const childManager2 = toolCb.getChild();
  expect(childManager2.handlers.map((h) => h.name)).toEqual([
    handler1.name,
    handler2.name,
  ]);
  expect(childManager2.inheritableHandlers.map((h) => h.name)).toEqual([
    handler1.name,
    handler2.name,
  ]);
});

test("CallbackManager.copy()", () => {
  const callbackManager1 = new CallbackManager();
  const handler1 = new FakeCallbackHandler();
  const handler2 = new FakeCallbackHandler();
  const handler3 = new FakeCallbackHandler();
  const handler4 = new FakeCallbackHandler();

  callbackManager1.addHandler(handler1, true);
  callbackManager1.addHandler(handler2, false);
  expect(callbackManager1.handlers).toEqual([handler1, handler2]);
  expect(callbackManager1.inheritableHandlers).toEqual([handler1]);

  const callbackManager2 = callbackManager1.copy([handler3]);
  expect(callbackManager2.handlers.map((h) => h.name)).toEqual([
    handler1.name,
    handler2.name,
    handler3.name,
  ]);
  expect(callbackManager2.inheritableHandlers.map((h) => h.name)).toEqual([
    handler1.name,
    handler3.name,
  ]);

  const callbackManager3 = callbackManager2.copy([handler4], false);
  expect(callbackManager3.handlers.map((h) => h.name)).toEqual([
    handler1.name,
    handler2.name,
    handler3.name,
    handler4.name,
  ]);
  expect(callbackManager3.inheritableHandlers.map((h) => h.name)).toEqual([
    handler1.name,
    handler3.name,
  ]);
});
