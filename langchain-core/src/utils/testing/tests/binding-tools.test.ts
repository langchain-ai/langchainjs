import * as z from "zod";
import { tool } from "../../../tools/index.js";
import { FakeChatModel } from "../index.js";
import { BaseChatModelCallOptions, BaseChatModelParams, BindToolsInput } from "../../../language_models/chat_models.js";
import { BaseLanguageModelInput } from "../../../language_models/base.js";

type FakeChatModelWithBindToolsParams = BaseChatModelParams & { config?: Partial<BaseChatModelCallOptions> };

class FakeChatModelWithBindTools extends FakeChatModel {
  private _boundConfig?: Partial<BaseChatModelCallOptions>;

  private mergeConfig(config?: Partial<BaseChatModelCallOptions>) {
    return { ...(this._boundConfig ?? {}), ...(config ?? {}) };
  }

  constructor(fields: FakeChatModelWithBindToolsParams) {
    super(fields);
    if (fields.config) {
      this._boundConfig = { ...fields.config };
    }
  }

  override bindTools(
      tools: BindToolsInput[],
      kwargs?: Partial<BaseChatModelCallOptions>
    ) {
      return this.bind({
        tools,
        ...kwargs,
      } as Partial<BaseChatModelCallOptions>);
    }

  // Returns new model of the same type, with the config merged
  override withConfig(config: Partial<BaseChatModelCallOptions>) {

    const mergedConfig = this.mergeConfig(config);
    const newFields = { ...this, config: mergedConfig };

    // eslint-disable-next-line
    return new (this.constructor as any)(newFields);
  }

  override async invoke(input: BaseLanguageModelInput, config?: Partial<BaseChatModelCallOptions>) {
    const mergedConfig = this.mergeConfig(config);

    return super.invoke(input, mergedConfig);
  }
}


describe("binding tools", () => {
  it("should bind tools and store them in the model regardless of bind/config order", async () => {
    const model = new FakeChatModelWithBindTools({});
    const echoTool = tool((input) => String(input), {
      name: "echo",
      description: "Echos the input",
      schema: z.string(),
    });
    const config = { stop: ["stop"] };
    const tools = [echoTool];

    const configuredBoundModel = model.withConfig(config).bindTools(tools);
    const boundConfiguredModel = model.bindTools(tools).withConfig(config);


    expect(configuredBoundModel.kwargs?.tools).toBeDefined();
    expect(configuredBoundModel.kwargs?.tools.length).toBe(1);
    expect(configuredBoundModel.kwargs?.tools[0].name).toBe("echo");
    expect(configuredBoundModel.kwargs?.tools[0].name).toEqual(boundConfiguredModel.kwargs?.tools[0].name);

  });

  it("should return the same content result regardless of bind/config order", async () => {
    
    const model = new FakeChatModelWithBindTools({});
    const echoTool = tool((input) => String(input), {
      name: "echo",
      description: "Echos the input",
      schema: z.string(),
    });
    const config = { stop: ["stop"] };
    const input = "Any arbitrary input";
    const tools = [echoTool];

    const configuredBoundModel = model.withConfig(config).bindTools(tools);
    const boundConfiguredModel = model.bindTools(tools).withConfig(config);

    const configuredBoundModelResult = await configuredBoundModel.invoke(input);
    const boundConfiguredModelResult = await boundConfiguredModel.invoke(input);

    expect(configuredBoundModelResult.content).toEqual(boundConfiguredModelResult.content);
  });
});