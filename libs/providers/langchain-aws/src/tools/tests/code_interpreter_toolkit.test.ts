import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CodeInterpreterToolkit,
  createCodeInterpreterToolkit,
  ExecuteCodeInputSchema,
  ExecuteCommandInputSchema,
  ReadFilesInputSchema,
  WriteFilesInputSchema,
  ListFilesInputSchema,
  DeleteFilesInputSchema,
  UploadFileInputSchema,
  InstallPackagesInputSchema,
} from "../code_interpreter.js";

// ---------------------------------------------------------------------------
// Mock the bedrock-agentcore CodeInterpreter
// ---------------------------------------------------------------------------

const mockStartSession = vi.fn().mockResolvedValue({
  sessionName: "default",
  sessionId: "mock-session-id",
  createdAt: new Date(),
});
const mockStopSession = vi.fn().mockResolvedValue(undefined);
const mockExecuteCode = vi.fn().mockResolvedValue("Hello World");
const mockExecuteCommand = vi.fn().mockResolvedValue("file1.txt\nfile2.txt");
const mockReadFiles = vi.fn().mockResolvedValue("file content here");
const mockWriteFiles = vi.fn().mockResolvedValue("Written: output.csv");
const mockListFiles = vi.fn().mockResolvedValue("file1.txt\ndir1/");
const mockRemoveFiles = vi.fn().mockResolvedValue("Removed: temp.txt");

vi.mock("bedrock-agentcore/code-interpreter", () => ({
  CodeInterpreter: vi.fn().mockImplementation(() => ({
    startSession: mockStartSession,
    stopSession: mockStopSession,
    executeCode: mockExecuteCode,
    executeCommand: mockExecuteCommand,
    readFiles: mockReadFiles,
    writeFiles: mockWriteFiles,
    listFiles: mockListFiles,
    removeFiles: mockRemoveFiles,
  })),
}));

// ---------------------------------------------------------------------------
// Zod Schema tests
// ---------------------------------------------------------------------------

describe("Zod Schemas", () => {
  describe("ExecuteCodeInputSchema", () => {
    it("should accept valid input with all fields", () => {
      const input = {
        code: "print('hello')",
        language: "python" as const,
        clear_context: true,
      };
      const result = ExecuteCodeInputSchema.parse(input);
      expect(result.code).toBe("print('hello')");
      expect(result.language).toBe("python");
      expect(result.clear_context).toBe(true);
    });

    it("should apply defaults for optional fields", () => {
      const input = { code: "print('hello')" };
      const result = ExecuteCodeInputSchema.parse(input);
      expect(result.language).toBe("python");
      expect(result.clear_context).toBe(false);
    });

    it("should accept javascript and typescript languages", () => {
      expect(
        ExecuteCodeInputSchema.parse({ code: "console.log(1)", language: "javascript" })
          .language
      ).toBe("javascript");
      expect(
        ExecuteCodeInputSchema.parse({ code: "console.log(1)", language: "typescript" })
          .language
      ).toBe("typescript");
    });

    it("should reject invalid language", () => {
      expect(() =>
        ExecuteCodeInputSchema.parse({ code: "x", language: "ruby" })
      ).toThrow();
    });
  });

  describe("ExecuteCommandInputSchema", () => {
    it("should accept valid command", () => {
      const result = ExecuteCommandInputSchema.parse({ command: "ls -la" });
      expect(result.command).toBe("ls -la");
    });
  });

  describe("ReadFilesInputSchema", () => {
    it("should accept array of paths", () => {
      const result = ReadFilesInputSchema.parse({
        paths: ["data.csv", "output.json"],
      });
      expect(result.paths).toEqual(["data.csv", "output.json"]);
    });

    it("should reject empty object", () => {
      expect(() => ReadFilesInputSchema.parse({})).toThrow();
    });
  });

  describe("WriteFilesInputSchema", () => {
    it("should accept valid files array", () => {
      const result = WriteFilesInputSchema.parse({
        files: [
          { path: "test.txt", content: "hello" },
          { path: "dir/file.py", content: "print(1)" },
        ],
      });
      expect(result.files).toHaveLength(2);
      expect(result.files[0].path).toBe("test.txt");
    });
  });

  describe("ListFilesInputSchema", () => {
    it("should apply default empty string for directory_path", () => {
      const result = ListFilesInputSchema.parse({});
      expect(result.directory_path).toBe("");
    });

    it("should accept custom directory_path", () => {
      const result = ListFilesInputSchema.parse({ directory_path: "/tmp" });
      expect(result.directory_path).toBe("/tmp");
    });
  });

  describe("DeleteFilesInputSchema", () => {
    it("should accept array of paths", () => {
      const result = DeleteFilesInputSchema.parse({
        paths: ["temp.txt", "cache.json"],
      });
      expect(result.paths).toEqual(["temp.txt", "cache.json"]);
    });
  });

  describe("UploadFileInputSchema", () => {
    it("should accept valid input with description", () => {
      const result = UploadFileInputSchema.parse({
        path: "data.csv",
        content: "a,b\n1,2",
        description: "CSV with columns a and b",
      });
      expect(result.path).toBe("data.csv");
      expect(result.description).toBe("CSV with columns a and b");
    });

    it("should default description to empty string", () => {
      const result = UploadFileInputSchema.parse({
        path: "data.csv",
        content: "a,b",
      });
      expect(result.description).toBe("");
    });
  });

  describe("InstallPackagesInputSchema", () => {
    it("should accept packages with upgrade flag", () => {
      const result = InstallPackagesInputSchema.parse({
        packages: ["pandas", "numpy"],
        upgrade: true,
      });
      expect(result.packages).toEqual(["pandas", "numpy"]);
      expect(result.upgrade).toBe(true);
    });

    it("should default upgrade to false", () => {
      const result = InstallPackagesInputSchema.parse({
        packages: ["pandas"],
      });
      expect(result.upgrade).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// CodeInterpreterToolkit tests
// ---------------------------------------------------------------------------

describe("CodeInterpreterToolkit", () => {
  let toolkit: CodeInterpreterToolkit;

  beforeEach(() => {
    vi.clearAllMocks();
    toolkit = new CodeInterpreterToolkit({ region: "us-east-1" });
  });

  afterEach(async () => {
    await toolkit.cleanup();
  });

  describe("constructor", () => {
    it("should set the region", () => {
      expect(toolkit.region).toBe("us-east-1");
    });

    it("should default region to us-west-2", () => {
      const defaultToolkit = new CodeInterpreterToolkit();
      expect(defaultToolkit.region).toBe("us-west-2");
    });
  });

  describe("setup", () => {
    it("should create all expected tools", async () => {
      const tools = await toolkit.setup();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain("execute_code");
      expect(toolNames).toContain("execute_command");
      expect(toolNames).toContain("read_files");
      expect(toolNames).toContain("list_files");
      expect(toolNames).toContain("delete_files");
      expect(toolNames).toContain("write_files");
      expect(toolNames).toContain("upload_file");
      expect(toolNames).toContain("install_packages");
      expect(tools).toHaveLength(8);
    });

    it("should be idempotent", async () => {
      const tools1 = await toolkit.setup();
      const tools2 = await toolkit.setup();
      expect(tools1).toBe(tools2);
    });

    it("should populate the tools property", async () => {
      expect(toolkit.tools).toHaveLength(0);
      await toolkit.setup();
      expect(toolkit.tools).toHaveLength(8);
    });
  });

  describe("getTools", () => {
    it("should return tools after setup", async () => {
      await toolkit.setup();
      const tools = toolkit.getTools();
      expect(tools).toHaveLength(8);
    });
  });

  describe("getToolsByName", () => {
    it("should return a name-to-tool mapping", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      expect(toolMap).toHaveProperty("execute_code");
      expect(toolMap).toHaveProperty("execute_command");
      expect(toolMap).toHaveProperty("read_files");
      expect(toolMap.execute_code.name).toBe("execute_code");
    });
  });

  describe("tool descriptions", () => {
    it("each tool should have a non-empty description", async () => {
      await toolkit.setup();
      for (const t of toolkit.tools) {
        expect(t.description).toBeTruthy();
        expect(t.description.length).toBeGreaterThan(10);
      }
    });
  });

  describe("execute_code tool", () => {
    it("should call CodeInterpreter.executeCode with correct params", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      const executeCode = toolMap["execute_code"];

      const config = { configurable: { thread_id: "test-thread" } };
      await executeCode.invoke(
        { code: "print('hi')", language: "python", clear_context: false },
        config
      );

      expect(mockStartSession).toHaveBeenCalledTimes(1);
      expect(mockExecuteCode).toHaveBeenCalledWith({
        code: "print('hi')",
        language: "python",
        clearContext: false,
      });
    });

    it("should return the execution result", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      const result = await toolMap["execute_code"].invoke(
        { code: "1+1" },
        { configurable: { thread_id: "t1" } }
      );
      expect(result).toBe("Hello World");
    });
  });

  describe("execute_command tool", () => {
    it("should call CodeInterpreter.executeCommand", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      await toolMap["execute_command"].invoke(
        { command: "ls -la" },
        { configurable: { thread_id: "t1" } }
      );

      expect(mockExecuteCommand).toHaveBeenCalledWith({ command: "ls -la" });
    });
  });

  describe("read_files tool", () => {
    it("should call CodeInterpreter.readFiles", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      await toolMap["read_files"].invoke(
        { paths: ["data.csv"] },
        { configurable: { thread_id: "t1" } }
      );

      expect(mockReadFiles).toHaveBeenCalledWith({ paths: ["data.csv"] });
    });
  });

  describe("list_files tool", () => {
    it("should call CodeInterpreter.listFiles with path", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      await toolMap["list_files"].invoke(
        { directory_path: "/tmp" },
        { configurable: { thread_id: "t1" } }
      );

      expect(mockListFiles).toHaveBeenCalledWith({ path: "/tmp" });
    });

    it("should handle empty directory_path", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      await toolMap["list_files"].invoke(
        {},
        { configurable: { thread_id: "t1" } }
      );

      expect(mockListFiles).toHaveBeenCalledWith({ path: undefined });
    });
  });

  describe("delete_files tool", () => {
    it("should call CodeInterpreter.removeFiles", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      await toolMap["delete_files"].invoke(
        { paths: ["temp.txt"] },
        { configurable: { thread_id: "t1" } }
      );

      expect(mockRemoveFiles).toHaveBeenCalledWith({ paths: ["temp.txt"] });
    });
  });

  describe("write_files tool", () => {
    it("should call CodeInterpreter.writeFiles", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      const files = [{ path: "out.txt", content: "hello" }];
      await toolMap["write_files"].invoke(
        { files },
        { configurable: { thread_id: "t1" } }
      );

      expect(mockWriteFiles).toHaveBeenCalledWith({ files });
    });
  });

  describe("upload_file tool", () => {
    it("should call writeFiles under the hood", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      await toolMap["upload_file"].invoke(
        { path: "data.csv", content: "a,b\n1,2", description: "test csv" },
        { configurable: { thread_id: "t1" } }
      );

      expect(mockWriteFiles).toHaveBeenCalledWith({
        files: [{ path: "data.csv", content: "a,b\n1,2" }],
      });
    });

    it("should reject absolute paths", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      await expect(
        toolMap["upload_file"].invoke(
          { path: "/etc/passwd", content: "x" },
          { configurable: { thread_id: "t1" } }
        )
      ).rejects.toThrow("Path must be relative");
    });
  });

  describe("install_packages tool", () => {
    it("should call executeCommand with pip install", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      await toolMap["install_packages"].invoke(
        { packages: ["pandas", "numpy"] },
        { configurable: { thread_id: "t1" } }
      );

      expect(mockExecuteCommand).toHaveBeenCalledWith({
        command: "pip install pandas numpy",
      });
    });

    it("should add --upgrade flag when upgrade is true", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      await toolMap["install_packages"].invoke(
        { packages: ["tensorflow"], upgrade: true },
        { configurable: { thread_id: "t1" } }
      );

      expect(mockExecuteCommand).toHaveBeenCalledWith({
        command: "pip install --upgrade tensorflow",
      });
    });

    it("should reject empty packages list", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      await expect(
        toolMap["install_packages"].invoke(
          { packages: [] },
          { configurable: { thread_id: "t1" } }
        )
      ).rejects.toThrow("At least one package name must be provided");
    });
  });

  describe("thread management", () => {
    it("should reuse interpreter for same thread_id", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      const config = { configurable: { thread_id: "shared-thread" } };

      await toolMap["execute_code"].invoke({ code: "x = 1" }, config);
      await toolMap["execute_code"].invoke({ code: "x + 1" }, config);

      // startSession should only be called once for the same thread
      expect(mockStartSession).toHaveBeenCalledTimes(1);
    });

    it("should create different interpreters for different thread_ids", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();

      await toolMap["execute_code"].invoke(
        { code: "x = 1" },
        { configurable: { thread_id: "thread-a" } }
      );
      await toolMap["execute_code"].invoke(
        { code: "x = 2" },
        { configurable: { thread_id: "thread-b" } }
      );

      expect(mockStartSession).toHaveBeenCalledTimes(2);
    });

    it("should use 'default' thread when no config provided", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();

      await toolMap["execute_code"].invoke({ code: "1" });
      await toolMap["execute_command"].invoke({ command: "ls" });

      // Same default thread, so only one session
      expect(mockStartSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanup", () => {
    it("should stop all sessions when no threadId given", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();

      await toolMap["execute_code"].invoke(
        { code: "1" },
        { configurable: { thread_id: "t1" } }
      );
      await toolMap["execute_code"].invoke(
        { code: "2" },
        { configurable: { thread_id: "t2" } }
      );

      await toolkit.cleanup();

      expect(mockStopSession).toHaveBeenCalledTimes(2);
    });

    it("should stop only the specified thread session", async () => {
      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();

      await toolMap["execute_code"].invoke(
        { code: "1" },
        { configurable: { thread_id: "t1" } }
      );
      await toolMap["execute_code"].invoke(
        { code: "2" },
        { configurable: { thread_id: "t2" } }
      );

      await toolkit.cleanup("t1");

      expect(mockStopSession).toHaveBeenCalledTimes(1);
    });

    it("should gracefully handle cleanup of non-existent thread", async () => {
      await toolkit.setup();
      // Should not throw
      await toolkit.cleanup("non-existent");
      expect(mockStopSession).not.toHaveBeenCalled();
    });

    it("should handle stop errors gracefully", async () => {
      mockStopSession.mockRejectedValueOnce(new Error("stop failed"));

      await toolkit.setup();
      const toolMap = toolkit.getToolsByName();
      await toolMap["execute_code"].invoke(
        { code: "1" },
        { configurable: { thread_id: "t-err" } }
      );

      // Should not throw
      await toolkit.cleanup();
    });
  });
});

// ---------------------------------------------------------------------------
// createCodeInterpreterToolkit factory
// ---------------------------------------------------------------------------

describe("createCodeInterpreterToolkit", () => {
  it("should return the toolkit with tools populated", async () => {
    const toolkit = await createCodeInterpreterToolkit({
      region: "us-west-2",
    });

    expect(toolkit).toBeInstanceOf(CodeInterpreterToolkit);
    expect(toolkit.getTools()).toHaveLength(8);

    await toolkit.cleanup();
  });

  it("should use default config when none provided", async () => {
    const toolkit = await createCodeInterpreterToolkit();

    expect(toolkit.region).toBe("us-west-2");
    expect(toolkit.getTools()).toHaveLength(8);

    await toolkit.cleanup();
  });
});
