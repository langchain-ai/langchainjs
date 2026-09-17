import { describe, expect, test } from "vitest";

import { buildHeaders, describeRuntime, parseResponse } from "../client.js";

const BASE_URL = (
  process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai"
).replace(/\/+$/, "");

const ENDPOINT = `POST ${BASE_URL}/v1/systemone`;

/** A trivial Noul question — enough to make a valid request. */
const PROBE_QUESTIONS = {
  probe: { type: "noul" as const, instructions: "Is this urgent?" },
};

describe.skipIf(!process.env.TYPESAFE_API_KEY)(
  "client against the live TypeSafe API",
  () => {
    test("the full SDK-parity header set is accepted and the response parses", async () => {
      const headers = buildHeaders({
        apiKey: process.env.TYPESAFE_API_KEY as string,
        retryCount: 1,
      });
      // The live proof that all seven headers — including both
      // `X-TypeSafe-*` identity headers and the retry-count header — are
      // accepted by the real API, not merely plausible.
      expect(headers.get("authorization")).toMatch(/^Bearer /);
      expect(headers.get("content-type")).toBe("application/json");
      expect(headers.get("accept")).toBe("application/json");
      expect(headers.get("user-agent")).toBeTruthy();
      expect(headers.get("x-typesafe-sdk")).toBeTruthy();
      expect(headers.get("x-typesafe-runtime")).toBeTruthy();
      expect(headers.get("x-typesafe-retry-count")).toBe("1");

      const response = await fetch(`${BASE_URL}/v1/systemone`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          state: "Customer says the app is broken.",
          model: "jev-latest",
          questions: PROBE_QUESTIONS,
        }),
      });
      expect(response.status).toBe(200);

      const parsed = await parseResponse(response, ENDPOINT);
      expect(parsed.model).toMatch(/^jev-/);
      expect(parsed.requestId).toBeTruthy();
    });

    test("describeRuntime reports a non-empty string on this platform", () => {
      expect(describeRuntime().length).toBeGreaterThan(0);
    });
  }
);
