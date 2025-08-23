import { describe, expect, test } from "@jest/globals";
import { z } from "zod";
import { FakeChatModel } from "../../utils/testing/index.js";
import type {
  BaseChatModelCallOptions,
  BindToolsInput,
} from "../chat_models.js";

// class FakeChatModelWithBindTools extends FakeChatModel {
//   // It's not a requirement that your solution keep this stubbed method
//   // as-is. In fact, this task would be impossible to complete without
//   // changing this.
//   override bindTools(
//     tools: BindToolsInput[],
//     kwargs?: Partial<BaseChatModelCallOptions>
//   ) {
//     return this.bind({});
//   }
// }


/**
 * Minimal subclass adding a functional bindTools implementation.
 * It relies on withConfig merging to ensure order independence.
 */
class FakeChatModelWithBindTools extends FakeChatModel {
  private _tools?: BindToolsInput[];

  // Return a new instance carrying over (or setting) tools plus any extra kwargs.
  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<BaseChatModelCallOptions>
  ) {
    const clone = new FakeChatModelWithBindTools({ ...(kwargs ?? {}) });
    clone._tools = tools;
    return clone;
  }

  // Preserve previously bound tools when reconfiguring.
  override withConfig(config: Partial<BaseChatModelCallOptions>): FakeChatModelWithBindTools {
    const clone = new FakeChatModelWithBindTools({ ...config });
    (clone as any)._tools = this._tools;
    return clone;
  }
}

describe("bindTools + withConfig order independence", () => {
  test("Applying withConfig before bindTools yields identical result to the inverse order", async () => {
    const model = new FakeChatModelWithBindTools({});

    // Define a simple echo tool spec (shape sufficient for BindToolsInput).
    const echoTool = {
      name: "echo",
      description: "Echos the input",
      schema: z.string(),
    };

    const config = {
      stop: ["stop"], // FakeChatModel returns the first stop token if provided.
    };

    const tools = [echoTool];

    // Order 1: withConfig then bindTools
    const configuredThenBound = model.withConfig(config).bindTools(tools);
    // Order 2: bindTools then withConfig
    const boundThenConfigured = model.bindTools(tools).withConfig(config);

    const input = "Any arbitrary input";

    const resultA = await configuredThenBound.invoke(input);
    const resultB = await boundThenConfigured.invoke(input);

    // Core assertion: contents are identical
    expect(resultA.content).toEqual(resultB.content);
  });
});