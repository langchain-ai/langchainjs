import { getRetryable } from "@langchain/core/errors";
import { describe, expect, test } from "vitest";

import { expectNoLeak } from "../../tests/helpers/no-leak.js";
import {
  apiErrorFromResponse,
  TypeSafeAuthenticationError,
  TypeSafeBadRequestError,
  TypeSafeUnprocessableEntityError,
} from "../errors.js";

const BASE_URL = (
  process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai"
).replace(/\/+$/, "");

/** A trivial Noul question — enough to make an otherwise-valid request. */
const PROBE_QUESTIONS = {
  probe: { type: "noul" as const, instructions: "Is this urgent?" },
};

/**
 * Posts a raw body to the live `/v1/systemone` endpoint and returns the
 * three inputs `apiErrorFromResponse` classifies: status, parsed body
 * (falling back to raw text), and headers.
 *
 * Never logs the API key or the response body: callers assert only on
 * the *mapped error's* properties, never on raw response content.
 */
async function post(
  body: Record<string, unknown>,
  authorization = `Bearer ${process.env.TYPESAFE_API_KEY}`
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const response = await fetch(`${BASE_URL}/v1/systemone`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed, headers: response.headers };
}

describe.skipIf(!process.env.TYPESAFE_API_KEY)(
  "apiErrorFromResponse against the live TypeSafe API",
  () => {
    test("401: an invalid API key", async () => {
      const { status, body, headers } = await post(
        { state: "probe", model: "jev-latest", questions: PROBE_QUESTIONS },
        "Bearer sk-not-a-real-key"
      );
      expect(status).toBe(401);
      const error = apiErrorFromResponse(status, body, headers);
      expect(TypeSafeAuthenticationError.isInstance(error)).toBe(true);
      expect(error.requestId).toMatch(/^req_/);
      expect(getRetryable(error)).toBe(false);
      expectNoLeak(error, "sk-not-a-real-key");
    });

    test("400: an unknown model", async () => {
      const { status, body, headers } = await post({
        state: "probe",
        model: "not-a-real-model",
        questions: PROBE_QUESTIONS,
      });
      expect(status).toBe(400);
      const error = apiErrorFromResponse(status, body, headers);
      expect(TypeSafeBadRequestError.isInstance(error)).toBe(true);
      expect(error.requestId).toMatch(/^req_/);
      expect(getRetryable(error)).toBe(false);
      // Live-confirmed body: {"detail":{"error_type":"api_usage_error",
      // "message":"Unknown model: not-a-real-model"}} — both object-shape
      // fields are server-authored, so safeDetail should surface them.
      expect(error.message).toContain(
        "400 api_usage_error: Unknown model: not-a-real-model"
      );
    });

    test("400: a Score question with 11 levels", async () => {
      const { status, body, headers } = await post({
        state: "probe",
        model: "jev-latest",
        questions: {
          probe: {
            type: "score",
            criteria: Array.from({ length: 11 }, (_, i) => `level ${i}`),
          },
        },
      });
      expect(status).toBe(400);
      const error = apiErrorFromResponse(status, body, headers);
      expect(TypeSafeBadRequestError.isInstance(error)).toBe(true);
      expect(error.requestId).toMatch(/^req_/);
      expect(getRetryable(error)).toBe(false);
      // Live-confirmed body: {"detail":"Too many score levels. Must have
      // at most 10 levels."} — a server-authored string, safe to surface.
      expect(error.message).toContain(
        "400 Too many score levels. Must have at most 10 levels."
      );
    });

    test("422: model omitted entirely — the body echoes the full request and must never leak", async () => {
      const sentinel = "SENSITIVE-INT-TEST-STATE-4f3a9";
      const { status, body, headers } = await post({
        state: sentinel,
        questions: PROBE_QUESTIONS,
      });
      expect(status).toBe(422);
      const error = apiErrorFromResponse(status, body, headers);
      expect(TypeSafeUnprocessableEntityError.isInstance(error)).toBe(true);
      expect(error.requestId).toMatch(/^req_/);
      expect(getRetryable(error)).toBe(false);
      expectNoLeak(error, sentinel);
    });
  }
);
