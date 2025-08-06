/**
 * Update Tools Before Model Call
 *
 * This feature allows dynamic modification of the available tool set before each model invocation, enabling
 * context-sensitive tool availability and adaptive functionality.
 *
 * Why this is important:
 * - Adaptive Tool Selection:
 *   Ensures only relevant tools are available based on current context, improving model focus and performance
 * - Security and Access Control:
 *   Dynamically restrict tool access based on user permissions or conversation state
 * - Performance Optimization:
 *   Reduces cognitive load on the model by presenting only contextually appropriate tools
 *
 * Example Scenario:
 * You're building a financial advisor assistant with tools for both investment advice and tax calculations. When
 * users are discussing retirement planning, you only expose investment-related tools. When they're discussing tax
 * season, you only show tax calculation tools, preventing confusion and improving response focus.
 */

import { createReactAgent, tool, DynamicStructuredTool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

// User permission levels and context tracking
interface UserContext {
  userId: string;
  permissionLevel: "basic" | "premium" | "admin";
  currentTopic?: "investment" | "tax" | "general";
  sessionQueries: string[];
}

const userContext: UserContext = {
  userId: "user_123",
  permissionLevel: "basic",
  sessionQueries: [],
};

/**
 * Investment advice tool (premium feature)
 */
const investmentAdviceTool = tool(
  async (input: { portfolio: string; riskTolerance: string }) => {
    console.log("🏦 Investment advice tool called");

    const advice = `Investment Analysis for ${input.portfolio}:
- Risk Level: ${input.riskTolerance}
- Recommendation: Diversify across index funds and bonds
- Expected Return: 7-9% annually for moderate risk
- Suggested allocation: 70% stocks, 30% bonds`;

    return advice;
  },
  {
    name: "investment_advice",
    description:
      "Provides personalized investment recommendations (Premium feature)",
    schema: z.object({
      portfolio: z.string().describe("Current portfolio description"),
      riskTolerance: z
        .string()
        .describe("Risk tolerance level (low/medium/high)"),
    }),
  }
);

/**
 * Tax calculation tool (basic feature)
 */
const taxCalculationTool = tool(
  async (input: { income: number; deductions: number }) => {
    console.log("📊 Tax calculation tool called");

    const taxableIncome = Math.max(0, input.income - input.deductions);
    const estimatedTax = taxableIncome * 0.22; // Simplified 22% rate

    return `Tax Calculation Results:
- Gross Income: $${input.income.toLocaleString()}
- Deductions: $${input.deductions.toLocaleString()}
- Taxable Income: $${taxableIncome.toLocaleString()}
- Estimated Tax: $${estimatedTax.toLocaleString()}`;
  },
  {
    name: "tax_calculation",
    description: "Calculate estimated taxes based on income and deductions",
    schema: z.object({
      income: z.number().describe("Annual gross income"),
      deductions: z.number().describe("Total deductions"),
    }),
  }
);

/**
 * Premium portfolio analysis tool (admin only)
 */
const portfolioAnalysisTool = tool(
  async (input: { holdings: string[] }) => {
    console.log("📈 Portfolio analysis tool called (Admin feature)");

    const analysis = `Advanced Portfolio Analysis:
Holdings: ${input.holdings.join(", ")}

- Diversification Score: 8.5/10
- Risk-Adjusted Return: 12.3%
- Sharpe Ratio: 1.8
- Beta: 1.05
- Maximum Drawdown: -15%

Recommendations:
- Consider rebalancing quarterly
- Add international exposure
- Reduce sector concentration`;

    return analysis;
  },
  {
    name: "portfolio_analysis",
    description:
      "Advanced portfolio analysis with detailed metrics (Admin only)",
    schema: z.object({
      holdings: z.array(z.string()).describe("List of portfolio holdings"),
    }),
  }
);

/**
 * General financial calculator (always available)
 */
const financialCalculatorTool = tool(
  async (input: {
    calculation: string;
    amount: number;
    rate?: number;
    years?: number;
  }) => {
    console.log("🧮 Financial calculator tool called");

    let result = "";

    switch (input.calculation) {
      case "compound_interest":
        if (input.rate && input.years) {
          const futureValue =
            input.amount * (1 + input.rate / 100) ** input.years;
          result = `Compound Interest Calculation:
- Principal: $${input.amount.toLocaleString()}
- Rate: ${input.rate}% annually
- Time: ${input.years} years
- Future Value: $${futureValue.toLocaleString()}`;
        } else {
          result =
            "Please provide rate and years for compound interest calculation";
        }
        break;
      case "monthly_savings":
        if (input.rate && input.years) {
          const monthlyRate = input.rate / 100 / 12;
          const numPayments = input.years * 12;
          // Future value of annuity formula
          const futureValue =
            input.amount *
            (((1 + monthlyRate) ** numPayments - 1) / monthlyRate);
          result = `Monthly Savings Calculation:
- Monthly Payment: $${input.amount.toLocaleString()}
- Annual Interest Rate: ${input.rate}%
- Time: ${input.years} years
- Total Future Value: $${futureValue.toLocaleString()}
- Total Contributions: $${(input.amount * numPayments).toLocaleString()}
- Interest Earned: $${(
            futureValue -
            input.amount * numPayments
          ).toLocaleString()}`;
        } else {
          result =
            "Please provide rate and years for monthly savings calculation";
        }
        break;
      case "monthly_payment":
        if (input.rate && input.years) {
          const monthlyRate = input.rate / 100 / 12;
          const numPayments = input.years * 12;
          const monthlyPayment =
            (input.amount * (monthlyRate * (1 + monthlyRate) ** numPayments)) /
            ((1 + monthlyRate) ** numPayments - 1);
          result = `Loan Payment Calculation:
- Loan Amount: $${input.amount.toLocaleString()}
- Interest Rate: ${input.rate}% annually
- Term: ${input.years} years
- Monthly Payment: $${monthlyPayment.toLocaleString()}`;
        } else {
          result = "Please provide rate and years for loan payment calculation";
        }
        break;
      default:
        result =
          "Available calculations: compound_interest, monthly_savings, monthly_payment";
    }

    return result;
  },
  {
    name: "financial_calculator",
    description: "Perform various financial calculations",
    schema: z.object({
      calculation: z
        .string()
        .describe(
          "Type of calculation (compound_interest, monthly_savings, monthly_payment)"
        ),
      amount: z.number().describe("Principal amount or loan amount"),
      rate: z.number().optional().describe("Interest rate percentage"),
      years: z.number().optional().describe("Number of years"),
    }),
  }
);

/**
 * Create agent with dynamic tool filtering based on user context
 */
function createFinancialAgent() {
  // Determine available tools based on current user context
  const availableTools: DynamicStructuredTool[] = [financialCalculatorTool];

  if (
    userContext.permissionLevel === "premium" ||
    userContext.permissionLevel === "admin"
  ) {
    availableTools.push(investmentAdviceTool, taxCalculationTool);
  }

  if (userContext.permissionLevel === "admin") {
    availableTools.push(portfolioAnalysisTool);
  }

  return createReactAgent({
    llm,
    tools: availableTools,
    preModelHook: (state) => {
      console.log("\n🔧 Pre-model hook: Analyzing context...");

      /**
       * Analyze the latest message to determine context
       */
      const lastMessage = state.messages[state.messages.length - 1];
      const messageContent = (lastMessage.content as string).toLowerCase();

      /**
       * Track user queries for context
       */
      userContext.sessionQueries.push(messageContent);

      /**
       * Determine current topic from message content
       */
      if (
        messageContent.includes("invest") ||
        messageContent.includes("portfolio") ||
        messageContent.includes("stock")
      ) {
        userContext.currentTopic = "investment";
      } else if (
        messageContent.includes("tax") ||
        messageContent.includes("deduction") ||
        messageContent.includes("irs")
      ) {
        userContext.currentTopic = "tax";
      } else {
        userContext.currentTopic = "general";
      }

      console.log(
        `🛠️  Available tools: ${availableTools
          .map((tool) => tool.name)
          .join(", ")}`
      );
      console.log(
        `👤 User level: ${userContext.permissionLevel}, Topic: ${userContext.currentTopic}`
      );

      return state;
    },
    prompt: `You are a financial advisor assistant with access to various financial tools.

Your available tools depend on the user's subscription level:

BASIC users have access to:
- financial_calculator: Basic financial calculations only

PREMIUM users additionally have:
- investment_advice: Personalized investment recommendations
- tax_calculation: Tax estimation tools

ADMIN users have access to all tools including:
- portfolio_analysis: Advanced portfolio analytics with detailed metrics

Current user subscription level: ${userContext.permissionLevel.toUpperCase()}

Based on your subscription level, provide helpful financial guidance using the available tools. Always be clear about what features are available at your current subscription level.`,
  });
}

/**
 * Simulate different user permission levels and contexts
 */

async function simulateUserInteraction(
  permissionLevel: "basic" | "premium" | "admin",
  query: string
) {
  userContext.permissionLevel = permissionLevel;
  userContext.sessionQueries = [];

  console.log(`\n=== ${permissionLevel.toUpperCase()} User Session ===`);
  console.log(`Query: "${query}"`);

  // Create agent with tools appropriate for this user's permission level
  const agent = createFinancialAgent();

  const result = await agent.invoke({
    messages: [{ role: "user", content: query }],
  });

  console.log(
    "\nResponse:",
    result.messages[result.messages.length - 1].content
  );
  return result;
}

console.log("=== Financial Advisor with Dynamic Tool Selection ===");

/**
 * Demonstrate basic user with investment query
 */
await simulateUserInteraction(
  "basic",
  "I want to invest $10,000. What should I do?"
);

/**
 * Demonstrate premium user with investment query
 */
await simulateUserInteraction(
  "premium",
  "I have a portfolio of tech stocks and want investment advice for moderate risk tolerance"
);

/**
 * Demonstrate admin user with portfolio analysis
 */
await simulateUserInteraction(
  "admin",
  "Please analyze my portfolio: AAPL, GOOGL, MSFT, SPY, BND"
);

/**
 * Demonstrate tax context switching
 */
await simulateUserInteraction(
  "premium",
  "I earned $75,000 this year with $12,000 in deductions. What are my taxes?"
);

/**
 * Demonstrate general financial calculation
 */
await simulateUserInteraction(
  "basic",
  "If I save $500 per month at 5% interest, how much will I have in 10 years?"
);

/**
 * Expected output demonstrates dynamic tool filtering:
 *
 * === Financial Advisor with Dynamic Tool Selection ===
 *
 * === BASIC User Session ===
 * Query: "I want to invest $10,000. What should I do?"
 *
 * 🔧 Pre-model hook: Analyzing context...
 * 🛠️  Available tools: financial_calculator
 * 👤 User level: basic, Topic: investment
 *
 * Response: As a BASIC user, I can assist you with basic financial calculations. However, I don't have access
 * to personalized investment recommendations or advanced portfolio analysis tools.
 *
 * If you're interested in understanding how your investment might grow over time, I can help you calculate
 * potential compound interest. Would you like to see how your $10,000 investment could grow with a specific
 * interest rate and time period? If so, please provide the interest rate and the number of years you're considering
 * for the investment.
 *
 * === PREMIUM User Session ===
 * Query: "I have a portfolio of tech stocks and want investment advice for moderate risk tolerance"
 *
 * 🔧 Pre-model hook: Analyzing context...
 * 🛠️  Available tools: financial_calculator, investment_advice, tax_calculation
 * 👤 User level: premium, Topic: investment
 * 🏦 Investment advice tool called
 *
 * 🔧 Pre-model hook: Analyzing context...
 * 🛠️  Available tools: financial_calculator, investment_advice, tax_calculation
 * 👤 User level: premium, Topic: investment
 *
 * Response: Based on your current portfolio of tech stocks and a moderate risk tolerance, here are some investment recommendations:
 *
 * - **Diversification**: It's advisable to diversify your portfolio by including index funds and bonds. This can help mitigate risk while still aiming for growth.
 * - **Expected Return**: With a moderate risk level, you can expect an annual return of approximately 7-9%.
 * - **Suggested Allocation**: Consider allocating 70% of your portfolio to stocks and 30% to bonds. This balance can provide growth potential while offering some stability through bonds.
 *
 * These adjustments can help align your portfolio with your risk tolerance and investment goals.
 *
 * === ADMIN User Session ===
 * Query: "Please analyze my portfolio: AAPL, GOOGL, MSFT, SPY, BND"
 *
 * 🔧 Pre-model hook: Analyzing context...
 * 🛠️  Available tools: financial_calculator, investment_advice, tax_calculation, portfolio_analysis
 * 👤 User level: admin, Topic: investment
 * 📈 Portfolio analysis tool called (Admin feature)
 *
 * 🔧 Pre-model hook: Analyzing context...
 * 🛠️  Available tools: financial_calculator, investment_advice, tax_calculation, portfolio_analysis
 * 👤 User level: admin, Topic: investment
 *
 * Response: Here's the advanced analysis of your portfolio consisting of AAPL, GOOGL, MSFT, SPY, and BND:
 *
 * - **Diversification Score**: 8.5/10, indicating a well-diversified portfolio.
 * - **Risk-Adjusted Return**: 12.3%, suggesting a strong return relative to the risk taken.
 * - **Sharpe Ratio**: 1.8, which is considered good, indicating that the portfolio is generating a good return per unit of risk.
 * - **Beta**: 1.05, showing that the portfolio's volatility is slightly higher than the market.
 * - **Maximum Drawdown**: -15%, reflecting the largest peak-to-trough decline.
 *
 * **Recommendations**:
 * - Consider rebalancing your portfolio quarterly to maintain your desired asset allocation.
 * - Add international exposure to further diversify and potentially enhance returns.
 * - Reduce sector concentration to minimize risk associated with specific sectors.
 *
 * If you have any more questions or need further assistance, feel free to ask!
 *
 * === PREMIUM User Session ===
 * Query: "I earned $75,000 this year with $12,000 in deductions. What are my taxes?"
 *
 * 🔧 Pre-model hook: Analyzing context...
 * 🛠️  Available tools: financial_calculator, investment_advice, tax_calculation
 * 👤 User level: premium, Topic: tax
 * 📊 Tax calculation tool called
 *
 * 🔧 Pre-model hook: Analyzing context...
 * 🛠️  Available tools: financial_calculator, investment_advice, tax_calculation
 * 👤 User level: premium, Topic: tax
 *
 * Response: Based on your annual gross income of $75,000 and deductions totaling $12,000, your taxable income is $63,000. The estimated tax you would owe is approximately $13,860.
 *
 * === BASIC User Session ===
 * Query: "If I save $500 per month at 5% interest, how much will I have in 10 years?"
 *
 * 🔧 Pre-model hook: Analyzing context...
 * 🛠️  Available tools: financial_calculator
 * 👤 User level: basic, Topic: general
 * 🧮 Financial calculator tool called
 *
 * 🔧 Pre-model hook: Analyzing context...
 * 🛠️  Available tools: financial_calculator
 * 👤 User level: basic, Topic: general
 *
 * Response: If you save $500 per month at an annual interest rate of 5% for 10 years, you will have a total of $77,641.14. This includes your total contributions of $60,000 and interest earned amounting to $17,641.14.
 */
