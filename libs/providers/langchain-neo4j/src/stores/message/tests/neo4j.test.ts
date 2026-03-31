import { test, expect, describe, vi, beforeEach } from "vitest";

const mockExecuteQuery = vi.fn();
const mockGetServerInfo = vi.fn().mockResolvedValue({});
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock("neo4j-driver", () => {
  const mockDriver = {
    executeQuery: mockExecuteQuery,
    getServerInfo: mockGetServerInfo,
    close: mockClose,
  };

  return {
    default: {
      driver: vi.fn().mockReturnValue(mockDriver),
    },
    auth: {
      basic: vi.fn().mockReturnValue({ scheme: "basic" }),
    },
    Driver: vi.fn(),
    Record: vi.fn(),
  };
});

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-v4"),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Neo4jChatMessageHistory", () => {
  test("should create instance with required params", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    const history = new Neo4jChatMessageHistory({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    expect(history).toBeDefined();
    expect(history.sessionId).toBe("mock-uuid-v4");
    expect(history.sessionNodeLabel).toBe("ChatSession");
    expect(history.messageNodeLabel).toBe("ChatMessage");
    expect(history.windowSize).toBe(3);
  });

  test("should accept custom session config", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    const history = new Neo4jChatMessageHistory({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
      sessionId: "custom-session-id",
      sessionNodeLabel: "MySession",
      messageNodeLabel: "MyMessage",
      windowSize: 5,
    });

    expect(history.sessionId).toBe("custom-session-id");
    expect(history.sessionNodeLabel).toBe("MySession");
    expect(history.messageNodeLabel).toBe("MyMessage");
    expect(history.windowSize).toBe(5);
  });

  test("should accept numeric session id", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    const history = new Neo4jChatMessageHistory({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
      sessionId: 42,
    });

    expect(history.sessionId).toBe(42);
  });

  test("should throw when connection details are missing", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    expect(
      () =>
        new Neo4jChatMessageHistory({
          url: "",
          username: "neo4j",
          password: "password",
        })
    ).toThrow("Neo4j connection details not provided.");
  });

  test("should throw when username is missing", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    expect(
      () =>
        new Neo4jChatMessageHistory({
          url: "bolt://localhost:7687",
          username: "",
          password: "password",
        })
    ).toThrow("Neo4j connection details not provided.");
  });

  test("should throw when password is missing", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    expect(
      () =>
        new Neo4jChatMessageHistory({
          url: "bolt://localhost:7687",
          username: "neo4j",
          password: "",
        })
    ).toThrow("Neo4j connection details not provided.");
  });

  test("should have correct lc_namespace", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    const history = new Neo4jChatMessageHistory({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    expect(history.lc_namespace).toEqual([
      "langchain",
      "stores",
      "message",
      "neo4j",
    ]);
  });

  test("should verify connectivity via initialize", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    const history = await Neo4jChatMessageHistory.initialize({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    expect(history).toBeDefined();
    expect(mockGetServerInfo).toHaveBeenCalled();
  });

  test("should throw on failed connectivity during initialize", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    mockGetServerInfo.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(
      Neo4jChatMessageHistory.initialize({
        url: "bolt://localhost:7687",
        username: "neo4j",
        password: "password",
      })
    ).rejects.toThrow("Could not verify connection to the Neo4j database");
  });

  test("should close the driver", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    const history = new Neo4jChatMessageHistory({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    await history.close();
    expect(mockClose).toHaveBeenCalled();
  });

  test("should call executeQuery when adding a message", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");
    const { HumanMessage } = await import("@langchain/core/messages");

    mockExecuteQuery.mockResolvedValueOnce({ records: [] });

    const history = new Neo4jChatMessageHistory({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
      sessionId: "test-session",
    });

    await history.addMessage(new HumanMessage("Hello!"));

    expect(mockExecuteQuery).toHaveBeenCalledWith(
      expect.stringContaining("MERGE (chatSession:ChatSession"),
      expect.objectContaining({
        sessionId: "test-session",
        type: "human",
        content: "Hello!",
      })
    );
  });

  test("should call executeQuery when clearing messages", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    mockExecuteQuery.mockResolvedValueOnce({ records: [] });

    const history = new Neo4jChatMessageHistory({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
      sessionId: "test-session",
    });

    await history.clear();

    expect(mockExecuteQuery).toHaveBeenCalledWith(
      expect.stringContaining("DETACH DELETE node"),
      expect.objectContaining({
        sessionId: "test-session",
      })
    );
  });

  test("should throw wrapped error on addMessage failure", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");
    const { HumanMessage } = await import("@langchain/core/messages");

    mockExecuteQuery.mockRejectedValueOnce(new Error("Query failed"));

    const history = new Neo4jChatMessageHistory({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    await expect(
      history.addMessage(new HumanMessage("Hello!"))
    ).rejects.toThrow("Couldn't add message");
  });

  test("should throw wrapped error on clear failure", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    mockExecuteQuery.mockRejectedValueOnce(new Error("Query failed"));

    const history = new Neo4jChatMessageHistory({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    await expect(history.clear()).rejects.toThrow(
      "Couldn't clear chat history"
    );
  });

  test("should throw wrapped error on getMessages failure", async () => {
    const { Neo4jChatMessageHistory } = await import("../neo4j.js");

    mockExecuteQuery.mockRejectedValueOnce(new Error("Query failed"));

    const history = new Neo4jChatMessageHistory({
      url: "bolt://localhost:7687",
      username: "neo4j",
      password: "password",
    });

    await expect(history.getMessages()).rejects.toThrow("Couldn't get messages");
  });
});
