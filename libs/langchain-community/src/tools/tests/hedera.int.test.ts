import { expect, describe, it } from "@jest/globals";
import { HederaAccountBalance } from "../hedera/index.js";

describe("HederaAccountBalance using HederaAccountBalance", () => {
  it("should throw an error if both accountId and privateKey are missing", async () => {
    const params = {
      credentials: {},
    };

    expect(() => new HederaAccountBalance(params)).toThrow(
      "Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY to interact with Hedera"
    );
  });
});
