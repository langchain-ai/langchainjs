import { test, expect } from "@jest/globals";
import { z } from "zod";
import { FakeChatModel } from "../../utils/testing/index.js";
import { tool } from "../../tools/index.js";
import type { BaseChatModelCallOptions, BindToolsInput } from "../chat_models";

class FakeChatModelWithBindTools extends FakeChatModel {
  private _tools?: BindToolsInput[];

  // returns a new instance of self with the tools bound, preserving any previous tools
  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<BaseChatModelCallOptions>
  ) {
    const newModel = new FakeChatModelWithBindTools({ ...(kwargs ?? {}) });
    const merged = [...(this._tools ?? []), ...tools];
    newModel._tools = merged;
    return newModel;
  }

  // returns a new instance of self with config merged and tools preserved
  override withConfig(
    config: Partial<BaseChatModelCallOptions>
  ): FakeChatModelWithBindTools {
    const newModel = new FakeChatModelWithBindTools({ ...config });
    (newModel as FakeChatModelWithBindTools)._tools = this._tools;
    return newModel;
  }
}

test("Chat model binding and configuration order should not affect results", async () => {
  // This can be any child of BaseChatModel that supports bindTools,
  // e.g. ChatOpenAI, ChatAnthropic, etc. Unfortunately FakeChatModel
  // doesn't implement bindTools, so we use FakeChatModelWithBindTools
  // as a placeholder.
  const model = new FakeChatModelWithBindTools({});

  const echoTool = tool((input) => String(input), {
    name: "echo",
    description: "Echos the input",
    schema: z.string(),
  });

  const config = {
    // `FakeChatModel` always responds with the configured stop token, but
    // in actual practice this could be any arbitrary config.
    stop: ["stop"],
  };

  const tools = [echoTool];

  // Here's the important part 👇
  const configuredBoundModel = model.withConfig(config).bindTools(tools);
  const boundConfiguredModel = model.bindTools(tools).withConfig(config);

  const configuredBoundModelResult = await configuredBoundModel.invoke(
    "Any arbitrary input"
  );
  const boundConfiguredModelResult = await boundConfiguredModel.invoke(
    "Any arbitrary input"
  );

  expect(configuredBoundModelResult.content).toEqual(
    boundConfiguredModelResult.content
  );
});
