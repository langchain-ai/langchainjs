import { test } from "@jest/globals";
import { Friendli } from "../friendli.js";

describe.skip("Friendli", () => {
  test("call", async () => {
    const friendli = new Friendli({ maxTokens: 20 });
    const res = await friendli.invoke("1 + 1 = ");
    console.log({ res });
  });

  test("generate", async () => {
    const friendli = new Friendli({ maxTokens: 20 });
    const res = await friendli.generate(["1 + 1 = "]);
    console.log(JSON.stringify(res, null, 2));
  });
});
