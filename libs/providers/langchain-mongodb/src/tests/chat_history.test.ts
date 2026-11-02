import { test, expect } from "vitest";
import { Collection, Document as MongoDBDocument } from "mongodb";
import { MongoDBChatMessageHistory } from "../chat_history.js";

const collection = {} as unknown as Collection<MongoDBDocument>;

test("rejects a query operator object as sessionId", () => {
  expect(
    () =>
      new MongoDBChatMessageHistory({
        collection,
        sessionId: { $regex: "^victim-" } as unknown as string,
      })
  ).toThrow(TypeError);
});

test("rejects other non-string or empty sessionId values", () => {
  for (const badSessionId of [
    { $ne: null },
    ["victim-1"],
    42,
    null,
    undefined,
    "",
  ] as unknown as string[]) {
    expect(
      () =>
        new MongoDBChatMessageHistory({ collection, sessionId: badSessionId })
    ).toThrow(TypeError);
  }
});
