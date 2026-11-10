import { describe, expect, it } from "vitest";
import { AIMessage } from "../../messages/ai.js";
import {
  ContextOverflowError,
  getRetryable,
  LangChainError,
  ModelRefusalError,
} from "../index.js";

describe("ModelRefusalError", () => {
  it("is a non-retryable LangChainError with a default message", () => {
    const error = new ModelRefusalError();
    expect(error.message).toBe("Model refused to produce the requested output");
    expect(error.name).toBe("ModelRefusalError");
    expect(LangChainError.isInstance(error)).toBe(true);
    expect(ContextOverflowError.isInstance(error)).toBe(false);
    expect(getRetryable(error)).toBe(false);
  });

  it("builds its message from a refusal block", () => {
    const rawMessage = new AIMessage("");
    const error = ModelRefusalError.fromRefusal(
      { type: "refusal", refusal: "Blocked.", extras: { category: "cyber" } },
      rawMessage
    );
    expect(error.message).toBe(
      "Model refused to produce the requested output (category='cyber'): Blocked."
    );
    expect(error.rawMessage).toBe(rawMessage);
  });

  it("omits an empty refusal text", () => {
    const error = ModelRefusalError.fromRefusal({
      type: "refusal",
      refusal: "",
    });
    expect(error.message).toBe("Model refused to produce the requested output");
  });
});
