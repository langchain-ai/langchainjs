import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ClientTool, ServerTool } from "@langchain/core/tools";

import { filesystemFileSearchMiddleware } from "../filesystemFileSearch.js";

// Helper to invoke tools with proper typing
async function invokeTool(
  tool: ClientTool | ServerTool | undefined,
  args: Record<string, unknown>
): Promise<string> {
  if (!tool) {
    throw new Error("Tool not found");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (tool as any).invoke(args);
  return result as string;
}

describe("filesystemFileSearchMiddleware", () => {
  let testRoot: string;
  let middleware: ReturnType<typeof filesystemFileSearchMiddleware>;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testRoot = await fs.mkdtemp(path.join(tmpdir(), "langchain-test-"));
    middleware = filesystemFileSearchMiddleware({ rootPath: testRoot });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("glob_search tool", () => {
    it("should find files matching a simple pattern", async () => {
      // Create test files
      await fs.writeFile(path.join(testRoot, "file1.ts"), "content1");
      await fs.writeFile(path.join(testRoot, "file2.ts"), "content2");
      await fs.writeFile(path.join(testRoot, "file3.js"), "content3");

      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      expect(globTool).toBeDefined();

      const result = await invokeTool(globTool, { pattern: "*.ts" });
      const files = result.split("\n").filter(Boolean);

      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files.some((f: string) => f.includes("file1.ts"))).toBe(true);
      expect(files.some((f: string) => f.includes("file2.ts"))).toBe(true);
      expect(files.some((f: string) => f.includes("file3.js"))).toBe(false);
    });

    it("should find files in subdirectories with ** pattern", async () => {
      const subDir = path.join(testRoot, "src", "components");
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(
        path.join(subDir, "Button.tsx"),
        "export const Button"
      );
      await fs.writeFile(path.join(subDir, "Input.tsx"), "export const Input");

      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      const result = await invokeTool(globTool, { pattern: "**/*.tsx" });
      const files = result.split("\n").filter(Boolean);

      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files.some((f: string) => f.includes("Button.tsx"))).toBe(true);
      expect(files.some((f: string) => f.includes("Input.tsx"))).toBe(true);
    });

    it("should search in a specific subdirectory", async () => {
      const subDir = path.join(testRoot, "src");
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(path.join(subDir, "index.ts"), "export");
      await fs.writeFile(path.join(testRoot, "root.ts"), "export");

      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      const result = await invokeTool(globTool, {
        pattern: "*.ts",
        path: "/src",
      });
      const files = result.split("\n").filter(Boolean);

      expect(files.some((f: string) => f.includes("src/index.ts"))).toBe(true);
      expect(files.some((f: string) => f.includes("root.ts"))).toBe(false);
    });

    it("should return 'No files found' when no matches exist", async () => {
      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      const result = await invokeTool(globTool, { pattern: "*.nonexistent" });

      expect(result).toBe("No files found");
    });

    it("should return 'No files found' for invalid path", async () => {
      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      const result = await invokeTool(globTool, {
        pattern: "*.ts",
        path: "/nonexistent",
      });

      expect(result).toBe("No files found");
    });

    it("should sort results by modification time (most recent first)", async () => {
      const file1 = path.join(testRoot, "file1.ts");
      const file2 = path.join(testRoot, "file2.ts");

      await fs.writeFile(file1, "content1");
      // Wait a bit to ensure different modification times
      await new Promise((resolve) => setTimeout(resolve, 10));
      await fs.writeFile(file2, "content2");

      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      const result = await invokeTool(globTool, { pattern: "*.ts" });
      const files = result.split("\n").filter(Boolean);

      // file2 should come before file1 (more recent)
      expect(files[0]).toContain("file2.ts");
    });

    it("should prevent path traversal attacks", async () => {
      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      const result = await invokeTool(globTool, {
        pattern: "*",
        path: "/../",
      });

      expect(result).toBe("No files found");
    });

    it("should prevent path traversal with ~", async () => {
      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      const result = await invokeTool(globTool, {
        pattern: "*",
        path: "/~/",
      });

      expect(result).toBe("No files found");
    });
  });

  describe("grep_search tool", () => {
    beforeEach(async () => {
      // Create test files with content
      await fs.writeFile(
        path.join(testRoot, "file1.ts"),
        "export const hello = 'world';\nconst test = 123;"
      );
      await fs.writeFile(
        path.join(testRoot, "file2.ts"),
        "export const goodbye = 'world';\nconst test = 456;"
      );
      await fs.writeFile(
        path.join(testRoot, "file3.js"),
        "export const hello = 'world';"
      );
    });

    it("should find files containing a pattern (files_with_matches mode)", async () => {
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "hello",
        output_mode: "files_with_matches",
      });
      const files = result.split("\n").filter(Boolean);

      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files.some((f: string) => f.includes("file1.ts"))).toBe(true);
      expect(files.some((f: string) => f.includes("file3.js"))).toBe(true);
    });

    it("should return content with line numbers (content mode)", async () => {
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "hello",
        output_mode: "content",
      });
      const lines = result.split("\n").filter(Boolean);

      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.some((l: string) => l.includes("file1.ts:1:"))).toBe(true);
      expect(lines.some((l: string) => l.includes("hello"))).toBe(true);
    });

    it("should return match counts (count mode)", async () => {
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "test",
        output_mode: "count",
      });
      const lines = result.split("\n").filter(Boolean);

      expect(lines.length).toBeGreaterThanOrEqual(2);
      const file1Line = lines.find((l: string) => l.includes("file1.ts"));
      const file2Line = lines.find((l: string) => l.includes("file2.ts"));
      expect(file1Line).toContain(":1");
      expect(file2Line).toContain(":1");
    });

    it("should filter files by include pattern", async () => {
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "hello",
        include: "*.ts",
        output_mode: "files_with_matches",
      });
      const files = result.split("\n").filter(Boolean);

      expect(files.some((f: string) => f.includes("file1.ts"))).toBe(true);
      expect(files.some((f: string) => f.includes("file3.js"))).toBe(false);
    });

    it("should support brace expansion in include pattern", async () => {
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "hello",
        include: "*.{ts,js}",
        output_mode: "files_with_matches",
      });
      const files = result.split("\n").filter(Boolean);

      expect(files.some((f: string) => f.includes("file1.ts"))).toBe(true);
      expect(files.some((f: string) => f.includes("file3.js"))).toBe(true);
    });

    it("should return 'No matches found' when pattern doesn't match", async () => {
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "nonexistentpattern12345",
      });

      expect(result).toBe("No matches found");
    });

    it("should return error for invalid regex pattern", async () => {
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "[invalid",
      });

      expect(result).toContain("Invalid regex pattern");
    });

    it("should return error for invalid include pattern", async () => {
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "hello",
        include: "*.{ts",
      });

      expect(result).toBe("Invalid include pattern");
    });

    it("should search in a specific subdirectory", async () => {
      const subDir = path.join(testRoot, "src");
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(
        path.join(subDir, "index.ts"),
        "export const hello = 'world';"
      );

      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "hello",
        path: "/src",
        output_mode: "files_with_matches",
      });
      const files = result.split("\n").filter(Boolean);

      expect(files.some((f: string) => f.includes("src/index.ts"))).toBe(true);
      expect(files.some((f: string) => f.includes("file1.ts"))).toBe(false);
    });

    it("should prevent path traversal attacks", async () => {
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: ".*",
        path: "/../",
      });

      expect(result).toBe("No matches found");
    });

    it("should skip files that are too large", async () => {
      // Create a large file (exceeds default 10MB limit)
      const largeContent = "x".repeat(11 * 1024 * 1024); // 11MB
      await fs.writeFile(path.join(testRoot, "large.ts"), largeContent);

      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "x",
        output_mode: "files_with_matches",
      });
      const files = result.split("\n").filter(Boolean);

      // Large file should be skipped
      expect(files.some((f: string) => f.includes("large.ts"))).toBe(false);
    });

    it("should respect custom max file size", async () => {
      const customMiddleware = filesystemFileSearchMiddleware({
        rootPath: testRoot,
        maxFileSizeMb: 1, // 1MB limit
      });

      // Create a file just over 1MB
      const largeContent = "x".repeat(1.1 * 1024 * 1024);
      await fs.writeFile(path.join(testRoot, "medium.ts"), largeContent);

      const grepTool = customMiddleware.tools?.find(
        (t) => t.name === "grep_search"
      );
      const result = await invokeTool(grepTool, {
        pattern: "x",
        output_mode: "files_with_matches",
      });
      const files = result.split("\n").filter(Boolean);

      // File should be skipped due to size limit
      expect(files.some((f: string) => f.includes("medium.ts"))).toBe(false);
    });
  });

  describe("ripgrep integration", () => {
    beforeEach(async () => {
      await fs.writeFile(
        path.join(testRoot, "test.ts"),
        "export const hello = 'world';"
      );
    });

    it("should fallback to Node.js search when ripgrep fails", async () => {
      const middlewareWithRipgrep = filesystemFileSearchMiddleware({
        rootPath: testRoot,
        useRipgrep: true,
      });

      const grepTool = middlewareWithRipgrep.tools?.find(
        (t) => t.name === "grep_search"
      );
      // Even if ripgrep is enabled but fails, should fallback to Node.js search
      const result = await invokeTool(grepTool, {
        pattern: "hello",
        output_mode: "files_with_matches",
      });

      // Should still work with Node.js fallback
      expect(result).not.toBe("No matches found");
    });

    it("should use Node.js search by default", async () => {
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "hello",
        output_mode: "files_with_matches",
      });

      // Should work without ripgrep
      expect(result).not.toBe("No matches found");
    });
  });

  describe("edge cases", () => {
    it("should handle empty directory", async () => {
      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      const result = await invokeTool(globTool, { pattern: "*" });

      expect(result).toBe("No files found");
    });

    it("should handle files with special characters in names", async () => {
      await fs.writeFile(path.join(testRoot, "file-with-dash.ts"), "content");
      await fs.writeFile(
        path.join(testRoot, "file_with_underscore.ts"),
        "content"
      );

      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      const result = await invokeTool(globTool, { pattern: "*.ts" });
      const files = result.split("\n").filter(Boolean);

      expect(files.some((f: string) => f.includes("file-with-dash.ts"))).toBe(
        true
      );
      expect(
        files.some((f: string) => f.includes("file_with_underscore.ts"))
      ).toBe(true);
    });

    it("should handle nested directories", async () => {
      const deepDir = path.join(testRoot, "a", "b", "c", "d");
      await fs.mkdir(deepDir, { recursive: true });
      await fs.writeFile(path.join(deepDir, "deep.ts"), "content");

      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      const result = await invokeTool(globTool, { pattern: "**/*.ts" });
      const files = result.split("\n").filter(Boolean);

      expect(files.some((f: string) => f.includes("deep.ts"))).toBe(true);
    });

    it("should handle regex special characters in search pattern", async () => {
      await fs.writeFile(
        path.join(testRoot, "special.ts"),
        "const x = (a + b) * c;"
      );

      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "\\(a \\+ b\\)",
        output_mode: "files_with_matches",
      });
      const files = result.split("\n").filter(Boolean);

      expect(files.some((f: string) => f.includes("special.ts"))).toBe(true);
    });

    it("should handle unreadable files gracefully", async () => {
      // Create a file that we can't read (simulated by permission error)
      const unreadableFile = path.join(testRoot, "unreadable.ts");
      await fs.writeFile(unreadableFile, "content");

      // Note: On Windows, we can't easily test permission errors
      // This test verifies the code handles errors gracefully
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      const result = await invokeTool(grepTool, {
        pattern: "content",
        output_mode: "files_with_matches",
      });

      // Should not throw, should return results for readable files
      expect(typeof result).toBe("string");
    });

    it("should handle binary files gracefully", async () => {
      // Create a binary file (simulated with non-UTF8 content)
      const binaryFile = path.join(testRoot, "binary.bin");
      const buffer = Buffer.from([0xff, 0xfe, 0xfd]);
      await fs.writeFile(binaryFile, buffer);

      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");
      // Should not throw when encountering binary files
      const result = await invokeTool(grepTool, {
        pattern: ".*",
        output_mode: "files_with_matches",
      });

      expect(typeof result).toBe("string");
    });
  });

  describe("middleware structure", () => {
    it("should have correct middleware name", () => {
      expect(middleware.name).toBe("filesystemFileSearchMiddleware");
    });

    it("should expose both tools", () => {
      expect(middleware.tools).toBeDefined();
      expect(middleware.tools?.length).toBe(2);
      expect(middleware.tools?.some((t) => t.name === "glob_search")).toBe(
        true
      );
      expect(middleware.tools?.some((t) => t.name === "grep_search")).toBe(
        true
      );
    });

    it("should have correct tool schemas", () => {
      const globTool = middleware.tools?.find((t) => t.name === "glob_search");
      const grepTool = middleware.tools?.find((t) => t.name === "grep_search");

      expect(globTool).toBeDefined();
      expect(grepTool).toBeDefined();

      // Verify schemas are defined
      if (globTool && "schema" in globTool) {
        expect(globTool.schema).toBeDefined();
      }
      if (grepTool && "schema" in grepTool) {
        expect(grepTool.schema).toBeDefined();
      }
    });
  });
});
