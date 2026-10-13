import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { describe, expect, test } from "vitest";

import type { JsonValue } from "../../types.js";
import { serializeState } from "../state.js";

const BASE_URL = (
  process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai"
).replace(/\/+$/, "");

/** One trivial Noul question — enough to make a valid request. */
const PROBE_QUESTIONS = {
  probe: { type: "noul" as const, instructions: "Is this urgent?" },
};

/**
 * Posts `state` to the live `/v1/systemone` endpoint alongside one trivial
 * Noul question and returns the raw response.
 *
 * Never logs the API key or the response body: callers assert on
 * `.status` only. `model` is always sent explicitly — live probing found
 * the server requires it (422 `Field required`) despite the official
 * SDK typing it as optional.
 */
async function postState(state: JsonValue): Promise<Response> {
  return fetch(`${BASE_URL}/v1/systemone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      state,
      model: "jev-latest",
      questions: PROBE_QUESTIONS,
    }),
  });
}

describe.skipIf(!process.env.TYPESAFE_API_KEY)(
  "serializeState output accepted by the live TypeSafe API",
  () => {
    test("accepts a bare string", async () => {
      const response = await postState(
        serializeState("Customer says the app is broken.")
      );
      expect(response.status).toBe(200);
    });

    test("accepts an object", async () => {
      const response = await postState(
        serializeState({
          message: "Customer says the app is broken.",
          tier: "enterprise",
        })
      );
      expect(response.status).toBe(200);
    });

    test("accepts an array of plain values", async () => {
      const response = await postState(serializeState(["one", 2, null]));
      expect(response.status).toBe(200);
    });

    test("accepts a single HumanMessage", async () => {
      const response = await postState(
        serializeState(new HumanMessage("Customer says the app is broken."))
      );
      expect(response.status).toBe(200);
    });

    test("accepts a message sequence", async () => {
      const response = await postState(
        serializeState([
          new SystemMessage("Be terse."),
          new HumanMessage("Hello"),
          new AIMessage("Hi"),
        ])
      );
      expect(response.status).toBe(200);
    });

    test("accepts messages nested under an object key, beside a sibling object holding a string, a number, a boolean and a null", async () => {
      const response = await postState(
        serializeState({
          conversation: {
            messages: [new HumanMessage("hi"), new AIMessage("hello")],
          },
          context: {
            note: "vip",
            priority: 1,
            resolved: false,
            resolution: null,
          },
        })
      );
      expect(response.status).toBe(200);
    });

    test("accepts an empty array", async () => {
      const response = await postState(serializeState([]));
      expect(response.status).toBe(200);
    });

    test("rejects a root scalar the same way locally and on the server", async () => {
      // Our gate and theirs must agree: serializeState throws before any
      // request is made; sending the same value raw (bypassing
      // serializeState) must get a real 422 from the server.
      for (const bad of [42, null] as const) {
        expect(() => serializeState(bad as never)).toThrow(/TypeSafe state/);
        const response = await postState(bad);
        expect(response.status).toBe(422);
      }
    });
  }
);
