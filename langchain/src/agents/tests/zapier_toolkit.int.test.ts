import { beforeEach, describe, expect, test } from "@jest/globals";
import { ZapierToolKit } from "../agent_toolkits/zapier/zapier.js";
import { ZapierNLAWrapper, ZapierValues } from "../../tools/zapier.js";

describe("ZapierNLAWrapper", () => {
  let actions: ZapierValues[] = [];
  let zapier: ZapierNLAWrapper;

  beforeEach(async () => {
    zapier = new ZapierNLAWrapper();
    actions = await zapier.listActions();
  });

  test("loads ZapierToolKit", async () => {
    const toolkit = await ZapierToolKit.fromZapierNLAWrapper(zapier);

    expect(toolkit).toBeDefined();
  });

  test("Zapier NLA has connected actions", async () => {
    expect(actions.length).toBeGreaterThan(0);
  });

  describe("Giphy action", () => {
    test("returns a GIF", async () => {
      const giphy = actions.find(
        (action) => action.description === "Giphy: Find GIF"
      );
      const result = await zapier.runAction(giphy?.id, "cats");

      expect(result).toMatchObject({
        keyword: "cats",
        url: expect.stringContaining("https://"),
      });
    });
  });
});
