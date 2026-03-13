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
