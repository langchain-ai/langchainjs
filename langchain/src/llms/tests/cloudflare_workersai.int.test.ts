import { test } from "@jest/globals";
import { CloudflareWorkersAI } from "../cloudflare_workersai.js";
import { getEnvironmentVariable } from "../../util/env.js";

test("Test CloudflareWorkersAI", async () => {
  const model = new CloudflareWorkersAI({});
  const res = await model.call("1 + 1 =");
  console.log(res);
}, 50000);

test.skip("Test custom base url", async () => {
  const model = new CloudflareWorkersAI({
    baseUrl: `https://gateway.ai.cloudflare.com/v1/${getEnvironmentVariable(
      "CLOUDFLARE_ACCOUNT_ID"
    )}/lang-chainjs/workers-ai/`,
  });
  const res = await model.call("1 + 1 =");
  console.log(res);
});
