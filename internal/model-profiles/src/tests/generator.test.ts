import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateModelProfiles } from "../generator.js";
import type { ProviderMap } from "../api-schema.js";
import { findMonorepoRoot } from "../path-utils.js";

// Mock prettier
vi.mock("prettier", () => ({
  default: {
    resolveConfig: vi.fn().mockResolvedValue({}),
    format: vi.fn((code: string) => Promise.resolve(code)),
  },
}));

/**
 * Helper function to create a mock model for testing.
 */
function createMockModel(
  overrides: Partial<ProviderMap[string]["models"][string]> = {}
): ProviderMap[string]["models"][string] {
  return {
    id: "test-model",
    name: "test-model",
    attachment: false,
    reasoning: false,
    tool_call: false,
    structured_output: false,
    release_date: "2024-01-01",
    last_updated: "2024-01-01",
    modalities: {
      input: ["text"],
      output: ["text"],
    },
    open_weights: false,
    limit: {
      context: 8192,
      output: 4096,
    },
    ...overrides,
  };
}

/**
 * Helper function to create a mock provider for testing.
 */
function createMockProvider(
  providerId: string,
  models: Record<string, ProviderMap[string]["models"][string]>
): ProviderMap[string] {
  return {
    id: providerId,
    name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
    npm: `@langchain/${providerId}`,
    api: `https://api.${providerId}.com`,
    doc: `https://${providerId}.com/docs/models`,
    env: [`${providerId.toUpperCase()}_API_KEY`],
    models,
  };
}

describe("generator", () => {
  let tempDir: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    // Create temp directory within the monorepo to satisfy path validation
    const monorepoRoot = findMonorepoRoot();
    const testTempDir = path.join(monorepoRoot, ".test-temp");
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }
    tempDir = fs.mkdtempSync(path.join(testTempDir, "model-profiles-test-"));
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("generateModelProfiles", () => {
    it("should generate TypeScript file with model profiles", async () => {
      const mockProviderData: ProviderMap = {
        openai: createMockProvider("openai", {
          "gpt-4": createMockModel({
            id: "gpt-4",
            name: "gpt-4",
            tool_call: true,
            release_date: "2023-03-01",
          }),
          "gpt-3.5-turbo": createMockModel({
            id: "gpt-3.5-turbo",
            name: "gpt-3.5-turbo",
            tool_call: true,
            release_date: "2022-11-01",
            limit: {
              context: 4096,
              output: 2048,
            },
          }),
        }),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviderData,
      });

      const outputPath = path.join(tempDir, "models.ts");

      await generateModelProfiles("openai", {}, {}, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);
      const content = fs.readFileSync(outputPath, "utf-8");

      // Check for import statement
      expect(content).toContain("import type { ModelProfile }");
      expect(content).toContain("@langchain/core/language_models/profile");

      // Check for models variable
      expect(content).toContain("const PROFILES");

      // Check for model entries
      expect(content).toContain('"gpt-4"');
      expect(content).toContain('"gpt-3.5-turbo"');

      // Check for export
      expect(content).toContain("export default PROFILES");
    });

    it("should apply provider-level overrides", async () => {
      const mockProviderData: ProviderMap = {
        openai: createMockProvider("openai", {
          "gpt-4": createMockModel({
            id: "gpt-4",
            name: "gpt-4",
          }),
        }),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviderData,
      });

      const outputPath = path.join(tempDir, "models.ts");

      await generateModelProfiles(
        "openai",
        { toolCalling: true }, // Provider override
        {},
        outputPath
      );

      const content = fs.readFileSync(outputPath, "utf-8");

      // Should have toolCalling: true from provider override
      expect(content).toContain("toolCalling: true");
    });

    it("should apply model-specific overrides", async () => {
      const mockProviderData: ProviderMap = {
        openai: createMockProvider("openai", {
          "gpt-4": createMockModel({
            id: "gpt-4",
            name: "gpt-4",
          }),
        }),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviderData,
      });

      const outputPath = path.join(tempDir, "models.ts");

      await generateModelProfiles(
        "openai",
        {},
        { "gpt-4": { maxOutputTokens: 8192 } }, // Model-specific override
        outputPath
      );

      const content = fs.readFileSync(outputPath, "utf-8");

      // Should have maxOutputTokens: 8192 from model override
      expect(content).toContain("maxOutputTokens: 8192");
    });

    it("should apply both provider and model-specific overrides", async () => {
      const mockProviderData: ProviderMap = {
        openai: createMockProvider("openai", {
          "gpt-4": createMockModel({
            id: "gpt-4",
            name: "gpt-4",
          }),
        }),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviderData,
      });

      const outputPath = path.join(tempDir, "models.ts");

      await generateModelProfiles(
        "openai",
        { toolCalling: true }, // Provider override
        { "gpt-4": { maxOutputTokens: 8192 } }, // Model override
        outputPath
      );

      const content = fs.readFileSync(outputPath, "utf-8");

      // Should have both overrides applied
      expect(content).toContain("toolCalling: true");
      expect(content).toContain("maxOutputTokens: 8192");
    });

    it("should handle image inputs", async () => {
      const mockProviderData: ProviderMap = {
        openai: createMockProvider("openai", {
          "gpt-4-vision": createMockModel({
            id: "gpt-4-vision",
            name: "gpt-4-vision",
            release_date: "2023-11-01",
            modalities: {
              input: ["text", "image"],
              output: ["text"],
            },
          }),
        }),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviderData,
      });

      const outputPath = path.join(tempDir, "models.ts");

      await generateModelProfiles("openai", {}, {}, outputPath);

      const content = fs.readFileSync(outputPath, "utf-8");

      // Should have imageInputs: true
      expect(content).toContain("imageInputs: true");
    });

    it("should create output directory if it doesn't exist", async () => {
      const mockProviderData: ProviderMap = {
        openai: createMockProvider("openai", {
          "gpt-4": createMockModel({
            id: "gpt-4",
            name: "gpt-4",
          }),
        }),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviderData,
      });

      const outputDir = path.join(tempDir, "nested", "dir");
      const outputPath = path.join(outputDir, "models.ts");

      await generateModelProfiles("openai", {}, {}, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it("should throw error if provider not found", async () => {
      const mockProviderData: ProviderMap = {
        openai: createMockProvider("openai", {}),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviderData,
      });

      const outputPath = path.join(tempDir, "models.ts");

      await expect(
        generateModelProfiles("nonexistent", {}, {}, outputPath)
      ).rejects.toThrow('Provider "nonexistent" not found');
    });

    it("should throw error if API fetch fails", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Not Found",
      });

      const outputPath = path.join(tempDir, "models.ts");

      await expect(
        generateModelProfiles("openai", {}, {}, outputPath)
      ).rejects.toThrow("Failed to fetch models.dev API");
    });

    it("should format output with Prettier", async () => {
      const prettier = await import("prettier");
      const mockProviderData: ProviderMap = {
        openai: createMockProvider("openai", {
          "gpt-4": createMockModel({
            id: "gpt-4",
            name: "gpt-4",
          }),
        }),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviderData,
      });

      const outputPath = path.join(tempDir, "models.ts");

      await generateModelProfiles("openai", {}, {}, outputPath);

      expect(prettier.default.format).toHaveBeenCalled();
      expect(prettier.default.resolveConfig).toHaveBeenCalledWith(outputPath);
    });
  });
});
