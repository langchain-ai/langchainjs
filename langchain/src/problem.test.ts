import { FakeChatModel } from "@langchain/core/utils/testing";
import { tool } from "@langchain/core/tools";
import type {
  BaseChatModelCallOptions,
  BindToolsInput,
} from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";

// The main problem is that when you call a function on the model that returns a runnable you loose access to the original model.
// Which means that for any model specific configuration function (in this case "bind tools") you need to call that first, which is annoying.
// An even bigger limitation is that you can only call one model specific configuration function as you'll get back a generic RunnableBinding.

// What we need is access to the model that is bound to the runnable.
// There are many solutions to this.

// The approach I've taken is extending the RunnableBinding to add bind tools to it. It could also hold any additional functions for configuration.
// Upsides:
// simple and adding additional configuration functions is straightforward.
// no breaking changes

// Downside is that The model needs to manually override any function that returns RunnableBinding to return this new class.

// I have a hunch there could be a mare generic way of doing this. RunnableBinding could be modified to proxy certain function calls to the bound object.
// providing types for this would probably be annoying.

// The tradeoff would need to be made based on the amount of classes that would need to expose additional configuration functions.

class FakeChatModelWithBindTools extends FakeChatModel {
  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<BaseChatModelCallOptions>
  ) {
    return this.bind({
      tools,
      ...kwargs,
    } as Partial<BaseChatModelCallOptions>);
  }
}

describe("problemDemo", () => {
  const echoTool = tool((input) => String(input), {
    name: "echo",
    description: "Echos the input",
    schema: z.string(),
  });

  const config = {
    stop: ["stop"],
  } as RunnableConfig;

  const tools = [echoTool];

  it("order of config and binding doesn't matter", async () => {
    const model = new FakeChatModelWithBindTools({});

    // Here's the important part 👇
    const modelWithTools = model.bindTools(tools);
    const boundConfiguredModel = modelWithTools.withConfig(config);

    const modelWithConfig = model.withConfig(config);
    const configuredBoundModel = modelWithConfig.bindTools(tools);

    const configuredBoundModelResult = await configuredBoundModel.invoke(
      "Any arbitrary input"
    );
    const boundConfiguredModelResult = await boundConfiguredModel.invoke(
      "Any arbitrary input"
    );

    expect(boundConfiguredModelResult.content).toEqual("stop");
    expect(configuredBoundModelResult.content).toEqual(
      boundConfiguredModelResult.content
    );
  });

  it("fails if bind tools is not defined", async () => {
    const model = new FakeChatModel({});

    const modelWithConfig = model.withConfig(config);
    expect(() => modelWithConfig.bindTools(tools)).toThrow(
      '".bindTools()" not supported by this chat model'
    );
  });
});
