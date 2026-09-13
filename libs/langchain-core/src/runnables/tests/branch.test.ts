import { describe, it, expect } from "vitest";
import { RunnableBranch } from "../branch.js";
import { RunnableLambda } from "../base.js";

describe("RunnableBranch", () => {
  it("executes the default branch when no condition matches", async () => {
    const branch = RunnableBranch.from([
      [(x: number) => x > 10, (x: number) => x * 2],
      [(x: number) => x > 5, (x: number) => x * 3],
      (x: number) => x,
    ]);

    const result = await branch.invoke(1);
    expect(result).toBe(1);
  });

  it("executes the first matching branch", async () => {
    const branch = RunnableBranch.from([
      [(x: number) => x > 5, (x: number) => `high:${x}`],
      [(x: number) => x > 0, (x: number) => `low:${x}`],
      (x: number) => `zero:${x}`,
    ]);

    const result = await branch.invoke(10);
    expect(result).toBe("high:10");
  });

  it("does NOT execute default when branch returns falsy 0", async () => {
    const branch = RunnableBranch.from([
      [(x: number) => x === 0, (x: number) => 0],
      (x: number) => -1,
    ]);

    const result = await branch.invoke(0);
    expect(result).toBe(0);
  });

  it("does NOT execute default when branch returns falsy false", async () => {
    const branch = RunnableBranch.from([
      [(x: boolean) => x === false, (x: boolean) => false],
      (x: boolean) => true,
    ]);

    const result = await branch.invoke(false);
    expect(result).toBe(false);
  });

  it("does NOT execute default when branch returns falsy empty string", async () => {
    const branch = RunnableBranch.from([
      [(x: string) => x === "", (x: string) => ""],
      (x: string) => "fallback",
    ]);

    const result = await branch.invoke("");
    expect(result).toBe("");
  });

  it("executes default when no condition matches (no falsy branch result)", async () => {
    const branch = RunnableBranch.from([
      [(x: number) => x > 100, (x: number) => x],
      (x: number) => -999,
    ]);

    const result = await branch.invoke(50);
    expect(result).toBe(-999);
  });

  it("works with RunnableLambda conditions", async () => {
    const branch = RunnableBranch.from([
      [
        new RunnableLambda({ func: (x: number) => x > 0 }),
        new RunnableLambda({ func: (x: number) => x * 2 }),
      ],
      new RunnableLambda({ func: (x: number) => x }),
    ]);

    const result = await branch.invoke(5);
    expect(result).toBe(10);
  });
});
