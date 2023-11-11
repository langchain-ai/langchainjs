import { test, expect } from "@jest/globals";
import { Fireworks } from "../fireworks.js";

describe("Fireworks", () => {
  test("call", async () => {
    const model = new Fireworks({ maxTokens: 50 });
    const res = await model.call("1 + 1 = ");
    console.log({ res });
  });

  test("generate", async () => {
    const model = new Fireworks({ maxTokens: 50 });
    const res = await model.generate(["1 + 1 = "]);
    console.log(JSON.stringify(res, null, 2));

    await expect(
      async () => await model.generate(["1 + 1 = ", "2 + 2 = "])
    ).rejects.toThrow();
  });
});
