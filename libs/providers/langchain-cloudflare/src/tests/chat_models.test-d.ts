import type { Ai } from "@cloudflare/workers-types";
import { describe, it, expectTypeOf } from "vitest";
import { ChatCloudflareWorkersAI } from "../chat_models.js";

describe("ChatCloudflareWorkersAI constructor overloads", () => {
  it("accepts a model string", async () => {
    const chat = new ChatCloudflareWorkersAI("@cf/meta/llama-3-8b-instruct");
    expectTypeOf(chat).toEqualTypeOf<ChatCloudflareWorkersAI>();
  });

  it("accepts a model string with params", async () => {
    const chat = new ChatCloudflareWorkersAI("@cf/meta/llama-3-8b-instruct", {
      cloudflareAccountId: "account",
      cloudflareApiToken: "token",
      streaming: true,
    });
    expectTypeOf(chat).toEqualTypeOf<ChatCloudflareWorkersAI>();
  });

  it("accepts a params object", async () => {
    const chat = new ChatCloudflareWorkersAI({
      model: "@cf/meta/llama-3-8b-instruct",
      cloudflareAccountId: "account",
      cloudflareApiToken: "token",
    });
    expectTypeOf(chat).toEqualTypeOf<ChatCloudflareWorkersAI>();
  });

  it("rejects non-string model shorthand", async () => {
    // @ts-expect-error model shorthand must be a string
    new ChatCloudflareWorkersAI(123);
  });
});

// A Workers AI binding is accepted by both constructor forms.
it("accepts a Workers AI binding in both constructor forms", () => {
  const binding = {} as Ai;
  expectTypeOf(
    new ChatCloudflareWorkersAI({ binding })
  ).toEqualTypeOf<ChatCloudflareWorkersAI>();
  expectTypeOf(
    new ChatCloudflareWorkersAI("@cf/meta/llama-3.1-8b-instruct", { binding })
  ).toEqualTypeOf<ChatCloudflareWorkersAI>();
});
