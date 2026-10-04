import { describe, expect, test } from "vitest";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { GoogleRequestLogger, GoogleRequestRecorder } from "../../index.js";
import { ChatGoogle } from "../node.js";

/**
 * Same shape as `buildTestCallbacks` in index.int.test.ts: always record the
 * request so it can be asserted on, and log it when GOOGLE_LOG_REQUESTS is set
 * (e.g. GOOGLE_LOG_REQUESTS=1) for debugging.
 */
function buildTestCallbacks(
  recorder: GoogleRequestRecorder
): BaseCallbackHandler[] {
  const cbs: BaseCallbackHandler[] = [recorder];
  if (process.env.GOOGLE_LOG_REQUESTS) {
    cbs.push(new GoogleRequestLogger());
  }
  return cbs;
}

type CredentialSource = { name: string; isConfigured: boolean };

/**
 * The ways credentials reach Vertex AI through google-auth-library rather than
 * an explicit key — the path whose scopes this fix fills in. Every source the
 * environment provides is exercised, so a regression in one cannot hide behind
 * another being unset. The ambient entry covers a plain
 * `gcloud auth application-default login` with neither variable set.
 */
const credentialSources: CredentialSource[] = [
  {
    name: "GOOGLE_APPLICATION_CREDENTIALS",
    isConfigured: Boolean(
      getEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS")
    ),
  },
  {
    name: "GOOGLE_CLOUD_CREDENTIALS",
    isConfigured: Boolean(getEnvironmentVariable("GOOGLE_CLOUD_CREDENTIALS")),
  },
  {
    name: "ambient application default credentials",
    isConfigured:
      !getEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS") &&
      !getEnvironmentVariable("GOOGLE_CLOUD_CREDENTIALS"),
  },
];

describe.each(credentialSources)(
  "ChatGoogle on Vertex AI with $name",
  ({ isConfigured }: CredentialSource) => {
    test.runIf(isConfigured)(
      "authenticates without being given auth scopes",
      async () => {
        const recorder = new GoogleRequestRecorder();
        const model = new ChatGoogle({
          model: "gemini-2.5-flash",
          platformType: "gcp",
          vertexai: true,
          location: "global",
          callbacks: buildTestCallbacks(recorder),
        });

        const result = await model.invoke("Reply with OK.");

        expect(result.content).not.toEqual("");
      }
    );
  }
);
