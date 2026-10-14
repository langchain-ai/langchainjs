import { expectTypeOf, it } from "vitest";
import { BaseMessage } from "../base.js";
import { TrimMessagesFields, trimMessages } from "../transformers.js";

it("accepts an optional numeric floor in direct and Runnable overloads", () => {
  expectTypeOf<TrimMessagesFields["floorTokens"]>().toEqualTypeOf<
    number | undefined
  >();
  const options = {
    maxTokens: 100,
    floorTokens: 80,
    tokenCounter: (messages: BaseMessage[]) => messages.length,
  };
  expectTypeOf(trimMessages([], options)).toEqualTypeOf<
    Promise<BaseMessage[]>
  >();
  expectTypeOf(trimMessages(options).invoke([])).toEqualTypeOf<
    Promise<BaseMessage[]>
  >();
});
