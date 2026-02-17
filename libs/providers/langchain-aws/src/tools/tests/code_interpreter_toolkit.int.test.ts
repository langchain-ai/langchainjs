import { describe, test, expect, afterAll } from "vitest";
import {
  CodeInterpreterToolkit,
  createCodeInterpreterToolkit,
} from "../code_interpreter.js";

const REGION = process.env.BEDROCK_AWS_REGION ?? "us-west-2";

let toolkit: CodeInterpreterToolkit;

afterAll(async () => {
  if (toolkit) {
    await toolkit.cleanup();
  }
});

async function getToolkit(): Promise<CodeInterpreterToolkit> {
  if (!toolkit) {
    toolkit = await createCodeInterpreterToolkit({ region: REGION });
  }
  return toolkit;
}

function toolByName(tk: CodeInterpreterToolkit, name: string) {
  const t = tk.getToolsByName()[name];
  if (!t) {
    throw new Error(`Tool "${name}" not found in toolkit`);
  }
  return t;
}

const CONFIG = { configurable: { thread_id: "int-test" } };

describe("CodeInterpreterToolkit integration", () => {
  test("createCodeInterpreterToolkit returns toolkit with 8 tools", async () => {
    const tk = await getToolkit();
    const tools = tk.getTools();
    expect(tools).toHaveLength(8);

    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "delete_files",
      "execute_code",
      "execute_command",
      "install_packages",
      "list_files",
      "read_files",
      "upload_file",
      "write_files",
    ]);
  });

  test("execute_code: run simple Python code and get output", async () => {
    const tk = await getToolkit();
    const executeTool = toolByName(tk, "execute_code");

    const result = await executeTool.invoke(
      { code: "print(2 + 3)", language: "python", clear_context: false },
      CONFIG
    );

    expect(typeof result).toBe("string");
    expect(result).toContain("5");
  });

  test("execute_code: variables persist across calls in the same session", async () => {
    const tk = await getToolkit();
    const executeTool = toolByName(tk, "execute_code");

    await executeTool.invoke(
      { code: "my_var = 42", language: "python", clear_context: false },
      CONFIG
    );

    const result = await executeTool.invoke(
      { code: "print(my_var)", language: "python", clear_context: false },
      CONFIG
    );

    expect(result).toContain("42");
  });

  test("execute_command: run shell command", async () => {
    const tk = await getToolkit();
    const commandTool = toolByName(tk, "execute_command");

    const result = await commandTool.invoke(
      { command: "echo hello-world" },
      CONFIG
    );

    expect(typeof result).toBe("string");
    expect(result).toContain("hello-world");
  });

  test("write_files + read_files: round-trip file creation and reading", async () => {
    const tk = await getToolkit();
    const writeTool = toolByName(tk, "write_files");
    const readTool = toolByName(tk, "read_files");

    const fileContent = "col_a,col_b\n1,2\n3,4\n";
    await writeTool.invoke(
      { files: [{ path: "test_data.csv", content: fileContent }] },
      CONFIG
    );

    const readResult = await readTool.invoke(
      { paths: ["test_data.csv"] },
      CONFIG
    );

    expect(typeof readResult).toBe("string");
    expect(readResult).toContain("col_a");
    expect(readResult).toContain("3,4");
  });

  test("list_files: list working directory contents", async () => {
    const tk = await getToolkit();
    const listTool = toolByName(tk, "list_files");

    // The previously written file should be visible
    const result = await listTool.invoke({ directory_path: "" }, CONFIG);

    expect(typeof result).toBe("string");
    // We wrote test_data.csv earlier, it should appear
    expect(result).toContain("test_data.csv");
  });

  test("upload_file: upload a file with description", async () => {
    const tk = await getToolkit();
    const uploadTool = toolByName(tk, "upload_file");

    const result = await uploadTool.invoke(
      {
        path: "uploaded_notes.txt",
        content: "These are integration test notes.",
        description: "Plain text notes for testing",
      },
      CONFIG
    );

    expect(typeof result).toBe("string");

    // Verify the file exists by reading it back
    const readTool = toolByName(tk, "read_files");
    const readResult = await readTool.invoke(
      { paths: ["uploaded_notes.txt"] },
      CONFIG
    );
    expect(readResult).toContain("integration test notes");
  });

  test("upload_file: rejects absolute paths", async () => {
    const tk = await getToolkit();
    const uploadTool = toolByName(tk, "upload_file");

    await expect(
      uploadTool.invoke(
        { path: "/etc/hack.txt", content: "nope" },
        CONFIG
      )
    ).rejects.toThrow("Path must be relative");
  });

  test("delete_files: remove a file", async () => {
    const tk = await getToolkit();
    const writeTool = toolByName(tk, "write_files");
    const deleteTool = toolByName(tk, "delete_files");
    const listTool = toolByName(tk, "list_files");

    // Create a temporary file
    await writeTool.invoke(
      { files: [{ path: "to_delete.tmp", content: "delete me" }] },
      CONFIG
    );

    // Delete it
    const deleteResult = await deleteTool.invoke(
      { paths: ["to_delete.tmp"] },
      CONFIG
    );
    expect(typeof deleteResult).toBe("string");

    // Verify it no longer appears
    const listing = await listTool.invoke({ directory_path: "" }, CONFIG);
    expect(listing).not.toContain("to_delete.tmp");
  });

  test("install_packages: install a Python package", async () => {
    const tk = await getToolkit();
    const installTool = toolByName(tk, "install_packages");

    const result = await installTool.invoke(
      { packages: ["requests"], upgrade: false },
      CONFIG
    );

    expect(typeof result).toBe("string");
    // pip usually prints "Successfully installed" or "already satisfied"
    expect(
      result.toLowerCase().includes("successfully") ||
        result.toLowerCase().includes("already satisfied") ||
        result.toLowerCase().includes("requirement")
    ).toBe(true);
  });

  test("install_packages: rejects empty packages list", async () => {
    const tk = await getToolkit();
    const installTool = toolByName(tk, "install_packages");

    await expect(
      installTool.invoke({ packages: [] }, CONFIG)
    ).rejects.toThrow("At least one package name must be provided");
  });

  test("execute_code: use installed package", async () => {
    const tk = await getToolkit();
    const executeTool = toolByName(tk, "execute_code");

    const result = await executeTool.invoke(
      {
        code: "import requests; print(requests.__version__)",
        language: "python",
        clear_context: false,
      },
      CONFIG
    );

    expect(typeof result).toBe("string");
    // Should print a version string like "2.31.0"
    expect(result).toMatch(/\d+\.\d+/);
  });

  test("execute_code: clear_context resets state", async () => {
    const tk = await getToolkit();
    const executeTool = toolByName(tk, "execute_code");

    // Set a variable
    await executeTool.invoke(
      { code: "ephemeral_var = 999", language: "python", clear_context: false },
      CONFIG
    );

    // Clear context and try to access it — should error
    const result = await executeTool.invoke(
      {
        code: "try:\n    print(ephemeral_var)\nexcept NameError as e:\n    print(f'ERROR: {e}')",
        language: "python",
        clear_context: true,
      },
      CONFIG
    );

    expect(result).toContain("ERROR");
    expect(result).toContain("ephemeral_var");
  });

  test("thread isolation: separate thread_ids get independent sessions", async () => {
    const tk = await getToolkit();
    const executeTool = toolByName(tk, "execute_code");

    const configA = { configurable: { thread_id: "int-test-thread-a" } };
    const configB = { configurable: { thread_id: "int-test-thread-b" } };

    // Set variable in thread A
    await executeTool.invoke(
      { code: "isolated_val = 'thread-a'", language: "python" },
      configA
    );

    // Thread B should not see it
    const resultB = await executeTool.invoke(
      {
        code: "try:\n    print(isolated_val)\nexcept NameError as e:\n    print(f'NOT_FOUND: {e}')",
        language: "python",
      },
      configB
    );

    expect(resultB).toContain("NOT_FOUND");

    // Cleanup the extra threads
    await tk.cleanup("int-test-thread-a");
    await tk.cleanup("int-test-thread-b");
  });

  test("cleanup: per-thread cleanup works without error", async () => {
    const tk = await getToolkit();
    const executeTool = toolByName(tk, "execute_code");

    const threadConfig = {
      configurable: { thread_id: "int-test-cleanup" },
    };
    await executeTool.invoke(
      { code: "print('cleanup test')", language: "python" },
      threadConfig
    );

    // Should not throw
    await tk.cleanup("int-test-cleanup");
  });

  test("cleanup: cleaning non-existent thread does not throw", async () => {
    const tk = await getToolkit();
    // Should not throw
    await tk.cleanup("does-not-exist-thread");
  });
});
