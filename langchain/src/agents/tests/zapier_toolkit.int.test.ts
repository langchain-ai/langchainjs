import { test } from "@jest/globals";
import { ZapierNLAWrapper } from "../../zapier.js";
import { ZapierToolKit } from "../agent_toolkits/zapier/zapier.js";

test("Test ZapierToolkit", async () => {
  const zapier = new ZapierNLAWrapper();
  const toolkit = await ZapierToolKit.fromZapierNLAWrapper(zapier);
  console.log(toolkit.tools);
});
