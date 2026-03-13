import { describe, expect, it } from "vitest";

import { inferModelProviderFromNamespace } from "../node.js";

describe("inferModelProviderFromNamespace", () => {
  describe("returns undefined for invalid inputs", () => {
    it("returns undefined for non-array input", () => {
      // @ts-expect-error Testing invalid input
      expect(inferModelProviderFromNamespace(null)).toBeUndefined();
      // @ts-expect-error Testing invalid input
      expect(inferModelProviderFromNamespace(undefined)).toBeUndefined();
      // @ts-expect-error Testing invalid input
      expect(inferModelProviderFromNamespace("string")).toBeUndefined();
    });

    it("returns undefined for arrays with less than 2 elements", () => {
      expect(inferModelProviderFromNamespace([])).toBeUndefined();
      expect(inferModelProviderFromNamespace(["single"])).toBeUndefined();
    });

    it("returns undefined for arrays with only langchain core packages", () => {
      expect(
        inferModelProviderFromNamespace([
          "langchain",
          "chat_models",
          "ChatOpenAI",
        ])
      ).toBeUndefined();
      expect(
        inferModelProviderFromNamespace([
          "langchain_core",
          "runnables",
          "Runnable",
        ])
      ).toBeUndefined();
    });
  });

  describe("extracts provider from langchain_* package names", () => {
    it("extracts deepseek from langchain_deepseek", () => {
      expect(
        inferModelProviderFromNamespace([
          "langchain_deepseek",
          "chat_models",
          "ChatDeepSeek",
        ])
      ).toBe("deepseek");
    });

    it("extracts google-genai from langchain_google_genai", () => {
      expect(
        inferModelProviderFromNamespace([
          "langchain_google_genai",
          "chat_models",
          "ChatGoogleGenerativeAI",
        ])
      ).toBe("google-genai");
    });

    it("converts underscores to hyphens", () => {
      expect(
        inferModelProviderFromNamespace([
          "langchain_some_provider",
          "chat_models",
          "ChatSomeProvider",
        ])
      ).toBe("some-provider");
    });
  });

  describe("handles Google provider special cases", () => {
    it("returns google-vertexai-web for vertexai_web", () => {
      expect(
        inferModelProviderFromNamespace([
          "langchain",
          "chat_models",
          "vertexai_web",
          "ChatVertexAI",
        ])
      ).toBe("google-vertexai-web");
    });

    it("returns google-vertexai for vertexai", () => {
      expect(
        inferModelProviderFromNamespace([
          "langchain",
          "chat_models",
          "vertexai",
          "ChatVertexAI",
        ])
      ).toBe("google-vertexai");
    });

    it("returns google-genai for genai", () => {
      expect(
        inferModelProviderFromNamespace([
          "langchain",
          "chat_models",
          "genai",
          "ChatGoogleGenerativeAI",
        ])
      ).toBe("google-genai");
    });

    it("returns google-genai for google_genai", () => {
      expect(
        inferModelProviderFromNamespace([
          "langchain",
          "chat_models",
          "google_genai",
          "ChatGoogleGenerativeAI",
        ])
      ).toBe("google-genai");
    });
  });

  describe("handles standard providers", () => {
    it("returns openai for openai namespace", () => {
      expect(
        inferModelProviderFromNamespace([
          "langchain",
          "chat_models",
          "openai",
          "ChatOpenAI",
        ])
      ).toBe("openai");
    });

    it("returns anthropic for anthropic namespace", () => {
      expect(
        inferModelProviderFromNamespace([
          "langchain",
          "chat_models",
          "anthropic",
          "ChatAnthropic",
        ])
      ).toBe("anthropic");
    });

    it("converts underscores to hyphens in provider names", () => {
      expect(
        inferModelProviderFromNamespace([
          "langchain",
          "chat_models",
          "my_custom_provider",
          "ChatCustom",
        ])
      ).toBe("my-custom-provider");
    });
  });
});
