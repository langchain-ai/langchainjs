import { expect, test } from "@jest/globals";
import { ZapierToolKit } from "../agent_toolkits/zapier/zapier.js";
import { ZapierNLAWrapper } from "../tools/zapier.js";

test("Test ZapierToolkit", async () => {
  const zapier = new ZapierNLAWrapper();
  const toolkit = await ZapierToolKit.fromZapierNLAWrapper(zapier);
  console.log(toolkit.tools);
});

test("Test ZapierNLAWrapper", async () => {
  const zapier = new ZapierNLAWrapper();
  const actions = await zapier.listActions();
  expect(actions.length).toBeGreaterThan(0);
  console.log("listActions: ", actions);

  // find the action with description "Gmail: Find Email"
  const action = actions.find(
    (action) => action.description === "Gmail: Find Email"
  );
  expect(action).not.toBeUndefined();
  console.log("action: ", action);
  const data = await zapier.previewAction(
    action?.id ?? "",
    "Find an email with Silicon Valley Bank"
  );
  console.log("previewData: ", data);

  const result = await zapier.runAction(
    action?.id ?? "",
    "Find an email with Silicon Valley Bank"
  );
  console.log("result: ", result);
});
