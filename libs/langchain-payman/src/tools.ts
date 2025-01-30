import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams } from "@langchain/core/tools";
import { Paymanai } from "paymanai";

// Base interface for Payman tool parameters
interface PaymanToolParams extends ToolParams {
  client: Paymanai;
}

/**
 * Send Payment Tool
 */
export interface SendPaymentInput {
  amount_decimal: number;
  payment_destination_id?: string;
  payment_destination?: Record<string, any>;
  customer_id?: string;
  customer_email?: string;
  customer_name?: string;
  memo?: string;
}

export class SendPaymentTool extends Tool {
  static lc_name(): string {
    return "SendPaymentTool";
  }

  name = "send_payment";
  description = "Send funds from an agent's wallet to a payee. Takes amount_decimal, payment_destination_id or payment_destination, customer info, etc.";
  
  private client: Paymanai;

  constructor(fields: PaymanToolParams) {
    super(fields);
    this.client = fields.client;
  }

  protected async _call(
    input: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      const params: SendPaymentInput = JSON.parse(input);
      const response = await this.client.payments.send_payment(params);
      return `Payment sent successfully. Response: ${JSON.stringify(response)}`;
    } catch (e) {
      return `Error in send_payment: ${e}`;
    }
  }
}

/**
 * Search Payees Tool
 */
export interface SearchPayeesInput {
  name?: string;
  contact_email?: string;
  type?: string;
}

export class SearchPayeesTool extends Tool {
  static lc_name(): string {
    return "SearchPayeesTool";
  }

  name = "search_payees";
  description = "Search for existing payment destinations (payees). Can filter by name, email, type, etc.";
  
  private client: Paymanai;

  constructor(fields: PaymanToolParams) {
    super(fields);
    this.client = fields.client;
  }

  protected async _call(
    input: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      const params: SearchPayeesInput = JSON.parse(input);
      const response = await this.client.payments.search_payees(params);
      return `Payees search returned: ${JSON.stringify(response)}`;
    } catch (e) {
      return `Error in search_payees: ${e}`;
    }
  }
}

/**
 * Add Payee Tool
 */
export interface AddPayeeInput {
  type: "CRYPTO_ADDRESS" | "US_ACH";
  name?: string;
  contact_details?: Record<string, any>;
  account_holder_name?: string;
  account_number?: string;
  account_type?: string;
  routing_number?: string;
  address?: string;
  currency?: string;
  tags?: string[];
}

export class AddPayeeTool extends Tool {
  static lc_name(): string {
    return "AddPayeeTool";
  }

  name = "add_payee";
  description = "Add a new payee (payment destination). Can be US_ACH or CRYPTO_ADDRESS with the appropriate fields.";
  
  private client: Paymanai;

  constructor(fields: PaymanToolParams) {
    super(fields);
    this.client = fields.client;
  }

  protected async _call(
    input: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      const params: AddPayeeInput = JSON.parse(input);
      const response = await this.client.payments.create_payee(params);
      return `Payee created successfully. Response: ${JSON.stringify(response)}`;
    } catch (e) {
      return `Error in add_payee: ${e}`;
    }
  }
}

/**
 * Get Balance Tool
 */
export interface GetBalanceInput {
  customer_id?: string;
  currency?: string;
}

export class GetBalanceTool extends Tool {
  static lc_name(): string {
    return "GetBalanceTool";
  }

  name = "get_balance";
  description = "Get the spendable balance for either the agent (if customer_id not provided) or a specific customer (if customer_id provided).";
  
  private client: Paymanai;

  constructor(fields: PaymanToolParams) {
    super(fields);
    this.client = fields.client;
  }

  protected async _call(
    input: string,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      const params: GetBalanceInput = JSON.parse(input);
      const response = params.customer_id && params.customer_id.toLowerCase() !== "none"
        ? await this.client.balances.get_customer_balance({
            customer_id: params.customer_id,
            currency: params.currency || "USD"
          })
        : await this.client.balances.get_spendable_balance({
            currency: params.currency || "USD"
          });
      return `Balance info: ${JSON.stringify(response)}`;
    } catch (e) {
      return `Error in get_balance: ${e}`;
    }
  }
}
