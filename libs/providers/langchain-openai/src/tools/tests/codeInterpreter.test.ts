import { expect, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI Code Interpreter Tool Tests", () => {
  it("codeInterpreter creates a basic tool with default auto container", () => {
    expect(tools.codeInterpreter()).toMatchInlineSnapshot(`
      {
        "container": {
          "file_ids": undefined,
          "memory_limit": undefined,
          "type": "auto",
        },
        "type": "code_interpreter",
      }
    `);
  });

  it("codeInterpreter creates tool with explicit container ID", () => {
    expect(
      tools.codeInterpreter({
        container: "cntr_abc123",
      })
    ).toMatchInlineSnapshot(`
      {
        "container": "cntr_abc123",
        "type": "code_interpreter",
      }
    `);
  });

  it("codeInterpreter creates tool with memory limit", () => {
    expect(
      tools.codeInterpreter({
        container: { memoryLimit: "4g" },
      })
    ).toMatchInlineSnapshot(`
      {
        "container": {
          "file_ids": undefined,
          "memory_limit": "4g",
          "type": "auto",
        },
        "type": "code_interpreter",
      }
    `);
  });

  it("codeInterpreter creates tool with file IDs", () => {
    expect(
      tools.codeInterpreter({
        container: {
          fileIds: ["file-abc123", "file-def456"],
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "container": {
          "file_ids": [
            "file-abc123",
            "file-def456",
          ],
          "memory_limit": undefined,
          "type": "auto",
        },
        "type": "code_interpreter",
      }
    `);
  });

  it("codeInterpreter creates tool with all auto container options", () => {
    expect(
      tools.codeInterpreter({
        container: {
          memoryLimit: "16g",
          fileIds: ["file-abc123", "file-def456", "file-ghi789"],
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "container": {
          "file_ids": [
            "file-abc123",
            "file-def456",
            "file-ghi789",
          ],
          "memory_limit": "16g",
          "type": "auto",
        },
        "type": "code_interpreter",
      }
    `);
  });

  it("codeInterpreter supports all memory limit options", () => {
    const memoryLimits = ["1g", "4g", "16g", "64g"] as const;

    for (const memoryLimit of memoryLimits) {
      const tool = tools.codeInterpreter({
        container: { memoryLimit },
      });
      expect(tool.type).toBe("code_interpreter");
      expect(
        typeof tool.container === "object" && tool.container.memory_limit
      ).toBe(memoryLimit);
    }
  });
});
