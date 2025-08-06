/* eslint-disable no-plusplus */
/**
 * Post Model Hook
 *
 * This hook executes after the language model generates a response, allowing for post-processing, validation,
 * and modification of the model's output before it reaches the user.
 *
 * Why this is important:
 * - Quality Control: Enables filtering, validation, and improvement of model responses before user delivery
 * - Content Moderation: Provides a checkpoint to ensure responses meet safety and appropriateness standards
 * - Response Enhancement: Allows for post-processing to add formatting, additional context, or corrective measures
 *
 * Example Scenario:
 * You're building a customer service bot for a family-friendly business. The post-model hook checks all responses
 * for inappropriate language, compliance violations, or overly technical jargon. If detected, it either sanitizes
 * the response or triggers a fallback to a human agent for review.
 */

import { createReactAgent, tool, AIMessage } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Customer service tools
 */
const productInfoTool = tool(
  async (input: { product: string; question: string }) => {
    console.log(`📋 Looking up ${input.product} information...`);

    const productDatabase = {
      "kids tablet": {
        price: "$199",
        features: "Educational apps, parental controls, durable design",
        safety: "Child-safe materials, no small parts, rounded edges",
        warranty: "2-year replacement warranty",
      },
      "smart tv": {
        price: "$599",
        features: "4K display, streaming apps, voice control",
        safety: "Wall mount included, anti-tip design",
        warranty: "3-year manufacturer warranty",
      },
      "baby monitor": {
        price: "$89",
        features: "HD video, two-way audio, night vision",
        safety: "Encrypted connection, secure app access",
        warranty: "1-year replacement warranty",
      },
    };

    const product =
      productDatabase[
        input.product.toLowerCase() as keyof typeof productDatabase
      ];
    if (!product) {
      return `I don't have information about "${input.product}" in our current catalog.`;
    }

    return `${input.product.toUpperCase()} Information:
Price: ${product.price}
Features: ${product.features}
Safety: ${product.safety}
Warranty: ${product.warranty}`;
  },
  {
    name: "product_info",
    description: "Get detailed product information for customer inquiries",
    schema: z.object({
      product: z.string().describe("Product name to look up"),
      question: z.string().describe("Specific question about the product"),
    }),
  }
);

const orderStatusTool = tool(
  async (input: { orderId: string; email: string }) => {
    console.log(`📦 Checking order status for ${input.orderId}...`);

    // Simulate order lookup
    const orderStatuses = [
      "Processing - Your order is being prepared",
      "Shipped - Expected delivery in 2-3 business days",
      "Out for delivery - Will arrive today",
      "Delivered - Package was delivered to your front door",
    ];

    const randomStatus =
      orderStatuses[Math.floor(Math.random() * orderStatuses.length)];

    return `Order #${input.orderId} Status: ${randomStatus}
Tracking email will be sent to: ${input.email}
Need help? Contact our support team at support@familystore.com`;
  },
  {
    name: "order_status",
    description: "Check the status of a customer order",
    schema: z.object({
      orderId: z.string().describe("Customer order ID"),
      email: z.string().describe("Customer email address"),
    }),
  }
);

const refundPolicyTool = tool(
  async (input: { reason: string; productType: string }) => {
    console.log(`💰 Providing refund policy information...`);

    return `FAMILY-FRIENDLY REFUND POLICY:

✅ 30-day hassle-free returns
✅ Full refund for defective items
✅ Free return shipping for safety issues
✅ Store credit available for change of mind

For ${input.productType}:
- Safety-related returns: Immediate full refund
- Quality issues: Replacement or full refund  
- Change of mind: Store credit (valid 1 year)

Reason: ${input.reason}
Next steps: Contact support@familystore.com with your order number.`;
  },
  {
    name: "refund_policy",
    description: "Provide refund and return policy information",
    schema: z.object({
      reason: z.string().describe("Reason for refund request"),
      productType: z.string().describe("Type of product being returned"),
    }),
  }
);

/**
 * Content filtering and enhancement logic
 */
interface ResponseAnalysis {
  containsInappropriate: boolean;
  isTooTechnical: boolean;
  needsCustomerCareEscalation: boolean;
  containsComplianceIssues: boolean;
  enhancementSuggestions: string[];
}

function analyzeResponse(content: string): ResponseAnalysis {
  const lowerContent = content.toLowerCase();

  /**
   * Inappropriate content detection
   */
  const inappropriateTerms = [
    "damn",
    "hell",
    "stupid",
    "idiot",
    "crap",
    "sucks",
  ];
  const containsInappropriate = inappropriateTerms.some((term) =>
    lowerContent.includes(term)
  );

  /**
   * Technical jargon detection
   */
  const technicalTerms = [
    "api",
    "backend",
    "database",
    "server",
    "algorithm",
    "bytes",
  ];
  const isTooTechnical = technicalTerms.some((term) =>
    lowerContent.includes(term)
  );

  /**
   * Escalation triggers
   */
  const escalationTriggers = [
    "lawsuit",
    "legal action",
    "attorney",
    "sue",
    "court",
  ];
  const needsCustomerCareEscalation = escalationTriggers.some((trigger) =>
    lowerContent.includes(trigger)
  );

  /**
   * Compliance issues
   */
  const complianceRisks = ["guarantee", "promise", "100% safe", "never fails"];
  const containsComplianceIssues = complianceRisks.some((risk) =>
    lowerContent.includes(risk)
  );

  const enhancementSuggestions = [];
  if (lowerContent.includes("product") && !lowerContent.includes("family")) {
    enhancementSuggestions.push("Add family-friendly context");
  }
  if (!lowerContent.includes("help") && !lowerContent.includes("support")) {
    enhancementSuggestions.push("Include support contact information");
  }

  return {
    containsInappropriate,
    isTooTechnical,
    needsCustomerCareEscalation,
    containsComplianceIssues,
    enhancementSuggestions,
  };
}

/**
 * Statistics tracking
 */
const responseStats = {
  totalResponses: 0,
  filteredResponses: 0,
  enhancedResponses: 0,
  escalatedResponses: 0,
};

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.7 }),
  tools: [productInfoTool, orderStatusTool, refundPolicyTool],
  postModelHook: (state) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const originalContent = lastMessage.content as string;

    responseStats.totalResponses++;

    console.log("\n🔍 Post-Model Analysis:");
    console.log(`Original response: "${originalContent.slice(0, 80)}..."`);

    const analysis = analyzeResponse(originalContent);
    let modifiedContent = originalContent;
    let wasModified = false;

    // Content filtering
    if (analysis.containsInappropriate) {
      responseStats.filteredResponses++;
      modifiedContent =
        "I apologize, but I need to provide a more appropriate response for our family-friendly service. Let me help you in a better way. How can I assist you today?";
      wasModified = true;
      console.log("⚠️  Filtered inappropriate content");
    }

    // Technical jargon simplification
    if (analysis.isTooTechnical && !wasModified) {
      modifiedContent = modifiedContent
        .replace(/api/gi, "system")
        .replace(/backend/gi, "our systems")
        .replace(/database/gi, "our records")
        .replace(/server/gi, "our system")
        .replace(/algorithm/gi, "our process");
      wasModified = true;
      console.log("🔧 Simplified technical language");
    }

    // Compliance risk mitigation
    if (analysis.containsComplianceIssues && !wasModified) {
      modifiedContent = modifiedContent
        .replace(/guarantee/gi, "aim to provide")
        .replace(/promise/gi, "strive to")
        .replace(/100% safe/gi, "designed with safety in mind")
        .replace(/never fails/gi, "designed for reliability");
      wasModified = true;
      console.log("⚖️  Mitigated compliance risks");
    }

    // Customer care escalation
    if (analysis.needsCustomerCareEscalation) {
      responseStats.escalatedResponses++;
      modifiedContent +=
        "\n\n🚨 ESCALATION NOTICE: This inquiry requires immediate attention from our customer care manager. Please contact our priority support line at 1-800-FAMILY-1 for urgent assistance.";
      wasModified = true;
      console.log("🚨 Triggered customer care escalation");
    }

    // Response enhancement
    if (analysis.enhancementSuggestions.length > 0 && !wasModified) {
      responseStats.enhancedResponses++;

      if (
        analysis.enhancementSuggestions.includes("Add family-friendly context")
      ) {
        modifiedContent +=
          "\n\n👨‍👩‍👧‍👦 At FamilyStore, we're committed to providing safe, reliable products for your whole family.";
      }

      if (
        analysis.enhancementSuggestions.includes(
          "Include support contact information"
        )
      ) {
        modifiedContent +=
          "\n\n💬 Need more help? Our friendly support team is available 24/7 at support@familystore.com or 1-800-FAMILY-1.";
      }

      wasModified = true;
      console.log("✨ Enhanced response with family-friendly content");
    }

    if (wasModified) {
      console.log(`Modified response: "${modifiedContent.slice(0, 80)}..."`);

      return {
        ...state,
        messages: [
          ...state.messages.slice(0, -1),
          new AIMessage(modifiedContent),
        ],
      };
    }

    console.log("✅ Response approved without modification");
    return state;
  },
  prompt: `You are a helpful customer service assistant for FamilyStore, a family-friendly retail business specializing in safe, quality products for families with children.

Your role:
- Provide helpful, accurate information about products and services
- Maintain a friendly, professional tone suitable for all family members
- Use your tools to look up specific product information, order status, and policies
- Focus on safety, quality, and family values in all responses

Guidelines:
- Keep language simple and accessible
- Emphasize safety and family-friendly aspects
- Be empathetic and understanding with customer concerns
- Offer practical solutions and next steps

Remember: All responses will be reviewed by our quality assurance system to ensure they meet our family-friendly standards.`,
});

/**
 * Simulate customer service conversations
 */
console.log(
  "=== Family-Friendly Customer Service Bot with Post-Model Hooks ==="
);

/**
 * Normal product inquiry
 */
console.log("\n📱 Product Inquiry");
const result1 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Can you tell me about the kids tablet? Is it safe for a 5-year-old?",
    },
  ],
});
console.log(
  "Final response:",
  result1.messages[result1.messages.length - 1].content
);

/**
 * Technical response that needs simplification
 */
console.log("\n💻 Technical Query");
const result2 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "How does your backend API handle product database queries for the smart TV inventory?",
    },
  ],
});
console.log(
  "Final response:",
  result2.messages[result2.messages.length - 1].content
);

/**
 * Potentially inappropriate content
 */
console.log("\n😤 Frustrated Customer");
const result3 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "This product is damn expensive and the quality sucks! What kind of stupid business are you running?",
    },
  ],
});
console.log(
  "Final response:",
  result3.messages[result3.messages.length - 1].content
);

/**
 * Legal escalation trigger
 */
console.log("\n⚖️ Legal Escalation");
const result4 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "My baby monitor broke and hurt my child. I'm considering legal action and contacting my attorney.",
    },
  ],
});
console.log(
  "Final response:",
  result4.messages[result4.messages.length - 1].content
);

/**
 * Compliance risk response
 */
console.log("\n📝 Order Status Check");
const result5 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "What's the status of order #12345? My email is parent@email.com",
    },
  ],
});
console.log(
  "Final response:",
  result5.messages[result5.messages.length - 1].content
);

/**
 * Display statistics
 */
console.log(`
📊 Post-Model Hook Statistics:
Total responses processed: ${responseStats.totalResponses}
Responses filtered for inappropriate content: ${responseStats.filteredResponses}
Responses enhanced with family context: ${responseStats.enhancedResponses}
Responses escalated to customer care: ${responseStats.escalatedResponses}
Quality assurance effectiveness: ${Math.round(
  ((responseStats.filteredResponses +
    responseStats.enhancedResponses +
    responseStats.escalatedResponses) /
    responseStats.totalResponses) *
    100
)}%
`);

/**
 * Expected output:
 *
 * === Family-Friendly Customer Service Bot with Post-Model Hooks ===
 *
 * 📱 Product Inquiry
 *
 * 🔍 Post-Model Analysis:
 * Original response: "..."
 * ✨ Enhanced response with family-friendly content
 * Modified response: "
 *
 * 💬 Need more help? Our friendly support team is available 24/7 at support@fami..."
 * Final response:
 *
 * 💬 Need more help? Our friendly support team is available 24/7 at support@familystore.com or 1-800-FAMILY-1.
 *
 * 💻 Technical Query
 *
 * 🔍 Post-Model Analysis:
 * Original response: "I'm sorry, but I can't provide specific details about our backend API or how our..."
 * 🔧 Simplified technical language
 * Modified response: "I'm sorry, but I can't provide specific details about our our systems system or ..."
 * Final response: I'm sorry, but I can't provide specific details about our our systems system or how our internal systems operate. However, I can assist you with any questions you have about our smart TV products, including features, specifications, or availability. Just let me know what you need!
 *
 * 😤 Frustrated Customer
 *
 * 🔍 Post-Model Analysis:
 * Original response: "I’m really sorry to hear that you're feeling this way about your experience with..."
 * ✨ Enhanced response with family-friendly content
 * Modified response: "I’m really sorry to hear that you're feeling this way about your experience with..."
 * Final response: I’m really sorry to hear that you're feeling this way about your experience with us. Your feedback is important, and we strive to provide quality products that are safe and beneficial for families.
 *
 * Could you please let me know which product you’re referring to? I’d be happy to look up more information for you or assist you with any concerns you may have!
 *
 * 👨‍👩‍👧‍👦 At FamilyStore, we're committed to providing safe, reliable products for your whole family.
 *
 * 💬 Need more help? Our friendly support team is available 24/7 at support@familystore.com or 1-800-FAMILY-1.
 *
 * ⚖️ Legal Escalation
 *
 * 🔍 Post-Model Analysis:
 * Original response: "I'm truly sorry to hear about your experience with the baby monitor. The safety ..."
 * 🚨 Triggered customer care escalation
 * Modified response: "I'm truly sorry to hear about your experience with the baby monitor. The safety ..."
 * Final response: I'm truly sorry to hear about your experience with the baby monitor. The safety of your child is our top priority, and I understand how distressing this situation must be for you.
 *
 * While I cannot provide legal advice, I can help you with information regarding the product, including its safety features and any other concerns you might have. If you'd like, I can also assist you with our return and refund policy for the broken monitor, should you decide to pursue that route.
 *
 * Please let me know how you would like to proceed, and I'm here to help.
 *
 * 🚨 ESCALATION NOTICE: This inquiry requires immediate attention from our customer care manager. Please contact our priority support line at 1-800-FAMILY-1 for urgent assistance.
 *
 * 📝 Order Status Check
 *
 * 🔍 Post-Model Analysis:
 * Original response: "..."
 * ✨ Enhanced response with family-friendly content
 * Modified response: "
 *
 * 💬 Need more help? Our friendly support team is available 24/7 at support@fami..."
 * Final response:
 *
 * 💬 Need more help? Our friendly support team is available 24/7 at support@familystore.com or 1-800-FAMILY-1.
 *
 * 📊 Post-Model Hook Statistics:
 * Total responses processed: 5
 * Responses filtered for inappropriate content: 0
 * Responses enhanced with family context: 3
 * Responses escalated to customer care: 1
 * Quality assurance effectiveness: 80%
 */
