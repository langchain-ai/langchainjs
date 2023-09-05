import { ZeroShotAgentOutputParser } from "../mrkl/outputParser.js";

describe("ZeroShotAgentOutputParser", () => {
  describe("when action and action input are separated by a space", () => {
    const TEXT =
      "Observation: Xyz\n\nAction: ToolX\nAction Input: what is your name?";

    it("parses agent action", async () => {
      const parser = new ZeroShotAgentOutputParser();
      const result = await parser.parse(TEXT);
      expect(result.tool).toBe("ToolX");
      expect(result.toolInput).toBe("what is your name?");
    });
  });

  describe("when action and action input are not separated by a space", () => {
    const TEXT =
      "Observation:Xyz\n\nAction:ToolX\nAction Input:what is your name?";

    it("parses agent action", async () => {
      const parser = new ZeroShotAgentOutputParser();
      const result = await parser.parse(TEXT);
      expect(result.tool).toBe("ToolX");
      expect(result.toolInput).toBe("what is your name?");
    });
  });
});
