import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseConfig } from "../config.js";
import { generateModelProfiles } from "../generator.js";
import { refreshProfiles, resolveProfileConfigs } from "../refresh.js";

const { configs, entries } = vi.hoisted(() => ({
  configs: new Map<
    string,
    {
      provider: string;
      output: string;
      configDir: string;
      overrides?: {
        toolCalling: boolean;
        "test-model": { toolCalling: boolean };
      };
    }
  >(),
  entries: [
    "langchain-xai",
    "langchain-openrouter",
    "langchain-openai",
    "langchain-groq",
    "langchain-google-genai",
    "langchain-google-common",
    "langchain-google",
    "langchain-deepseek",
    "langchain-anthropic",
    "langchain-without-profiles",
  ],
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn((file: string) => configs.has(file)),
  readdirSync: vi.fn(() => [
    ...entries.map((name) => ({ name, isDirectory: () => true })),
    { name: "README.md", isDirectory: () => false },
  ]),
}));

vi.mock("../config.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../config.js")>()),
  findMonorepoRoot: () => "/monorepo",
  parseConfig: vi.fn((file: string) => configs.get(file)),
}));

vi.mock("../generator.js", () => ({ generateModelProfiles: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateModelProfiles).mockReset();
  configs.clear();
  for (const name of entries.filter(
    (entry) => entry !== "langchain-without-profiles"
  )) {
    const configDir = path.join("/monorepo/libs/providers", name);
    const provider =
      name === "langchain-google-common"
        ? "google-vertex"
        : name.replace("langchain-", "").replace("google-genai", "google");
    configs.set(path.join(configDir, "profiles.toml"), {
      provider,
      output: path.join(configDir, "src/profiles.ts"),
      configDir,
    });
  }
});

describe("resolveProfileConfigs", () => {
  it("discovers all configured directories in sorted order", () => {
    expect(
      resolveProfileConfigs().map((config) => path.basename(config.configDir))
    ).toEqual(
      entries.filter((name) => name !== "langchain-without-profiles").sort()
    );
    expect(parseConfig).toHaveBeenCalledTimes(9);
    expect(parseConfig).toHaveBeenCalledWith(
      "/monorepo/libs/providers/langchain-anthropic/profiles.toml"
    );
  });

  it("preserves both Google configurations and trims comma-separated IDs", () => {
    expect(
      resolveProfileConfigs(" google, anthropic ").map(
        (config) => config.provider
      )
    ).toEqual(["anthropic", "google", "google"]);
    expect(resolveProfileConfigs("google-vertex")).toHaveLength(1);
  });

  it.each(["", " ", ",", "google,", "unknown", "google,unknown", "all,google"])(
    "rejects invalid filter %j before generation",
    async (filter) => {
      await expect(refreshProfiles(filter)).rejects.toThrow();
      expect(generateModelProfiles).not.toHaveBeenCalled();
    }
  );
});

describe("refreshProfiles", () => {
  it("refreshes all targets with separated overrides", async () => {
    const anthropic = configs.get(
      "/monorepo/libs/providers/langchain-anthropic/profiles.toml"
    )!;
    anthropic.overrides = {
      toolCalling: true,
      "test-model": { toolCalling: false },
    };
    await refreshProfiles();
    expect(generateModelProfiles).toHaveBeenCalledTimes(9);
    expect(generateModelProfiles).toHaveBeenNthCalledWith(
      1,
      "anthropic",
      { toolCalling: true },
      { "test-model": { toolCalling: false } },
      anthropic.output
    );
  });

  it("refreshes only selected configurations", async () => {
    await refreshProfiles("google");
    expect(generateModelProfiles).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(generateModelProfiles).mock.calls) {
      expect(call[0]).toBe("google");
    }
  });

  it("attempts every target before reporting all failed providers", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(generateModelProfiles)
      .mockRejectedValueOnce(new Error("upstream unavailable"))
      .mockRejectedValueOnce("invalid response");
    await expect(refreshProfiles()).rejects.toThrow(
      "Failed to refresh model profiles for: anthropic, deepseek"
    );
    expect(generateModelProfiles).toHaveBeenCalledTimes(9);
    expect(errorLog).toHaveBeenCalledTimes(2);
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("upstream unavailable")
    );
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("invalid response")
    );
    errorLog.mockRestore();
  });
});
