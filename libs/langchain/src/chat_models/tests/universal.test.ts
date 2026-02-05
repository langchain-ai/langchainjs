import { describe, it, expect } from "vitest";
import { initChatModel } from "../universal.js";

describe("Will appropriately infer a model profiles", () => {
  it("when provided a profile", async () => {
    const model = await initChatModel("gpt-4o-mini", {
      profile: {
        maxInputTokens: 100000,
      },
    });
    expect(model.profile.maxInputTokens).toBe(100000);
  });

  it("when it should be inferred from the model instance", async () => {
    const model = await initChatModel("gpt-4o-mini", {
      temperature: 0,
    });
    expect(model.profile.maxInputTokens).toBeDefined();
  });
});
