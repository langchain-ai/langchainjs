import { test, expect } from "@jest/globals";
import { Paymanai } from "paymanai";
import { SendPaymentTool, SearchPayeesTool, GetBalanceTool, AddPayeeTool } from "../tools.js";

// Helper to create a test client
const getTestClient = () => {
  const apiSecret = process.env.PAYMAN_API_SECRET;
  if (!apiSecret) {
    throw new Error("PAYMAN_API_SECRET required for tests");
  }
  return new Paymanai({
    xPaymanAPISecret: apiSecret,
    environment: process.env.PAYMAN_ENVIRONMENT
  });
};

test("GetBalanceTool can retrieve balance information", async () => {
  const balanceTool = new GetBalanceTool({
    // @ts-expect-error type errors
    client: getTestClient(),
  });

  const toolData = await balanceTool._call(
    JSON.stringify({ currency: "USD" })
  );

  expect(toolData).toContain("Balance info");
  const parsedData = JSON.parse(toolData.replace("Balance info: ", ""));
  expect(parsedData).toBeDefined();
});

test("SearchPayeesTool can search for existing payees", async () => {
  const searchTool = new SearchPayeesTool({
    // @ts-expect-error type errors
    client: getTestClient(),
  });

  const toolData = await searchTool._call(
    JSON.stringify({ type: "CRYPTO_ADDRESS" })
  );

  expect(toolData).toContain("Payees search returned");
  const parsedData = JSON.parse(toolData.replace("Payees search returned: ", ""));
  expect(Array.isArray(parsedData)).toBeTruthy();
});

test("SendPaymentTool can send a payment", async () => {
  const sendTool = new SendPaymentTool({
    // @ts-expect-error type errors
    client: getTestClient(),
  });

  // First create a test payee
  const addTool = new AddPayeeTool({
    // @ts-expect-error type errors
    client: getTestClient(),
  });

  // Create a test crypto payee
  const payeeData = await addTool._call(
    JSON.stringify({
      type: "CRYPTO_ADDRESS",
      name: "Test Payee",
      address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Example ETH address
      currency: "ETH"
    })
  );
  
  const payee = JSON.parse(payeeData.replace("Payee created successfully. Response: ", ""));

  // Now try sending a payment to the created payee
  const toolData = await sendTool._call(
    JSON.stringify({
      amount_decimal: 0.0001, // Small test amount
      payment_destination_id: payee.id,
      memo: "Test payment"
    })
  );

  expect(toolData).toContain("Payment sent successfully");
  const parsedData = JSON.parse(toolData.replace("Payment sent successfully. Response: ", ""));
  expect(parsedData).toBeDefined();
});

test("AddPayeeTool can create a new crypto payee", async () => {
  const addTool = new AddPayeeTool({
    // @ts-expect-error type errors
    client: getTestClient(),
  });

  const toolData = await addTool._call(
    JSON.stringify({
      type: "CRYPTO_ADDRESS",
      name: "Test Crypto Payee",
      address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Example ETH address
      currency: "ETH",
      tags: ["test"]
    })
  );

  expect(toolData).toContain("Payee created successfully");
  const parsedData = JSON.parse(toolData.replace("Payee created successfully. Response: ", ""));
  expect(parsedData.type).toBe("CRYPTO_ADDRESS");
  expect(parsedData.name).toBe("Test Crypto Payee");
});

test("AddPayeeTool can create a new ACH payee", async () => {
  const addTool = new AddPayeeTool({
    // @ts-expect-error type errors
    client: getTestClient(),
  });

  const toolData = await addTool._call(
    JSON.stringify({
      type: "US_ACH",
      name: "Test ACH Payee",
      account_holder_name: "John Doe",
      account_number: "123456789",
      routing_number: "021000021", // Example routing number
      account_type: "checking",
      tags: ["test"]
    })
  );

  expect(toolData).toContain("Payee created successfully");
  const parsedData = JSON.parse(toolData.replace("Payee created successfully. Response: ", ""));
  expect(parsedData.type).toBe("US_ACH");
  expect(parsedData.name).toBe("Test ACH Payee");
});
