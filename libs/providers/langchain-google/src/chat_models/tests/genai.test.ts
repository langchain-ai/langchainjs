import { describe, it } from "vitest";
import { ChatGoogleGenerativeAI } from "../node.js";

describe("ChatGoogleGenerativeAI", () => {
  it("works", async () => {
    const model = new ChatGoogleGenerativeAI("gemini-2.0-flash", {
      apiKey: "AIzaSyDVkk6ZpcUlnqGUv8cYARrxHShP4O22Imk",
    });

    const res = await model.invoke("What is 1 + 1?");
    console.log(res);
  });
});
