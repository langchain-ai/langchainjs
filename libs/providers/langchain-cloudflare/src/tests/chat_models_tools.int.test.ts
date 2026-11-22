import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { describe, expect, test } from "vitest";

// Opt-in: these calls run in the development Worker and incur inference charges.
const origin = getEnvironmentVariable("CLOUDFLARE_WORKERS_AI_BINDING_TEST_URL");
describe.skipIf(!origin)("Gemma chat with a real Workers AI binding", () => {
  async function invoke(path: string) {
    const response = await fetch(new URL(path, origin), {
      signal: AbortSignal.timeout(120_000),
    });
    expect(response.status).toBe(200);
    return response.json();
  }
  test.each(["gemma", "gemma-stream"])(
    "%s",
    async (path) => {
      const result = await invoke(`/${path}`);
      expect(result.text.trim()).toBe("READY");
    },
    125_000
  );
  test.each(["tools", "tools-stream", "tools-events"])(
    "%s and tool-result replay",
    async (path) => {
      const result = await invoke(`/${path}`);
      expect(result.calls).toHaveLength(1);
      expect(result.calls[0]).toMatchObject({
        name: "lookup",
        args: { color: "red" },
        id: expect.any(String),
      });
      expect(result.answer).toMatch(/赤/);
      expect(result.answer).toMatch(/円|丸/);
      expect(result.usage.total_tokens).toBeGreaterThan(0);
    },
    125_000
  );
  test.each([
    "json-schema",
    "json-schema-stream",
    "json-mode",
    "structured-tool",
  ])(
    "%s",
    async (path) => {
      expect(await invoke(`/${path}`)).toEqual({ answer: "READY" });
    },
    125_000
  );
  test("reads two synthetic images", async () => {
    const result = await invoke("/vision");
    expect(result.text).toMatch(/赤/);
    expect(result.text).toMatch(/円|丸/);
    expect(result.text).toMatch(/青/);
    expect(result.text).toMatch(/四角|正方形/);
    expect(result.usage.total_tokens).toBeGreaterThan(0);
  }, 125_000);
});
