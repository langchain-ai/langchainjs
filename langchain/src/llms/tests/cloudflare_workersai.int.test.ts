import { test } from "@jest/globals";
import { CloudflareWorkersAI } from "../cloudflare_workersai.js";

test("Test CloudflareWorkersAI", async () => {
  const model = new CloudflareWorkersAI({});
  const res = await model.call("1 + 1 =");
  console.log(res);
}, 50000);
