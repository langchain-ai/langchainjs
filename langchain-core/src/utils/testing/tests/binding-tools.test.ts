import * as z from "zod";
import { tool } from "../../../tools/index.js";
import { FakeChatModel } from "../index.js";
import { BaseChatModelCallOptions, BaseChatModelParams, BindToolsInput } from "../../../language_models/chat_models.js";
import { BaseLanguageModelInput } from "../../../language_models/base.js";


class FakeChatModelWithBindTools extends FakeChatModel {
  private _boundConfig?: Partial<BaseChatModelCallOptions>;

  constructor(fields: BaseChatModelParams & { config?: Partial<BaseChatModelCallOptions> }) {
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
  // Implementation from BindingRunnable
  // withConfig(
  //   config: RunnableConfig
  // ): Runnable<RunInput, RunOutput, CallOptions> {
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   return new (this.constructor as any)({
  //     bound: this.bound,
  //     kwargs: this.kwargs,
  //     config: { ...this.config, ...config },
  //   });
  // }

  // Returns new model of the same type, with the config merged
  override withConfig(config: Partial<BaseChatModelCallOptions>) {
    const mergedConfig = { ...(this._boundConfig ?? {}), ...config };
    const newFields = { ...this, config: mergedConfig };
    const newModel = new FakeChatModelWithBindTools(newFields);
    newModel._boundConfig = mergedConfig;
    return newModel;
  }

  override async invoke(input: BaseLanguageModelInput, config?: Partial<BaseChatModelCallOptions>) {
    const mergedConfig = { ...(this._boundConfig ?? {}), ...(config ?? {}) };

    return super.invoke(input, mergedConfig);
  }
}


describe("binding tools", () => {
  it("should bind tools to a function and store them in the model", () => {
    // Arrange
    const model = new FakeChatModelWithBindTools({});
    const echoTool = tool((input) => String(input), {
      name: "echo",
      description: "Echos the input",
      schema: z.string(),
    });
    const tools = [echoTool];

    // Act
    const boundModel = model.bindTools(tools);

    // Assert
    // @ts-expect-error - types
    expect(boundModel.kwargs?.tools).toBeDefined();
    // @ts-expect-error - types
    expect(boundModel.kwargs?.tools.length).toBe(1);
    // @ts-expect-error - types
    expect(boundModel.kwargs?.tools[0].name).toBe("echo");
  });

  it("should bind tools to a function and return same content result", async () => {
    // Arrange
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


    // @ts-expect-error - types
    expect(configuredBoundModel.kwargs?.tools).toBeDefined();
    // @ts-expect-error - types
    expect(configuredBoundModel.kwargs?.tools.length).toBe(1);
    // @ts-expect-error - types
    expect(configuredBoundModel.kwargs?.tools[0].name).toBe("echo");
    // @ts-expect-error - types
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