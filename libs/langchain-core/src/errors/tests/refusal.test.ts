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

  it("marks a provider error as a refusal without changing its class", () => {
    class ProviderBlockedError extends Error {}
    const rawMessage = new AIMessage("");
    const error = ModelRefusalError.markAsRefusal(
      new ProviderBlockedError("Prompt blocked"),
      rawMessage
    );
    expect(error).toBeInstanceOf(ProviderBlockedError);
    expect(ModelRefusalError.isInstance(error)).toBe(true);
    expect(error instanceof ModelRefusalError).toBe(true);
    expect(error.rawMessage).toBe(rawMessage);
    expect(getRetryable(error)).toBe(false);
  });

  it("returns a frozen error unchanged", () => {
    const error = Object.freeze(new Error("x"));
    expect(ModelRefusalError.markAsRefusal(error)).toBe(error);
    expect(ModelRefusalError.isInstance(error)).toBe(false);
  });

  it("uses the same brand as ModelRefusalError instances", () => {
    const brands = Object.getOwnPropertySymbols(new ModelRefusalError());
    const marked = Object.getOwnPropertySymbols(
      ModelRefusalError.markAsRefusal(new Error("x"))
    );
    expect(brands).toEqual(expect.arrayContaining(marked));
  });
});
