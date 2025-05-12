import * as z from "zod";
import { tool } from "../../../tools/index.js";
import { FakeChatModel } from "../index.js";
import { BaseChatModelCallOptions, BindToolsInput } from "../../../language_models/chat_models.js";


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

  override withConfig(
    config: Partial<BaseChatModelCallOptions>
  ) {
    const configuredModel = super.withConfig(config);

    // Add bindTools method to the configured model
    if (!('bindTools' in configuredModel)) {
      Object.defineProperty(configuredModel, 'bindTools',() => {
          return this.withConfig(config);
        });
    }

    return configuredModel;
  }
  }


describe("binding tools", () => {
  it("should bind tools to a function", async () => {
    const model = new FakeChatModelWithBindTools({});

    const echoTool = tool((input) => String(input), {
      name: "echo",
      description: "Echos the input",
      schema: z.string(),
    });
    
    const config = {
      stop: ["stop"],
    };
    
    const tools = [echoTool];

    // @ts-expect-error Property 'bindTools' is being added through withConfig
    const configuredBoundModel = model.withConfig(config).bindTools(tools);
    const boundConfiguredModel = model.bindTools(tools).withConfig(config);
  
    const configuredBoundModelResult = await configuredBoundModel
      .invoke("Any arbitrary input");
    const boundConfiguredModelResult = await boundConfiguredModel
      .invoke("Any arbitrary input");
    
    expect(configuredBoundModelResult.content).toEqual(boundConfiguredModelResult.content);

  });
});