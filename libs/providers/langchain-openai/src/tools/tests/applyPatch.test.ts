/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI Apply Patch Tool Tests", () => {
  it("applyPatch creates valid tool definitions", () => {
    const patch = tools.applyPatch({
      execute: async () => "done",
    });

    expect(patch.name).toBe("apply_patch");
    expect(patch.extras?.providerToolDefinition).toMatchObject({
      type: "apply_patch",
    });
  });

  it("applyPatch execute callback receives operation correctly", async () => {
    const operations: Array<{ type: string; path?: string; diff?: string }> =
      [];

    const patch = tools.applyPatch({
      execute: async (operation) => {
        operations.push(operation);
        return `Processed ${operation.path}`;
      },
    });

    // Directly call the execute function
    const createOp = {
      type: "create_file" as const,
      path: "test.txt",
      diff: "+hello world",
    };

    // Access the underlying execute function from the tool
    const executeFunc = patch.func;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await executeFunc(createOp as any);

    expect(operations).toHaveLength(1);
    expect(operations[0].type).toBe("create_file");
    expect(operations[0].path).toBe("test.txt");
    expect(result).toBe("Processed test.txt");
  });

  it("applyPatch handles all operation types", async () => {
    const operations: string[] = [];

    const patch = tools.applyPatch({
      execute: async (operation) => {
        operations.push(operation.type);
        return "ok";
      },
    });

    const executeFunc = patch.func;

    await executeFunc({
      type: "create_file",
      path: "a.txt",
      diff: "+a",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await executeFunc({
      type: "update_file",
      path: "b.txt",
      diff: "-x\n+y",
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await executeFunc({ type: "delete_file", path: "c.txt" } as any);

    expect(operations).toEqual(["create_file", "update_file", "delete_file"]);
  });
});
