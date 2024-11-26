import {
  AccountCreateTransaction,
  AccountBalanceQuery,
  Hbar,
  PublicKey,
} from "@hashgraph/sdk";
import { z } from "zod";
import { HederaBaseTool, HederaBaseToolParams } from "./base.js";

export class HederaCreateAccount extends HederaBaseTool {
  name = "hedera_create_account";

  schema = z.object({
    newAccountPublicKey: z.string(),
    initialAmount: z.number().default(1000),
  });

  description = `A tool for creating a new Hedera account. Takes the new account's public key and the 
                 intial amount to set the starting balance of the account to. If no inital amount is provided
                 it will set the starting balance to 1000 tinybar.`;

  constructor(fields?: HederaBaseToolParams) {
    super(fields);
  }

  async _call(arg: z.output<typeof this.schema>): Promise<string> {
    const { newAccountPublicKey, initialAmount } = arg;

    try {
      const publicKey = PublicKey.fromString(newAccountPublicKey);
      const newAccount = await new AccountCreateTransaction()
        .setKey(publicKey)
        .setInitialBalance(Hbar.fromTinybars(initialAmount))
        .execute(this.client);

      const getReceipt = await newAccount.getReceipt(this.client);
      const newAccountId = getReceipt.accountId;

      if (!newAccountId) {
        throw new Error("Account creation failed.");
      }

      const accountBalance = await new AccountBalanceQuery()
        .setAccountId(newAccountId)
        .execute(this.client);

      return `Account created successfully. Account ID: ${newAccountId},
              Initial Balance: ${accountBalance.hbars.toString()} tinybars`;
    } catch (error) {
      const typedError = error as Error;
      throw new Error(`Failed to create account: ${typedError.message}`);
    }
  }
}

export type AccountCreateSchema = {
  newAccountPublicKey: string;
  initialAmount?: number;
};
