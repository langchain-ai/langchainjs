import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  CopyFileTool,
  DeleteDirectoryTool,
  DeleteFileTool,
  FileSearchTool,
  ListDirectoryTool,
  MoveFileTool,
  ReadFileTool,
  WriteFileTool,
} from "../file_management/index.js";

describe("File Management Tools", () => {
  let tempDir: string;

  let copyTool: CopyFileTool;
  let deleteDirTool: DeleteDirectoryTool;
  let deleteTool: DeleteFileTool;
  let listTool: ListDirectoryTool;
  let moveTool: MoveFileTool;
  let readTool: ReadFileTool;
  let searchTool: FileSearchTool;
  let writeTool: WriteFileTool;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await mkdtemp(path.join(tmpdir(), "langchain-file-tools-test-"));

    // Initialize tools with the temp directory as root
    const rootDir = tempDir;

    copyTool = new CopyFileTool({ rootDir });
    deleteDirTool = new DeleteDirectoryTool({ rootDir }); // Add this
    deleteTool = new DeleteFileTool({ rootDir });
    listTool = new ListDirectoryTool({ rootDir });
    moveTool = new MoveFileTool({ rootDir });
    readTool = new ReadFileTool({ rootDir });
    searchTool = new FileSearchTool({ rootDir });
    writeTool = new WriteFileTool({ rootDir });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("CopyFileTool", () => {
    it("should copy a file successfully", async () => {
      // Create source file
      const sourceContent = "Source file content";
      await fs.writeFile(path.join(tempDir, "source.txt"), sourceContent);

      const result = await copyTool.invoke({
        source_path: "source.txt",
        destination_path: "copy.txt",
      });

      expect(result).toBe(
        "File copied successfully from source.txt to copy.txt."
      );

      // Verify both files exist with same content
      const sourceRead = await fs.readFile(
        path.join(tempDir, "source.txt"),
        "utf-8"
      );
      const copyRead = await fs.readFile(
        path.join(tempDir, "copy.txt"),
        "utf-8"
      );
      expect(sourceRead).toBe(sourceContent);
      expect(copyRead).toBe(sourceContent);
    });

    it("should handle non-existent source files", async () => {
      const result = await copyTool.invoke({
        source_path: "nonexistent.txt",
        destination_path: "copy.txt",
      });

      expect(result).toBe("Error: no such file or directory: nonexistent.txt");
    });
  });

  describe("DeleteDirectoryTool", () => {
    it("should delete an empty directory successfully", async () => {
      // Setup: Create an empty directory
      const dirPath = "empty_dir";
      await fs.mkdir(path.join(tempDir, dirPath));

      // Action
      const result = await deleteDirTool.invoke({ dir_path: dirPath });
      expect(result).toBe(`Directory deleted successfully: ${dirPath}.`);

      // Verify directory is gone
      try {
        await fs.access(path.join(tempDir, dirPath));
        fail("Directory should have been deleted");
      } catch (error) {
        // Expected - directory should not exist
      }
    });

    it("should fail to delete a non-empty directory by default", async () => {
      // Setup: Create a directory with a file in it
      const dirPath = "non_empty_dir";
      await fs.mkdir(path.join(tempDir, dirPath));
      await fs.writeFile(path.join(tempDir, dirPath, "file.txt"), "content");

      // Action
      const result = await deleteDirTool.invoke({ dir_path: dirPath });
      expect(result).toBe(
        `Error: Directory ${dirPath} is not empty. Use 'recursive: true' to delete it.`
      );

      // Verify directory still exists
      await fs.access(path.join(tempDir, dirPath));
    });

    it("should recursively delete a non-empty directory", async () => {
      // Setup: Create a directory with a file in it
      const dirPath = "non_empty_recursive_dir";
      await fs.mkdir(path.join(tempDir, dirPath));
      await fs.writeFile(path.join(tempDir, dirPath, "file.txt"), "content");

      // Action
      const result = await deleteDirTool.invoke({
        dir_path: dirPath,
        recursive: true,
      });
      expect(result).toBe(`Directory deleted successfully: ${dirPath}.`);

      // Verify directory is gone
      try {
        await fs.access(path.join(tempDir, dirPath));
        fail("Directory should have been deleted");
      } catch (error) {
        // Expected
      }
    });

    it("should return an error for a non-existent directory", async () => {
      const result = await deleteDirTool.invoke({
        dir_path: "nonexistent_dir",
      });
      expect(result).toBe("Error: no such directory: nonexistent_dir");
    });

    it("should return an error if the path is a file, not a directory", async () => {
      // Setup: Create a file
      const filePath = "just_a_file.txt";
      await fs.writeFile(path.join(tempDir, filePath), "content");

      // Action
      const result = await deleteDirTool.invoke({ dir_path: filePath });
      expect(result).toBe(`Error: ${filePath} is not a directory.`);
    });
  });

  describe("DeleteFileTool", () => {
    it("should delete a file successfully", async () => {
      // Create test file
      await fs.writeFile(path.join(tempDir, "delete_me.txt"), "Delete this");

      const result = await deleteTool.invoke({ file_path: "delete_me.txt" });
      expect(result).toBe("File deleted successfully: delete_me.txt.");

      // Verify file is gone
      try {
        await fs.access(path.join(tempDir, "delete_me.txt"));
        fail("File should have been deleted");
      } catch (error) {
        // Expected - file should not exist
      }
    });

    it("should handle non-existent files", async () => {
      const result = await deleteTool.invoke({ file_path: "nonexistent.txt" });
      expect(result).toBe("Error: no such file or directory: nonexistent.txt");
    });
  });

  describe("ListDirectoryTool", () => {
    it("should list directory contents", async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, "file1.txt"), "content1");
      await fs.writeFile(path.join(tempDir, "file2.txt"), "content2");
      await fs.mkdir(path.join(tempDir, "subdir"));

      const result = await listTool.invoke({ dir_path: "." });

      const entries = result.split("\n").sort();
      expect(entries).toEqual(["file1.txt", "file2.txt", "subdir"]);
    });

    it("should handle empty directories", async () => {
      const result = await listTool.invoke({ dir_path: "." });
      expect(result).toBe("No files found in directory .");
    });

    it("should handle non-existent directories", async () => {
      const result = await listTool.invoke({ dir_path: "nonexistent" });
      expect(result).toBe("Error: no such file or directory: nonexistent");
    });
  });

  describe("MoveFileTool", () => {
    it("should move a file successfully", async () => {
      // Create source file
      const content = "Move me";
      await fs.writeFile(path.join(tempDir, "move_source.txt"), content);

      const result = await moveTool.invoke({
        source_path: "move_source.txt",
        destination_path: "moved.txt",
      });

      expect(result).toBe(
        "File moved successfully from move_source.txt to moved.txt."
      );

      // Verify source is gone and destination exists
      try {
        await fs.access(path.join(tempDir, "move_source.txt"));
        fail("Source file should have been moved");
      } catch (error) {
        // Expected - source should not exist
      }

      const movedContent = await fs.readFile(
        path.join(tempDir, "moved.txt"),
        "utf-8"
      );
      expect(movedContent).toBe(content);
    });

    it("should handle non-existent source files", async () => {
      const result = await moveTool.invoke({
        source_path: "nonexistent.txt",
        destination_path: "moved.txt",
      });

      expect(result).toBe("Error: no such file or directory: nonexistent.txt");
    });
  });

  describe("ReadFileTool", () => {
    it("should read a file successfully", async () => {
      // Create a test file
      const testContent = "Test file content";
      await fs.writeFile(path.join(tempDir, "read_test.txt"), testContent);

      const result = await readTool.invoke({ file_path: "read_test.txt" });
      expect(result).toBe(testContent);
    });

    it("should handle non-existent files", async () => {
      const result = await readTool.invoke({ file_path: "nonexistent.txt" });
      expect(result).toBe("Error: no such file or directory: nonexistent.txt");
    });
  });

  describe("FileSearchTool", () => {
    it("should search for files with glob patterns", async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, "test1.txt"), "content");
      await fs.writeFile(path.join(tempDir, "test2.txt"), "content");
      await fs.writeFile(path.join(tempDir, "other.log"), "content");
      await fs.mkdir(path.join(tempDir, "subdir"));
      await fs.writeFile(path.join(tempDir, "subdir", "nested.txt"), "content");

      const result = await searchTool.invoke({
        dir_path: ".",
        pattern: "*.txt",
      });

      const matches = result.split("\n").sort();
      expect(matches).toEqual(["subdir/nested.txt", "test1.txt", "test2.txt"]);
    });

    it("should handle patterns with no matches", async () => {
      await fs.writeFile(path.join(tempDir, "test.txt"), "content");

      const result = await searchTool.invoke({
        dir_path: ".",
        pattern: "*.xyz",
      });

      expect(result).toBe("No files found for pattern *.xyz in directory .");
    });

    it("should handle non-existent directories", async () => {
      const result = await searchTool.invoke({
        dir_path: "nonexistent",
        pattern: "*",
      });

      expect(result).toBe("Error: no such file or directory: nonexistent");
    });
  });

  describe("WriteFileTool", () => {
    it("should write a file successfully", async () => {
      const result = await writeTool.invoke({
        file_path: "test.txt",
        text: "Hello, world!",
        append: false,
      });

      expect(result).toBe("File written successfully to test.txt.");

      // Verify file was created
      const content = await fs.readFile(
        path.join(tempDir, "test.txt"),
        "utf-8"
      );
      expect(content).toBe("Hello, world!");
    });

    it("should append to a file", async () => {
      // First write
      await writeTool.invoke({
        file_path: "append_test.txt",
        text: "First line",
        append: false,
      });

      // Then append
      const result = await writeTool.invoke({
        file_path: "append_test.txt",
        text: "\nSecond line",
        append: true,
      });

      expect(result).toBe("File written successfully to append_test.txt.");

      const content = await fs.readFile(
        path.join(tempDir, "append_test.txt"),
        "utf-8"
      );
      expect(content).toBe("First line\nSecond line");
    });

    it("should create parent directories", async () => {
      const result = await writeTool.invoke({
        file_path: "subdir/nested/file.txt",
        text: "Nested content",
        append: false,
      });

      expect(result).toBe(
        "File written successfully to subdir/nested/file.txt."
      );

      const content = await fs.readFile(
        path.join(tempDir, "subdir/nested/file.txt"),
        "utf-8"
      );
      expect(content).toBe("Nested content");
    });
  });

  describe("Security Tests", () => {
    it("should prevent directory traversal attacks", async () => {
      const result = await readTool.invoke({
        file_path: "../../../etc/passwd",
      });
      expect(result).toContain(
        "Error: Access denied to file_path: ../../../etc/passwd"
      );
    });

    it("should prevent absolute path access", async () => {
      const result = await readTool.invoke({ file_path: "/etc/passwd" });
      expect(result).toContain(
        "Error: Access denied to file_path: /etc/passwd"
      );
    });

    it("should allow relative paths within root directory", async () => {
      // Create subdirectory and file
      await fs.mkdir(path.join(tempDir, "subdir"));
      await fs.writeFile(
        path.join(tempDir, "subdir", "test.txt"),
        "safe content"
      );

      const result = await readTool.invoke({ file_path: "subdir/test.txt" });
      expect(result).toBe("safe content");
    });
  });

  describe("Tools without root directory restriction", () => {
    it("should work without root directory when no restriction is set", async () => {
      const unrestrictedWriteTool = new WriteFileTool();
      const testFile = path.join(tempDir, "unrestricted.txt");

      const result = await unrestrictedWriteTool.invoke({
        file_path: testFile,
        text: "unrestricted content",
        append: false,
      });

      expect(result).toBe(`File written successfully to ${testFile}.`);

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toBe("unrestricted content");
    });
  });
});
