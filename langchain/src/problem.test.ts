import { FakeChatModel } from "@langchain/core/utils/testing";
import { tool } from "@langchain/core/tools";
import type {
  BaseChatModelCallOptions,
  BindToolsInput
} from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import { RunnableBinding, RunnableConfig } from "@langchain/core/runnables";

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


class RunnableBindingWithBoundAccess<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig = RunnableConfig,
> extends RunnableBinding<
  RunInput,
  RunOutput,
  CallOptions
  > {

  declare bound: RunnableBinding<RunInput, RunOutput, CallOptions> & { bindTools: (tools: BindToolsInput[], kwargs?: Partial<BaseChatModelCallOptions>) => RunnableBinding<RunInput, RunOutput, CallOptions> };

  bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<BaseChatModelCallOptions>
  ) {
    return this.bound.bindTools(tools, {
      ...this.config,
      ...kwargs,
    });
  }
}

class FakeChatModelWithBindTools extends FakeChatModel {
  // It's not a requirement that your solution keep this stubbed method
  // as-is. In fact, this task would be impossible to complete without
  // changing this.
  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<BaseChatModelCallOptions>
  ) {
    return this.bind({
      tools,
      ...kwargs,
    } as Partial<BaseChatModelCallOptions>);
  }

  override bind(
    kwargs: Partial<BaseChatModelCallOptions>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunnableBindingWithBoundAccess({ bound: this, kwargs, config: {} });
  }

  override withConfig(
    config: Partial<BaseChatModelCallOptions>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunnableBindingWithBoundAccess({
      bound: this,
      config,
      kwargs: {},
    });
  }
}

describe("problemDemo", () => {
  it("should run without errors", async () => {
    // This can be any child of BaseChatModel that supports bindTools,
    // e.g. ChatOpenAI, ChatAnthropic, etc. Unfortunately FakeChatModel
    // doesn't implement bindTools, so I created FakeChatModelWithBindTools
    // below as a placeholder.
    const model = new FakeChatModelWithBindTools({});
    // const model = new ChatOpenAI();

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

    const modelWithTools = model.bindTools(tools);
    const boundConfiguredModel = modelWithTools.withConfig(config);

    const modelWithConfig = model.withConfig(config);
    const configuredBoundModel = modelWithConfig.bindTools(tools);

    const configuredBoundModelResult = await configuredBoundModel
      .invoke("Any arbitrary input");
    const boundConfiguredModelResult = await boundConfiguredModel
      .invoke("Any arbitrary input");


    expect(configuredBoundModelResult.content).toEqual(boundConfiguredModelResult.content);
  });
});