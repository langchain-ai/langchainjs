import { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

import { CloudflareD1MessageHistory } from "../message_histories.js";

/**
 * The part of a D1 binding that CloudflareD1MessageHistory uses, backed by a
 * real SQLite database so the SQL it sends is actually parsed and run.
 */
function sqliteD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  return {
    prepare(sql: string) {
      return {
        bind(...params: (string | null)[]) {
          return {
            async all() {
              const statement = db.prepare(sql);
              const results = /^\s*select\b/i.test(sql)
                ? statement.all(...params)
                : (statement.run(...params), []);
              return { results, success: true, meta: {} };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe("CloudflareD1MessageHistory", () => {
  test("stores and reads back messages for its session", async () => {
    const database = sqliteD1();
    const history = new CloudflareD1MessageHistory({
      sessionId: "session-a",
      database,
    });

    await history.addMessage(new HumanMessage("hi"));
    await history.addMessage(new AIMessage("hello"));

    const messages = await history.getMessages();
    expect(messages.map((m) => m.content)).toEqual(["hi", "hello"]);
  });

  test("clear() removes only the current session's messages", async () => {
    const database = sqliteD1();
    const a = new CloudflareD1MessageHistory({ sessionId: "a", database });
    const b = new CloudflareD1MessageHistory({ sessionId: "b", database });
    await a.addMessage(new HumanMessage("from a"));
    await b.addMessage(new HumanMessage("from b"));

    await a.clear();

    expect(await a.getMessages()).toEqual([]);
    expect((await b.getMessages()).map((m) => m.content)).toEqual(["from b"]);
  });

  test("clear() uses a custom table name", async () => {
    const database = sqliteD1();
    const history = new CloudflareD1MessageHistory({
      tableName: "custom_history",
      sessionId: "s",
      database,
    });
    await history.addMessage(new HumanMessage("x"));

    await history.clear();

    expect(await history.getMessages()).toEqual([]);
  });
});
