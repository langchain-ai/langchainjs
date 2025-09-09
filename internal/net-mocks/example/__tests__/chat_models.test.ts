import { describe, it, expect } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import { net } from "../../src";

const model = new ChatAnthropic({
  model: "claude-3-5-sonnet-20241022",
});

const multiTurn = async () => {
  const firstMessage = new HumanMessage("wassup");

  const result = await model.invoke([firstMessage]);
  expect(result.content).toBeDefined();

  const result2 = await model.invoke([
    firstMessage,
    result,
    new HumanMessage("ok man"),
  ]);
  expect(result2.content).toBeDefined();
};

describe("ChatAnthropic", () => {
  it("works as expected", async () => {
    await net.vcr();
    await multiTurn();
  });

  it.fails(
    "will reject when there isn't a match when `noMatch: reject`",
    async () => {
      await net.vcr({ noMatch: "reject" });
      await multiTurn();
    }
  );

  it.fails("will reject stale responses when `stale: reject`", async () => {
    await net.vcr({ stale: "reject", maxAge: 0 });
    await multiTurn();
  });

  it("will keep archives in custom sources", async () => {
    await net.vcr("my_special_archive");
    await multiTurn();
  });

  it("will keep api keys out of archives (if configured properly)", async () => {
    await net.vcr({
      /// this option will be what configures it, but "x-api-key" exists as a default in vitest.config.ts
      // redactedKeys: [],
    });
    await multiTurn();
  });

  it("will ignore network delay if `useTimings: false`", async () => {
    await net.vcr({ useTimings: false });
    await multiTurn();
  });
});
