/**
 * Update Long Term Memory in Tools
 *
 * This enables tools to persist information to long-term memory stores, allowing them to contribute to the
 * agent's growing knowledge base and learned experiences.
 *
 * Why this is important:
 * - Knowledge Accumulation: Tools can contribute to the agent's learning by storing important findings and experiences
 * - Cross-Session Learning: Information gathered in one session becomes available for future interactions
 * - Continuous Improvement: Enables the agent system to become more knowledgeable and effective over time
 *
 * Example Scenario:
 * You're building a sales assistant that learns about customer preferences during conversations. When a customer
 * mentions "I prefer eco-friendly products", the tool stores this preference in long-term memory so future
 * interactions with this customer can emphasize sustainable options automatically.
 */

import {
  createReactAgent,
  tool,
  InMemoryStore,
  type CreateReactAgentToolConfig,
} from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Initialize long-term memory store (LangGraph primitive)
 */
const store = new InMemoryStore();

/**
 * Product database
 */
const productDatabase = {
  laptops: [
    {
      name: "EcoBook Pro",
      eco: true,
      price: "$1299",
      features: "100% recycled materials, solar charging",
    },
    {
      name: "PowerMax Elite",
      eco: false,
      price: "$1899",
      features: "High performance, gaming optimized",
    },
    {
      name: "GreenTech Slim",
      eco: true,
      price: "$899",
      features: "Energy efficient, biodegradable packaging",
    },
  ],
  phones: [
    {
      name: "EcoPhone X",
      eco: true,
      price: "$799",
      features: "Sustainable manufacturing, long battery life",
    },
    {
      name: "TechPhone Pro",
      eco: false,
      price: "$1199",
      features: "Latest processor, premium build",
    },
    {
      name: "GreenCall",
      eco: true,
      price: "$599",
      features: "Fair trade materials, repairable design",
    },
  ],
  accessories: [
    {
      name: "Solar Charger",
      eco: true,
      price: "$89",
      features: "Solar powered, portable",
    },
    {
      name: "Premium Case",
      eco: false,
      price: "$49",
      features: "Luxury leather, premium protection",
    },
    {
      name: "Bamboo Stand",
      eco: true,
      price: "$29",
      features: "Sustainable bamboo, ergonomic design",
    },
  ],
};

interface CustomerPreference {
  preference: string;
  context: string;
  timestamp: string;
}

interface MarketInsight {
  insight: string;
  category: string;
  confidence: string;
  timestamp: string;
}

/**
 * Customer relationship management tool that learns preferences
 */
const customerPreferencesTool = tool(
  async (input, config: CreateReactAgentToolConfig) => {
    console.log(`💾 Storing customer preference for ${input.customerId}...`);

    const key = input.customerId;
    const existing = await config.store?.get(["customer_preferences"], key);
    const items = (existing?.value as CustomerPreference[]) || [];
    items.push({
      preference: input.preference,
      context: input.context,
      timestamp: new Date().toISOString(),
    });
    await config.store?.put(["customer_preferences"], key, items);

    return `✅ Stored preference for customer ${input.customerId}: "${input.preference}" (Context: ${input.context})`;
  },
  {
    name: "store_customer_preference",
    description:
      "Store customer preferences and requirements in long-term memory",
    schema: z.object({
      customerId: z.string().describe("Unique customer identifier"),
      preference: z.string().describe("Customer preference or requirement"),
      context: z
        .string()
        .describe("Context or situation where this preference was mentioned"),
    }),
  }
);

/**
 * Product recommendation tool that uses stored preferences
 */
const productRecommendationTool = tool(
  async (input, config: CreateReactAgentToolConfig) => {
    console.log(
      `🔍 Looking up preferences for customer ${input.customerId}...`
    );

    const storeInstance = config.store ?? store;
    const existing = await storeInstance.get(
      ["customer_preferences"],
      input.customerId
    );
    const customerPreferences = (existing?.value as CustomerPreference[]) || [];

    const products =
      productDatabase[
        input.productCategory.toLowerCase() as keyof typeof productDatabase
      ] || [];

    if (customerPreferences.length > 0) {
      console.log(
        `📋 Found ${customerPreferences.length} stored preferences for customer ${input.customerId}`
      );

      // Check if customer prefers eco-friendly products
      const prefersEco = customerPreferences.some((pref) =>
        `${pref.preference} ${pref.context}`
          .toLowerCase()
          .match(/eco|sustainable|environment/)
      );

      // Check if customer is budget-conscious
      const budgetConscious = customerPreferences.some((pref) =>
        `${pref.preference} ${pref.context}`
          .toLowerCase()
          .match(/budget|affordable|cheap/)
      );

      let recommendations = products;
      let reasoning = "Based on your stored preferences:\n";

      // Filter and sort based on preferences
      if (prefersEco) {
        recommendations = products.filter((p) => p.eco);
        reasoning +=
          "- ✅ Showing eco-friendly options (you mentioned environmental concerns)\n";
      }

      if (budgetConscious) {
        recommendations = recommendations.sort(
          (a, b) =>
            parseInt(a.price.replace(/[$,]/g, ""), 10) -
            parseInt(b.price.replace(/[$,]/g, ""), 10)
        );
        reasoning +=
          "- 💰 Sorted by price (you mentioned budget considerations)\n";
      }

      const preferenceDetails = customerPreferences
        .map((pref) => `  • ${pref.context || pref.preference}`)
        .join("\n");

      return `🎯 PERSONALIZED RECOMMENDATIONS for Customer ${input.customerId}

${reasoning}

Your stored preferences:
${preferenceDetails}

Recommended ${input.productCategory}:
${recommendations
  .slice(0, 2)
  .map(
    (product) =>
      `📱 ${product.name} - ${product.price}
     Features: ${product.features}
     ${product.eco ? "🌱 Eco-friendly" : "⚡ High-performance"}`
  )
  .join("\n\n")}

${
  recommendations.length === 0
    ? "No products match your specific preferences. Consider our full catalog."
    : ""
}`;
    } else {
      console.log(
        `❌ No stored preferences found for customer ${input.customerId}`
      );
      return `📋 GENERAL RECOMMENDATIONS for Customer ${input.customerId}

We don't have specific preferences stored for you yet. Here are our popular ${
        input.productCategory
      }:

${products
  .slice(0, 2)
  .map(
    (product) =>
      `📱 ${product.name} - ${product.price}
     Features: ${product.features}
     ${product.eco ? "🌱 Eco-friendly" : "⚡ High-performance"}`
  )
  .join("\n\n")}

💡 Tip: Let me know your preferences so I can provide more personalized recommendations in the future!`;
    }
  },
  {
    name: "recommend_products",
    description:
      "Provide personalized product recommendations based on stored customer preferences",
    schema: z.object({
      customerId: z
        .string()
        .describe("Customer identifier to lookup preferences"),
      productCategory: z
        .string()
        .describe("Product category (laptops, phones, accessories)"),
    }),
  }
);

/**
 * Market research tool that accumulates insights
 */
const marketInsightTool = tool(
  async (input, config: CreateReactAgentToolConfig) => {
    console.log(
      `📊 Recording market insight: ${input.insight.slice(0, 50)}...`
    );

    const storeInstance = config.store ?? store;
    const key = input.category;
    const existing = await storeInstance.get(["market_insights"], key);
    const insights = (existing?.value as MarketInsight[]) || [];
    insights.push({
      insight: input.insight,
      category: input.category,
      confidence: input.confidence,
      timestamp: new Date().toISOString(),
    });
    await storeInstance.put(["market_insights"], key, insights);

    const relatedInsights = insights.slice(-3); // recent related

    let analysis = `📈 MARKET INSIGHT RECORDED
Category: ${input.category}
Confidence: ${input.confidence}
Insight: ${input.insight}`;

    if (relatedInsights.length > 0) {
      analysis += `\n\n🔗 Related insights already in memory:`;
      relatedInsights.forEach((insight, index) => {
        analysis += `\n  ${index + 1}. ${insight.insight}`;
      });

      analysis += `\n\n💡 Total insights in "${input.category}" category: ${insights.length}`;
    }

    return analysis;
  },
  {
    name: "record_market_insight",
    description:
      "Record market insights and trends for future reference and pattern analysis",
    schema: z.object({
      insight: z.string().describe("Market insight or trend observation"),
      category: z
        .string()
        .describe("Category (technology, consumer_behavior, pricing, etc.)"),
      confidence: z.string().describe("Confidence level (high, medium, low)"),
    }),
  }
);

/**
 * Meeting notes tool that stores key decisions and actions
 */
const meetingNotesTool = tool(
  async (input, config: CreateReactAgentToolConfig) => {
    console.log(`📝 Storing meeting notes for: ${input.meeting}...`);

    const storeInstance = config.store ?? store;
    const key = input.meeting;
    const note = {
      meeting: input.meeting,
      keyDecisions: input.keyDecisions,
      actionItems: input.actionItems,
      attendees: input.attendees.split(",").map((a) => a.trim()),
      timestamp: new Date().toISOString(),
    };
    await storeInstance.put(["meeting_notes"], key, note);

    // Maintain a simple meeting index
    const index =
      (await storeInstance.get(["meeting_index"], "all"))?.value || [];
    if (!index.includes(key)) {
      index.push(key);
      await storeInstance.put(["meeting_index"], "all", index);
    }

    const relatedMeetings: string[] = index
      .filter((m: string) => m !== key)
      .slice(-2);

    let summary = `📋 MEETING NOTES STORED
Meeting: ${input.meeting}
Attendees: ${input.attendees}

✅ Key Decisions:
${input.keyDecisions}

🎯 Action Items:
${input.actionItems}`;

    if (relatedMeetings.length > 0) {
      summary += `\n\n🔗 Related meetings found:`;
      relatedMeetings.forEach((meeting, i) => {
        const meetingName = meeting || "Unknown Meeting";
        summary += `\n  ${i + 1}. ${meetingName}`;
      });
    }

    return summary;
  },
  {
    name: "store_meeting_notes",
    description:
      "Store meeting notes, decisions, and action items for future reference",
    schema: z.object({
      meeting: z.string().describe("Meeting name or purpose"),
      keyDecisions: z
        .string()
        .describe("Important decisions made during the meeting"),
      actionItems: z.string().describe("Action items and next steps"),
      attendees: z.string().describe("Meeting attendees (comma-separated)"),
    }),
  }
);

/**
 * Memory statistics tracking
 */
const memoryStats = {
  documentsStored: 0,
  retrievalCount: 0,
  categories: new Set<string>(),
};

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.3 }),
  tools: [
    customerPreferencesTool,
    productRecommendationTool,
    marketInsightTool,
    meetingNotesTool,
  ],
  postModelHook: (state) => {
    // Track memory usage statistics
    const lastMessage = state.messages[state.messages.length - 1];
    const content = lastMessage.content as string;

    if (
      content.includes("Stored preference") ||
      content.includes("INSIGHT RECORDED") ||
      content.includes("MEETING NOTES STORED")
    ) {
      memoryStats.documentsStored += 1;
    }

    if (content.includes("Found") && content.includes("stored preferences")) {
      memoryStats.retrievalCount += 1;
    }

    return state;
  },
  prompt: `You are an intelligent business assistant with long-term memory capabilities. You can learn and remember information across conversations to provide increasingly personalized and effective assistance.

Your capabilities:
- Store customer preferences and requirements for personalized service
- Record market insights and trends for strategic analysis
- Capture meeting notes with decisions and action items
- Provide recommendations based on accumulated knowledge

When interacting with customers or processing information:
1. Always look for opportunities to learn and store useful information
2. Use stored knowledge to provide more personalized responses
3. Record insights, preferences, and important decisions for future reference
4. Build upon previously stored information to provide better assistance

Remember: The more you learn and store, the more valuable you become over time!`,
});

/**
 * Simulate business interactions with memory accumulation
 */
console.log("=== Business Assistant with Long-Term Memory Updates ===");

/**
 * First customer interaction - learning preferences
 */
console.log("\n👤 New Customer Interaction");
const result1 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Hi, I'm customer CUST001. I'm looking for a laptop but I really care about environmental impact. I want something eco-friendly and sustainable.",
    },
  ],
});
console.log("Response:", result1.messages[result1.messages.length - 1].content);

/**
 * Same customer returns - using stored preferences
 */
console.log("\n🔄 Returning Customer");
const result2 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "It's customer CUST001 again. Can you recommend some laptops for me?",
    },
  ],
});
console.log("Response:", result2.messages[result2.messages.length - 1].content);

/**
 * Market research input
 */
console.log("\n📊 Market Research Input");
const result3 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "I've noticed that 70% of our customers under 30 are specifically asking about sustainable tech products. This seems to be a strong trend in the technology category. I have high confidence in this observation.",
    },
  ],
});
console.log("Response:", result3.messages[result3.messages.length - 1].content);

/**
 * Second customer with budget preference
 */
console.log("\n💰 Budget-Conscious Customer");
const result4 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Hi, I'm customer CUST002. I need a new phone but I'm on a tight budget. I need something affordable and good value for money.",
    },
  ],
});
console.log("Response:", result4.messages[result4.messages.length - 1].content);

/**
 * Meeting notes capture
 */
console.log("\n📅 Meeting Notes");
const result5 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Please store notes from our Product Strategy Meeting. Key decisions: Launch eco-friendly laptop line in Q2, increase sustainable product marketing budget by 40%. Action items: Research biodegradable packaging options, contact sustainable suppliers, schedule customer focus groups on green tech. Attendees: Sarah Johnson, Mike Chen, Lisa Rodriguez, Tom Wilson.",
    },
  ],
});
console.log("Response:", result5.messages[result5.messages.length - 1].content);

/**
 * Budget customer returns
 */
console.log("\n📱 Budget Customer Returns");
const result6 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Customer CUST002 here again. Now I'm also looking for accessories to go with my phone. What do you recommend?",
    },
  ],
});
console.log("Response:", result6.messages[result6.messages.length - 1].content);

/**
 * Additional market insight
 */
console.log("\n📈 Additional Market Insight");
const result7 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Another insight: customers are willing to pay 15-25% premium for products with sustainable certifications. This is particularly true in the consumer behavior category. Medium confidence level.",
    },
  ],
});
console.log("Response:", result7.messages[result7.messages.length - 1].content);

/**
 * Display memory statistics
 */
console.log(`
📊 Long-Term Memory Statistics:
Documents stored: ${memoryStats.documentsStored}
Knowledge retrievals: ${memoryStats.retrievalCount}
Learning effectiveness: ${
  memoryStats.documentsStored > 0 ? "Active" : "Inactive"
}
Memory utilization: ${memoryStats.retrievalCount > 0 ? "High" : "Low"}

💡 The agent is continuously learning and improving its responses based on accumulated knowledge!
`);

/**
 * Example Output:
 * 
 * === Business Assistant with Long-Term Memory Updates ===
 *
 * 👤 New Customer Interaction
 * 💾 Storing customer preference for CUST001...
 * 🔍 Looking up preferences for customer CUST001...
 * ❌ No stored preferences found for customer CUST001
 * Response: I've noted your preference for an eco-friendly and sustainable laptop. Here are some recommendations that align with your values:
 *
 * 1. **EcoBook Pro** - $1299
 *    - Features: Made from 100% recycled materials, solar charging
 *    - Eco-friendly

 * 2. **PowerMax Elite** - $1899
 *    - Features: High performance, gaming optimized
 *    - High-performance (not specifically eco-friendly)

 * If you have any specific features or brands in mind, please let me know, and I can refine the recommendations further!
 *
 * 🔄 Returning Customer
 * 🔍 Looking up preferences for customer CUST001...
 * 📋 Found 1 stored preferences for customer CUST001
 * Response: Here are some laptop recommendations for you, focusing on eco-friendly options:
 *
 * 1. **EcoBook Pro - $1299**
 *    - Features: 100% recycled materials, solar charging
 *    - 🌱 Eco-friendly
 *
 * 2. **GreenTech Slim - $899**
 *    - Features: Energy efficient, biodegradable packaging
 *    - 🌱 Eco-friendly
 *
 * Let me know if you need more information or if there's anything else I can assist you with!
 *
 * 📊 Market Research Input
 * 📊 Recording market insight: 70% of customers under 30 are specifically asking ...
 * Response: I've recorded your observation about the strong trend of sustainable tech products among customers under 30, with high confidence. This insight will be useful for future strategic analysis and product recommendations. If you have any further insights or trends to share, feel free to let me know!
 *
 * 💰 Budget-Conscious Customer
 * 💾 Storing customer preference for CUST002...
 * 🔍 Looking up preferences for customer CUST002...
 * ❌ No stored preferences found for customer CUST002
 * Response: I've noted your preference for an affordable phone that offers good value for money. Here are some popular phone options, though they may not fit your budget:
 *
 * 1. **EcoPhone X** - $799
 *    - Features: Sustainable manufacturing, long battery life
 *    - Eco-friendly
 *
 * 2. **TechPhone Pro** - $1199
 *    - Features: Latest processor, premium build
 *    - High-performance
 *
 * Since these options are above your budget, I recommend considering brands known for budget-friendly phones, such as Xiaomi, Motorola, or Samsung's A series. If you have any specific brands or features in mind, please let me know, and I can refine my recommendations!
 *
 * 📅 Meeting Notes
 * 📝 Storing meeting notes for: Product Strategy Meeting...
 * Response: The notes from the Product Strategy Meeting have been successfully stored. Here’s a summary:
 *
 * **Meeting:** Product Strategy Meeting  
 * **Attendees:** Sarah Johnson, Mike Chen, Lisa Rodriguez, Tom Wilson  
 *
 * **Key Decisions:**  
 * - Launch eco-friendly laptop line in Q2  
 * - Increase sustainable product marketing budget by 40%  
 *
 * **Action Items:**  
 * - Research biodegradable packaging options  
 * - Contact sustainable suppliers  
 * - Schedule customer focus groups on green tech  
 *
 * If you need anything else or want to add more details, just let me know!
 *
 * 📱 Budget Customer Returns
 * 🔍 Looking up preferences for customer CUST002...
 * 📋 Found 1 stored preferences for customer CUST002
 * Response: Here are some recommended accessories for your phone, keeping your budget in mind:
 *
 * 1. **Bamboo Stand - $29**
 *    - Features: Sustainable bamboo, ergonomic design
 *    - 🌱 Eco-friendly option
 *
 * 2. **Premium Case - $49**
 *    - Features: Luxury leather, premium protection
 *    - ⚡ High-performance option
 *
 * Let me know if you'd like more information on any of these or if you have other preferences!
 *
 * 📈 Additional Market Insight
 * 📊 Recording market insight: Customers are willing to pay 15-25% premium for pr...
 * Response: The market insight regarding customers' willingness to pay a 15-25% premium for products with sustainable certifications has been recorded successfully. This insight falls under the consumer behavior category and has a medium confidence level. 
 *
 * If you have any more insights or need assistance with anything else, feel free to share!
 *
 * 📊 Long-Term Memory Statistics:
 * Documents stored: 0
 * Knowledge retrievals: 0
 * Learning effectiveness: Inactive
 * Memory utilization: Low
 *
 * 💡 The agent is continuously learning and improving its responses based on accumulated knowledge!
 */
