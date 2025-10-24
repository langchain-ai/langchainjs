import { test, expect } from "@jest/globals";
import { TransformChain } from "../transform.js";

test("TransformChain", async () => {
  const chain = new TransformChain({
    transform: async (values: { a: number; b: number }) => ({
      c: values.a + values.b,
    }),
    inputVariables: ["a", "b"],
    outputVariables: ["c"],
  });

  await expect(chain.invoke({ a: 1, b: 2 })).resolves.toEqual({ c: 3 });
});
