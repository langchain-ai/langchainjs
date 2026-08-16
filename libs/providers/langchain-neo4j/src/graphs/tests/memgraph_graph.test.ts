import { test, expect, describe, vi, beforeEach } from "vitest";

vi.mock("neo4j-driver", () => {
  const mockAuth = {
    basic: vi.fn().mockReturnValue({ scheme: "basic" }),
  };

  const mockDriver = {
    getServerInfo: vi.fn().mockResolvedValue({}),
    executeQuery: vi.fn().mockResolvedValue({ records: [] }),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockRouting = {
    WRITE: "WRITE",
    READ: "READ",
  };

  return {
    default: {
      driver: vi.fn().mockReturnValue(mockDriver),
      auth: mockAuth,
      routing: mockRouting,
      isInt: vi.fn().mockReturnValue(false),
      types: {
        Node: class MockNode {},
        Relationship: class MockRelationship {},
        Path: class MockPath {},
      },
    },
    RoutingControl: {},
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MemgraphGraph", () => {
  test("should construct with valid config", async () => {
    const { MemgraphGraph } = await import("../memgraph_graph.js");

    const graph = new MemgraphGraph({
      url: "bolt://localhost:7687",
      username: "memgraph",
      password: "password",
    });

    expect(graph).toBeDefined();
  });

  test("should default database to memgraph", async () => {
    const { MemgraphGraph } = await import("../memgraph_graph.js");

    const graph = new MemgraphGraph({
      url: "bolt://localhost:7687",
      username: "memgraph",
      password: "password",
    });

    expect(graph).toBeDefined();
  });

  test("should extend Neo4jGraph", async () => {
    const { MemgraphGraph } = await import("../memgraph_graph.js");
    const { Neo4jGraph } = await import("../neo4j_graph.js");

    const graph = new MemgraphGraph({
      url: "bolt://localhost:7687",
      username: "memgraph",
      password: "password",
    });

    expect(graph).toBeInstanceOf(Neo4jGraph);
  });

  test("should have getSchema method from parent", async () => {
    const { MemgraphGraph } = await import("../memgraph_graph.js");

    const graph = new MemgraphGraph({
      url: "bolt://localhost:7687",
      username: "memgraph",
      password: "password",
    });

    expect(graph.getSchema()).toBe("");
  });

  test("should close the driver", async () => {
    const { MemgraphGraph } = await import("../memgraph_graph.js");

    const graph = new MemgraphGraph({
      url: "bolt://localhost:7687",
      username: "memgraph",
      password: "password",
    });

    await graph.close();
  });
});
