import { test, expect } from "@jest/globals";
import { mapV1MessageToStoredMessage } from "../message/utils.js";

test("mapV1MessageToStoredMessage", () => {
  // Test that a V1 message is upgraded.
  // Test that a v2 message is not changed.
  const v1Message = {
    type: "human",
    role: "user",
    text: "Hello, world!",
  };
  const v2Message = {
    type: "human",
    data: {
      content: "Hello, world!",
      role: "user",
    },
  };
  expect(mapV1MessageToStoredMessage(v1Message)).toEqual(v2Message);

  const v2Message2 = {
    type: "human",
    data: {
      content: "Hello, world!",
      role: "user",
      additional_kwargs: {
        foo: "bar",
      },
    },
  };
  expect(mapV1MessageToStoredMessage(v2Message2)).toEqual(v2Message2);
});
