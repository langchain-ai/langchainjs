import { z } from "zod";
import { tool, createAgent, HumanMessage } from "langchain";
import { toolSequenceMiddleware } from "langchain/middleware";

// Advanced example: E-commerce Order Processing Pipeline
// This example demonstrates a complex workflow with multiple validation steps

// Define individual tools for the order processing pipeline
const validatePayment = tool(
  async ({ orderId, paymentMethod, amount }) => {
    console.log(
      `Validating payment for order ${orderId}: ${paymentMethod} - $${amount}`
    );
    // Simulate payment validation logic
    if (amount > 1000) {
      throw new Error("Payment amount exceeds limit");
    }
    return `Payment validated successfully for order ${orderId}`;
  },
  {
    name: "validate_payment",
    description: "Validate payment information for an order",
    schema: z.object({
      orderId: z.string(),
      paymentMethod: z.string(),
      amount: z.number(),
    }),
  }
);

const checkInventory = tool(
  async ({ orderId, items }) => {
    console.log(`Checking inventory for order ${orderId}:`, items);
    // Simulate inventory check
    for (const item of items) {
      if (item.quantity > 100) {
        throw new Error(`Insufficient inventory for ${item.name}`);
      }
    }
    return `Inventory confirmed for all items in order ${orderId}`;
  },
  {
    name: "check_inventory",
    description: "Check inventory availability for order items",
    schema: z.object({
      orderId: z.string(),
      items: z.array(
        z.object({
          name: z.string(),
          quantity: z.number(),
        })
      ),
    }),
  }
);

const reserveInventory = tool(
  async ({ orderId, items }) => {
    console.log(`Reserving inventory for order ${orderId}`);
    return `Inventory reserved for order ${orderId}`;
  },
  {
    name: "reserve_inventory",
    description: "Reserve inventory items for an order",
    schema: z.object({
      orderId: z.string(),
      items: z.array(
        z.object({
          name: z.string(),
          quantity: z.number(),
        })
      ),
    }),
  }
);

const calculateShipping = tool(
  async ({ orderId, destination, weight }) => {
    console.log(`Calculating shipping for order ${orderId} to ${destination}`);
    const cost = weight * 2.5; // $2.50 per pound
    return `Shipping calculated: $${cost.toFixed(2)} for order ${orderId}`;
  },
  {
    name: "calculate_shipping",
    description: "Calculate shipping cost and method for an order",
    schema: z.object({
      orderId: z.string(),
      destination: z.string(),
      weight: z.number(),
    }),
  }
);

const processOrder = tool(
  async ({ orderId }) => {
    console.log(`Processing order ${orderId} - creating fulfillment record`);
    return `Order ${orderId} processed successfully and sent to fulfillment`;
  },
  {
    name: "process_order",
    description: "Create fulfillment record and process the order",
    schema: z.object({
      orderId: z.string(),
    }),
  }
);

const sendConfirmation = tool(
  async ({ orderId, customerEmail }) => {
    console.log(
      `Sending confirmation email for order ${orderId} to ${customerEmail}`
    );
    return `Confirmation email sent for order ${orderId}`;
  },
  {
    name: "send_confirmation",
    description: "Send order confirmation email to customer",
    schema: z.object({
      orderId: z.string(),
      customerEmail: z.string(),
    }),
  }
);

// Create the order processing pipeline middleware
const orderProcessingPipeline = toolSequenceMiddleware({
  name: "process_ecommerce_order",
  description:
    "Process an e-commerce order through the complete fulfillment pipeline",
  schema: z.object({
    orderId: z.string(),
    paymentMethod: z.string(),
    amount: z.number(),
    items: z.array(
      z.object({
        name: z.string(),
        quantity: z.number(),
      })
    ),
    destination: z.string(),
    weight: z.number(),
    customerEmail: z.string(),
  }),
  workflow: {
    validate_payment: "check_inventory",
    check_inventory: "reserve_inventory",
    reserve_inventory: "calculate_shipping",
    calculate_shipping: "process_order",
    process_order: "send_confirmation",
  },
  tools: [
    validatePayment,
    checkInventory,
    reserveInventory,
    calculateShipping,
    processOrder,
    sendConfirmation,
  ],
  start: "validate_payment",
});

// Create agent with the order processing pipeline
const orderAgent = createAgent({
  model: "openai:gpt-4o",
  middleware: [orderProcessingPipeline],
  systemPrompt: `You are an e-commerce order processing assistant. 
When a customer places an order, use the order processing pipeline to ensure all steps are completed properly.
The pipeline will automatically validate payment, check inventory, reserve items, calculate shipping, process the order, and send confirmation.`,
});

// Example usage
const result = await orderAgent.invoke({
  messages: [
    new HumanMessage(`
    I need to process this order:
    - Order ID: ORD-12345
    - Customer: john@example.com
    - Payment: Credit Card
    - Amount: $299.99
    - Items: 2x Wireless Headphones, 1x Phone Case
    - Shipping to: New York, NY
    - Total weight: 1.5 lbs
    `),
  ],
});

console.log("Order processing completed:", result);
