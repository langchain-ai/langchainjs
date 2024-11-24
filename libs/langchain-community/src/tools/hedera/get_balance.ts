import { AccountBalanceQuery } from "@hashgraph/sdk";
import { z } from "zod";
import { HederaBaseTool, HederaBaseToolParams } from "./base.js";

export class HederaAccountBalance extends HederaBaseTool {
  name = "hedera_account_balance";

  schema = z.object({
    accountId: z.string().optional(),
  });

  description = `A tool for retrieving the balance of a Hedera account. Takes an optional accountId as input.
                 If no accountId is provided, the balance of the client operator account is returned. The
                 result is the account balance in tinybars.`;

  constructor(fields?: HederaBaseToolParams) {
    super(fields);
  }

  async _call(arg: z.output<typeof this.schema>): Promise<string> {
    let { accountId } = arg;

    if (!accountId) {
      accountId = this.client.operatorAccountId?.toString();
    }

    if (!accountId) {
      throw new Error("Account ID is required and could not be determined.");
    }

    try {
      const balance = await new AccountBalanceQuery()
        .setAccountId(accountId)
        .execute(this.client);

      return `Account balance: ${balance.hbars.toTinybars()} tinybars`;
    } catch (error) {
      const typedError = error as Error;
      throw new Error(`Failed to fetch account balance: ${typedError.message}`);
    }
  }
}

export type AccountBalanceSchema = {
  accountId?: string;
};
