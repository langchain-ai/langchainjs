import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  parseConfig,
  separateOverrides,
  applyOverrides,
  type ConfigFile,
} from "./config.js";

describe("config", () => {
  let tempDir: string;
  let originalCwd: string;
  let originalInitCwd: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "model-profiles-test-"));
    originalCwd = process.cwd();
    originalInitCwd = process.env.INIT_CWD;
    process.chdir(tempDir);
    delete process.env.INIT_CWD;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalInitCwd) {
      process.env.INIT_CWD = originalInitCwd;
    } else {
      delete process.env.INIT_CWD;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("parseConfig", () => {
    it("should parse a valid TOML config file", () => {
      const configPath = path.join(tempDir, "test.toml");
      const configContent = `
provider = "openai"
output = "src/models.ts"
`;
      fs.writeFileSync(configPath, configContent);

      const config = parseConfig(configPath);

      expect(config.provider).toBe("openai");
      expect(config.output).toBe(path.resolve(tempDir, "src/models.ts"));
      expect(config.configDir).toBe(tempDir);
    });

    it("should resolve absolute output paths", () => {
      const configPath = path.join(tempDir, "test.toml");
      const absoluteOutput = path.join(tempDir, "absolute", "output.ts");
      const configContent = `
provider = "openai"
output = "${absoluteOutput}"
`;
      fs.writeFileSync(configPath, configContent);

      const config = parseConfig(configPath);

      expect(config.output).toBe(absoluteOutput);
    });

    it("should resolve relative output paths relative to config file", () => {
      const configDir = path.join(tempDir, "config");
      fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, "test.toml");
      const configContent = `
provider = "openai"
output = "../output/models.ts"
`;
      fs.writeFileSync(configPath, configContent);

      const config = parseConfig(configPath);

      expect(config.output).toBe(path.resolve(tempDir, "output/models.ts"));
      expect(config.configDir).toBe(configDir);
    });

    it("should handle INIT_CWD environment variable", () => {
      const configDir = path.join(tempDir, "config");
      fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, "test.toml");
      const configContent = `
provider = "openai"
output = "src/models.ts"
`;
      fs.writeFileSync(configPath, configContent);

      // Set INIT_CWD to simulate pnpm --filter behavior
      process.env.INIT_CWD = tempDir;
      const relativePath = path.relative(tempDir, configPath);

      const config = parseConfig(relativePath);

      expect(config.provider).toBe("openai");
      expect(config.output).toBe(path.resolve(configDir, "src/models.ts"));
    });

    it("should throw error if config file does not exist", () => {
      expect(() => {
        parseConfig("nonexistent.toml");
      }).toThrow("Config file not found");
    });

    it("should throw error if TOML is invalid", () => {
      const configPath = path.join(tempDir, "invalid.toml");
      fs.writeFileSync(configPath, "invalid toml content [[");

      expect(() => {
        parseConfig(configPath);
      }).toThrow("Failed to parse TOML config file");
    });

    it("should parse overrides section", () => {
      const configPath = path.join(tempDir, "test.toml");
      const configContent = `
provider = "openai"
output = "src/models.ts"

[overrides]
maxInputTokens = 100000
toolCalling = true

[overrides."gpt-4"]
maxOutputTokens = 8192
`;
      fs.writeFileSync(configPath, configContent);

      const config = parseConfig(configPath);

      expect(config.overrides).toBeDefined();
      expect(config.overrides?.maxInputTokens).toBe(100000);
      expect(config.overrides?.toolCalling).toBe(true);
      expect((config.overrides as Record<string, unknown>)?.["gpt-4"]).toEqual({
        maxOutputTokens: 8192,
      });
    });
  });

  describe("separateOverrides", () => {
    it("should separate provider-level and model-specific overrides", () => {
      const overrides = {
        maxInputTokens: 100000,
        toolCalling: true,
        "gpt-4": {
          maxOutputTokens: 8192,
        },
        "gpt-3.5-turbo": {
          maxInputTokens: 16385,
        },
      };

      const { providerOverrides, modelOverrides } =
        separateOverrides(overrides);

      expect(providerOverrides).toEqual({
        maxInputTokens: 100000,
        toolCalling: true,
      });
      expect(modelOverrides).toEqual({
        "gpt-4": {
          maxOutputTokens: 8192,
        },
        "gpt-3.5-turbo": {
          maxInputTokens: 16385,
        },
      });
    });

    it("should handle empty overrides", () => {
      const { providerOverrides, modelOverrides } = separateOverrides();

      expect(providerOverrides).toEqual({});
      expect(modelOverrides).toEqual({});
    });

    it("should handle undefined overrides", () => {
      const { providerOverrides, modelOverrides } =
        separateOverrides(undefined);

      expect(providerOverrides).toEqual({});
      expect(modelOverrides).toEqual({});
    });

    it("should only include valid ModelProfile fields in provider overrides", () => {
      const overrides = {
        maxInputTokens: 100000,
        invalidField: "should be ignored",
        "gpt-4": {
          maxOutputTokens: 8192,
        },
      };

      const { providerOverrides, modelOverrides } =
        separateOverrides(overrides);

      expect(providerOverrides).toEqual({
        maxInputTokens: 100000,
      });
      expect(providerOverrides).not.toHaveProperty("invalidField");
      expect(modelOverrides).toEqual({
        "gpt-4": {
          maxOutputTokens: 8192,
        },
      });
    });
  });

  describe("applyOverrides", () => {
    it("should apply provider overrides to base profile", () => {
      const baseProfile = {
        maxInputTokens: 1000,
        toolCalling: false,
      };

      const providerOverrides = {
        maxInputTokens: 2000,
        toolCalling: true,
      };

      const result = applyOverrides(baseProfile, providerOverrides);

      expect(result).toEqual({
        maxInputTokens: 2000,
        toolCalling: true,
      });
    });

    it("should apply model-specific overrides after provider overrides", () => {
      const baseProfile = {
        maxInputTokens: 1000,
        maxOutputTokens: 500,
        toolCalling: false,
      };

      const providerOverrides = {
        maxInputTokens: 2000,
        toolCalling: true,
      };

      const modelOverrides = {
        maxOutputTokens: 1000,
      };

      const result = applyOverrides(
        baseProfile,
        providerOverrides,
        modelOverrides
      );

      expect(result).toEqual({
        maxInputTokens: 2000, // From provider override
        maxOutputTokens: 1000, // From model override
        toolCalling: true, // From provider override
      });
    });

    it("should return base profile if no overrides provided", () => {
      const baseProfile = {
        maxInputTokens: 1000,
        toolCalling: false,
      };

      const result = applyOverrides(baseProfile);

      expect(result).toEqual(baseProfile);
    });

    it("should handle model-specific overrides overriding provider overrides", () => {
      const baseProfile = {
        maxInputTokens: 1000,
      };

      const providerOverrides = {
        maxInputTokens: 2000,
      };

      const modelOverrides = {
        maxInputTokens: 3000, // Should override provider override
      };

      const result = applyOverrides(
        baseProfile,
        providerOverrides,
        modelOverrides
      );

      expect(result).toEqual({
        maxInputTokens: 3000,
      });
    });
  });
});
