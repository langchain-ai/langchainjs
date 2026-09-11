import { afterEach, expect, test, vi } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { collectPages } from "../pagination.js";
import { MCPAdapter } from "../client.js";

const config = { servers: { test: { url: "https://example.com/mcp" } } };
afterEach(() => vi.restoreAllMocks());

function mockConnection() {
  vi.spyOn(Client.prototype, "connect").mockResolvedValue();
  vi.spyOn(Client.prototype, "close").mockResolvedValue();
  vi.spyOn(Client.prototype, "listTools").mockResolvedValue({ tools: [] });
}

test("lists all resource and template pages with opaque cursors", async () => {
  mockConnection();
  const resources = vi
    .spyOn(Client.prototype, "listResources")
    .mockResolvedValueOnce({
      resources: [{ name: "first", uri: "test://first" }],
      nextCursor: "next",
    })
    .mockResolvedValueOnce({
      resources: [{ name: "second", uri: "test://second" }],
    });
  const templates = vi
    .spyOn(Client.prototype, "listResourceTemplates")
    .mockResolvedValueOnce({ resourceTemplates: [], nextCursor: "next" })
    .mockResolvedValueOnce({
      resourceTemplates: [{ name: "template", uriTemplate: "test://{id}" }],
    });
  const adapter = new MCPAdapter(config);
  expect((await adapter.listResources()).test.map(({ uri }) => uri)).toEqual([
    "test://first",
    "test://second",
  ]);
  expect(resources).toHaveBeenLastCalledWith({ cursor: "next" });
  expect((await adapter.listResourceTemplates()).test).toHaveLength(1);
  expect(templates).toHaveBeenLastCalledWith({ cursor: "next" });
  await adapter.close();
});

test("discovery failure is not an empty catalog", async () => {
  mockConnection();
  const error = new Error("discovery failed");
  vi.spyOn(Client.prototype, "listResources").mockRejectedValue(error);
  const adapter = new MCPAdapter(config);
  await expect(adapter.listResources()).rejects.toBe(error);
  await adapter.close();
});

test("bounds repeated cursors and unending catalogs", async () => {
  const repeated = vi.fn().mockResolvedValue({ items: [], nextCursor: "same" });
  await expect(collectPages(repeated)).rejects.toThrow(/repeated/);
  expect(repeated).toHaveBeenCalledTimes(2);
  let page = 0;
  await expect(
    collectPages(async () => ({ items: [], nextCursor: String(page++) }))
  ).rejects.toThrow(/1000 pages/);
  expect(page).toBe(1000);
});
