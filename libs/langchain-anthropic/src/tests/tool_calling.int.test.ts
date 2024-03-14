/* eslint-disable no-process-env */

import { z } from "zod";
import { expect, test } from "@jest/globals";
import { ChatAnthropicTools } from "../experimental/tool_calling.js";

test("Test ChatAnthropicTools", async () => {
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  });
  const structured = chat.withStructuredOutput(
    z.object({
      nested: z.array(z.number()),
    })
  );
  const res = await structured.invoke(
    "What are the first five natural numbers?"
  );
  console.log(res);
  expect(res).toEqual({
    nested: [1, 2, 3, 4, 5],
  });
});
