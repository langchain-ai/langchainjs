import { describe, expect, it } from "vitest";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";

import { ChatOpenAI } from "../index.js";

class MyChatOpenAI extends ChatOpenAI {}

const lookupTool = tool(async () => "ok", {
  name: "lookup",
  description: "Looks up a value.",
  schema: z.object({}),
});

describe("ChatOpenAI.withConfig", () => {
  it("returns an instance of the receiver's subclass", () => {
    const model = new MyChatOpenAI({ model: "gpt-4o-mini", apiKey: "test" });
    expect(model.withConfig({})).toBeInstanceOf(MyChatOpenAI);
    expect(model.withConfig({ temperature: 0 })).toBeInstanceOf(MyChatOpenAI);
  });

  it("preserves bound default options through the subclass", () => {
    const model = new MyChatOpenAI({ model: "gpt-4o-mini", apiKey: "test" });
    const bound = model.withConfig({ temperature: 0.3 });
    expect(bound).toBeInstanceOf(MyChatOpenAI);
    // @ts-expect-error - defaultOptions is protected
    expect(bound.defaultOptions).toMatchObject({ temperature: 0.3 });
  });

  it("bindTools keeps the subclass", () => {
    const model = new MyChatOpenAI({ model: "gpt-4o-mini", apiKey: "test" });
    expect(model.bindTools([lookupTool])).toBeInstanceOf(MyChatOpenAI);
  });
});
