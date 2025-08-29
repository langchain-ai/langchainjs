import { z } from "zod";
import { describe, it, expect } from "@jest/globals";

import { FakeChatModelWithBindTools } from "../index.js";
import { tool } from "../../../tools/index.js";

describe("FakeChatModelWithBindTools", () => {
  it("should bind tools", async () => {
    // This can be any child of BaseChatModel that supports bindTools,
    // e.g. ChatOpenAI, ChatAnthropic, etc. Unfortunately FakeChatModel
    // doesn't implement bindTools, so I created FakeChatModelWithBindTools
    // below as a placeholder.
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

    expect(configuredBoundModelResult.content).toBe(
      boundConfiguredModelResult.content
    );
  });
});
