import { test, expect, vi } from "vitest";

test("loading the import map does not run the empty root entrypoint", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  const importMap = await import("../import_map.js");

  expect(warn).not.toHaveBeenCalledWith(
    expect.stringContaining('The root "langchain" entrypoint is empty')
  );
  expect("index" in importMap).toBe(false);
});
