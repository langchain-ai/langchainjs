import { AccountDeleteTransaction, PrivateKey } from "@hashgraph/sdk";
import { z } from "zod";
import { HederaBaseTool, HederaBaseToolParams } from "./base.js";

export class HederaDeleteAccount extends HederaBaseTool {
  name = "hedera_delete_account";

  schema = z.object({
    accountId: z.string(),
    accountPrivateKey: z.string(),
  });

  description = `A tool for deleting a Hedera account. Takes the account id and the 
                private key of the account to delete.`;

  constructor(fields?: HederaBaseToolParams) {
    super(fields);
  }

  async _call(arg: z.output<typeof this.schema>): Promise<string> {
    const { accountId, accountPrivateKey } = arg;

    try {
      const operatorAccountId = this.client.operatorAccountId?.toString();

      if (!operatorAccountId) {
        throw new Error("Operator account ID is null.");
      }

      const transaction = await new AccountDeleteTransaction()
        .setAccountId(accountId)
        .setTransferAccountId(operatorAccountId)
        .freezeWith(this.client);

      const privateKey = PrivateKey.fromStringED25519(accountPrivateKey);
      const signTx = await transaction.sign(privateKey);
      const txResponse = await signTx.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      const transactionStatus = receipt.status;

      return `Deleted account ${accountId} ${transactionStatus}`;
    } catch (error) {
      const typedError = error as Error;
      throw new Error(`Failed to delete account: ${typedError.message}`);
    }
  }
}

export type AccountDeleteSchema = {
  accountId: string;
  accountPrivateKey: string;
};
