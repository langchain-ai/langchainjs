import { TransferTransaction, Hbar } from "@hashgraph/sdk";
import { z } from "zod";
import { HederaBaseTool, HederaBaseToolParams } from "./base.js";

export class HederaTransfer extends HederaBaseTool {
  name = "hedera_transfer";

  schema = z.object({
    senderAccountId: z.string().optional(),
    recipientAccountId: z.string(),
    transferAmount: z.number(),
  });

  description = `A tool for transferring Hbar between two Hedera accounts. Requires a
                 sender account (if not passed will use the client account), recipient account,
                 and transfer amount (in tinybars).`;

  constructor(fields?: HederaBaseToolParams) {
    super(fields);
  }

  async _call(arg: z.output<typeof this.schema>): Promise<string> {
    let { senderAccountId } = arg;
    const { recipientAccountId, transferAmount } = arg;

    if (!senderAccountId) {
      senderAccountId = this.client.operatorAccountId?.toString();
    }

    if (!senderAccountId || !recipientAccountId || !transferAmount) {
      throw new Error(
        "Sender account, recipient account, and transfer amount are all required."
      );
    }

    try {
      const transaction = await new TransferTransaction()
        .addHbarTransfer(
          senderAccountId,
          Hbar.fromTinybars(transferAmount).negated()
        )
        .addHbarTransfer(recipientAccountId, Hbar.fromTinybars(transferAmount))
        .execute(this.client);

      const transactionReceipt = await transaction.getReceipt(this.client);
      return `The transfer transaction of ${transferAmount} tinybars from ${senderAccountId} to
               ${recipientAccountId} was: ${transactionReceipt.status.toString()}`;
    } catch (error) {
      const typedError = error as Error;
      throw new Error(`Failed to perform transfer: ${typedError.message}`);
    }
  }
}

export type TransferSchema = {
  senderAccountId: string;
  recipientAccountId: string;
  transferAmount: number;
};
