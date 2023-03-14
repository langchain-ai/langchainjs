import { test, expect } from "@jest/globals";
import { ZapierNLAWrapper } from "../zapier.js";

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
