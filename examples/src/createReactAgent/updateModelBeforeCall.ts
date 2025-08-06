/* eslint-disable no-nested-ternary */
/* eslint-disable no-template-curly-in-string */
/* eslint-disable no-plusplus */
/**
 * Update Model to Use Before Model Call
 *
 * This capability enables dynamic model selection based on context, allowing the agent to choose the most
 * appropriate language model for each specific task or situation.
 *
 * Why this is important:
 * - Cost Optimization: Uses smaller, cheaper models for simple tasks and reserves powerful models for complex reasoning
 * - Performance Matching: Selects models with capabilities that match the specific requirements of each request
 * - Specialized Routing: Directs different types of queries to models that excel in those particular domains
 *
 * Example Scenario:
 * You're building a coding assistant that handles both simple syntax questions and complex algorithm design.
 * Simple questions like "How do I declare a variable?" use a fast, cost-effective model, while complex requests
 * like "Design a distributed caching algorithm" are routed to a more powerful model.
 */

import { createReactAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Track model usage for cost analysis
 */
interface ModelUsageStats {
  gpt4Calls: number;
  gpt4oMiniCalls: number;
  gpt4oModerateCalls: number;
  totalCost: number;
}

const usageStats: ModelUsageStats = {
  gpt4Calls: 0,
  gpt4oMiniCalls: 0,
  gpt4oModerateCalls: 0,
  totalCost: 0,
};

type Complexity = "simple" | "moderate" | "complex";
type Domain = "syntax" | "algorithm" | "analysis" | "general";
type Model = "gpt-4o" | "gpt-4o-mini" | "gpt-4o-moderate";

/**
 * Code analysis tool for complex programming questions
 */
const codeAnalysisTool = tool(
  async (input: { code: string; analysisType: string }) => {
    console.log("🔍 Code analysis tool called");

    const analysis = `Code Analysis Results:
Language: Detected ${
      input.code.includes("def ")
        ? "Python"
        : input.code.includes("function")
        ? "JavaScript"
        : "Unknown"
    }
Analysis Type: ${input.analysisType}

Findings:
- Code structure appears well-organized
- Consider adding error handling for edge cases
- Variable naming follows good conventions
- Performance: O(n) time complexity detected
- Security: No obvious vulnerabilities found

Recommendations:
- Add unit tests for better coverage
- Consider using type annotations
- Implement proper logging`;

    return analysis;
  },
  {
    name: "code_analysis",
    description: "Analyze code for structure, performance, and best practices",
    schema: z.object({
      code: z.string().describe("Code snippet to analyze"),
      analysisType: z
        .string()
        .describe("Type of analysis (performance, security, structure, etc.)"),
    }),
  }
);

/**
 * Algorithm design tool for complex computational problems
 */
const algorithmDesignTool = tool(
  async (input: { problem: string; constraints: string[] }) => {
    console.log("🧠 Algorithm design tool called");

    const design = `Algorithm Design for: ${input.problem}

Constraints: ${input.constraints.join(", ")}

Proposed Solution:
1. **Approach**: Divide and conquer with memoization
2. **Data Structures**: Hash map for caching, priority queue for optimization
3. **Time Complexity**: O(n log n) - optimal for this problem type
4. **Space Complexity**: O(n) - acceptable trade-off for performance

Implementation Strategy:
- Phase 1: Build core algorithm structure
- Phase 2: Add optimization layer
- Phase 3: Implement edge case handling
- Phase 4: Performance testing and tuning

Pseudocode:
\`\`\`
function solve(input, cache = {}):
    if input in cache:
        return cache[input]
    
    result = computeOptimalSolution(input)
    cache[input] = result
    return result
\`\`\``;

    return design;
  },
  {
    name: "algorithm_design",
    description: "Design algorithms for complex computational problems",
    schema: z.object({
      problem: z.string().describe("Description of the computational problem"),
      constraints: z
        .array(z.string())
        .describe("List of constraints and requirements"),
    }),
  }
);

/**
 * Simple syntax helper for basic programming questions
 */
const syntaxHelperTool = tool(
  async (input: { language: string; concept: string }) => {
    console.log("📝 Syntax helper tool called");

    const examples: Record<string, Record<string, string>> = {
      javascript: {
        variables: "let name = 'value'; const age = 25; var global = true;",
        functions: "function greet(name) { return `Hello, ${name}!`; }",
        loops: "for (let i = 0; i < 10; i++) { console.log(i); }",
        arrays: "const arr = [1, 2, 3]; arr.push(4); arr.map(x => x * 2);",
      },
      python: {
        variables: "name = 'value'\nage = 25\nLIST = [1, 2, 3]",
        functions: "def greet(name):\n    return f'Hello, {name}!'",
        loops: "for i in range(10):\n    print(i)",
        arrays: "lst = [1, 2, 3]\nlst.append(4)\n[x * 2 for x in lst]",
      },
    };

    const langExamples =
      examples[input.language.toLowerCase()] || examples.javascript;
    const example =
      langExamples[input.concept.toLowerCase()] ||
      "Concept not found in examples";

    return `${input.language} ${input.concept} Syntax:

\`\`\`${input.language}
${example}
\`\`\`

This is a basic example. Let me know if you need more specific details!`;
  },
  {
    name: "syntax_helper",
    description: "Provide syntax examples for basic programming concepts",
    schema: z.object({
      language: z
        .string()
        .describe("Programming language (JavaScript, Python, etc.)"),
      concept: z
        .string()
        .describe("Programming concept (variables, functions, loops, etc.)"),
    }),
  }
);

/**
 * Smart model selection based on query complexity and type
 */
function analyzeQueryComplexity(message: string): {
  complexity: Complexity;
  domain: Domain;
  recommendedModel: Model;
} {
  const content = message.toLowerCase();

  // Complex reasoning indicators
  const complexIndicators = [
    "algorithm",
    "optimize",
    "design pattern",
    "architecture",
    "distributed",
    "scalability",
    "performance analysis",
    "complexity analysis",
    "trade-offs",
    "system design",
    "database design",
    "security analysis",
    "machine learning",
  ];

  // Moderate complexity indicators
  const moderateIndicators = [
    "debug",
    "refactor",
    "best practice",
    "compare",
    "explain why",
    "how does",
    "difference between",
    "pros and cons",
    "when to use",
  ];

  // Simple syntax indicators
  const simpleIndicators = [
    "how to",
    "syntax",
    "declare",
    "create",
    "basic",
    "simple",
    "example",
    "show me",
    "what is",
    "define",
  ];

  // Domain detection
  let domain: "syntax" | "algorithm" | "analysis" | "general" = "general";
  if (simpleIndicators.some((indicator) => content.includes(indicator))) {
    domain = "syntax";
  } else if (
    complexIndicators.some((indicator) => content.includes(indicator))
  ) {
    domain =
      content.includes("algorithm") || content.includes("optimize")
        ? "algorithm"
        : "analysis";
  }

  // Complexity assessment
  let complexity: Complexity = "simple";
  let recommendedModel: Model = "gpt-4o-mini";

  if (complexIndicators.some((indicator) => content.includes(indicator))) {
    complexity = "complex";
    recommendedModel = "gpt-4o";
  } else if (
    moderateIndicators.some((indicator) => content.includes(indicator))
  ) {
    complexity = "moderate";
    recommendedModel = "gpt-4o-moderate";
  }

  return { complexity, domain, recommendedModel };
}

/**
 * Create agent with dynamic model selection
 */
const agent = createReactAgent({
  llm: async (state) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const messageContent =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const analysis = analyzeQueryComplexity(messageContent);

    console.log(`\n🧠 Model Selection Analysis:`);
    console.log(`  Query: "${messageContent.slice(0, 60)}..."`);
    console.log(`  Complexity: ${analysis.complexity}`);
    console.log(`  Domain: ${analysis.domain}`);
    console.log(`  Selected Model: ${analysis.recommendedModel}`);

    // Update usage statistics
    switch (analysis.recommendedModel) {
      case "gpt-4o":
        usageStats.gpt4Calls++;
        usageStats.totalCost += 0.03; // Approximate cost per call
        break;
      case "gpt-4o-mini":
        usageStats.gpt4oMiniCalls++;
        usageStats.totalCost += 0.0005;
        break;
      case "gpt-4o-moderate":
        usageStats.gpt4oModerateCalls++;
        usageStats.totalCost += 0.015; // GPT-4o with moderate settings
        break;
      default:
        break;
    }

    // Return appropriate model
    switch (analysis.recommendedModel) {
      case "gpt-4o":
        return new ChatOpenAI({
          model: "gpt-4o",
          temperature: 0.1, // Lower temperature for complex reasoning
        });
      case "gpt-4o-moderate":
        return new ChatOpenAI({
          model: "gpt-4o",
          temperature: 0.3, // Moderate temperature for balanced responses
        });
      default:
        return new ChatOpenAI({
          model: "gpt-4o-mini",
          temperature: 0.5, // Higher temperature for creative simple responses
        });
    }
  },
  tools: [codeAnalysisTool, algorithmDesignTool, syntaxHelperTool],
  prompt: `You are an intelligent coding assistant that adapts to the complexity of programming questions.

Your available tools:
- syntax_helper: For basic programming syntax questions
- code_analysis: For analyzing existing code structure and quality  
- algorithm_design: For complex algorithmic and system design problems

Based on the query complexity, you've been given an appropriate language model:
- Simple syntax questions → Fast, efficient model (GPT-4o-mini)
- Code analysis and debugging → Strong model with balanced settings (GPT-4o moderate)
- Complex algorithms and system design → Most powerful model for deep reasoning (GPT-4o complex)

Always use the most appropriate tool for the user's question and provide clear, helpful responses tailored to their experience level.`,
});

/**
 * Demonstrate dynamic model selection with different query types
 */

console.log("=== Coding Assistant with Dynamic Model Selection ===");

console.log("\n🔤 Simple Syntax Question");
const result1 = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "How do I declare a variable in JavaScript?",
    },
  ],
});

console.log("Response:", result1.messages[result1.messages.length - 1].content);

console.log("\n🔍 Code Debugging Question");
const result2 = await agent.invoke({
  messages: [
    {
      role: "user",
      content: `I need help debugging this function. What are the best practices I should follow here?

function findDuplicates(arr) {
  const duplicates = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !duplicates.includes(arr[i])) {
        duplicates.push(arr[i]);
      }
    }
  }
  return duplicates;
}`,
    },
  ],
});

console.log("Response:", result2.messages[result2.messages.length - 1].content);

console.log("\n🧠 Complex Algorithm Design");
const result3 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Design a distributed caching algorithm that can handle high concurrency and provides consistent data across multiple nodes with automatic failover capabilities.",
    },
  ],
});

console.log("Response:", result3.messages[result3.messages.length - 1].content);

console.log(`
📊 Usage Statistics
GPT-4o Complex calls: ${usageStats.gpt4Calls}
GPT-4o Moderate calls: ${usageStats.gpt4oModerateCalls}
GPT-4o-mini calls: ${usageStats.gpt4oMiniCalls}
Total estimated cost: $${usageStats.totalCost.toFixed(4)}
`);

/**
 * Expected output demonstrates intelligent model routing:
 *
 * === Coding Assistant with Dynamic Model Selection ===
 *
 * 🔤 Simple Syntax Question
 *
 * 🧠 Model Selection Analysis:
 *   Query: "How do I declare a variable in JavaScript?..."
 *   Complexity: simple
 *   Domain: syntax
 *   Selected Model: gpt-4o-mini
 * 
 * Response: In JavaScript, you can declare a variable using one of three keywords: `var`, `let`, or `const`.
 * Here's how to use each one:
 *
 * 1. **Using `var`:** This keyword declares a variable that can be re-assigned and has function scope or global scope.
 *    ```javascript
 *    var name = "Alice";
 *    ```
 *
 * 2. **Using `let`:** This keyword declares a block-scoped variable that can be re-assigned.
 *    ```javascript
 *    let age = 25;
 *    ```
 *
 * 3. **Using `const`:** This keyword declares a block-scoped variable that cannot be re-assigned (though the value itself may be mutable if it's an object or array).
 *    ```javascript
 *    const pi = 3.14;
 *    ```
 *
 * Choose `let` for variables that you expect to change, and `const` for constants that should not change. Use `var` if you need to support older JavaScript environments, but it's generally recommended to use `let` and `const` in modern code.
 *
 * 🔍 Code Debugging Question
 *
 * 🧠 Model Selection Analysis:
 *   Query: "I need help debugging this function. What are the best pract..."
 *   Complexity: moderate
 *   Domain: general
 *   Selected Model: gpt-4o-moderate
 *
 * Response: To help you debug and improve this function, let's go through some best practices and potential improvements:
 *
 * 1. **Understand the Functionality**:
 *    The function `findDuplicates` is designed to return an array of duplicate elements from the input array `arr`.
 *
 * 2. **Check for Edge Cases**:
 *    Consider what happens if the input array is empty or contains only one element. The function should handle these cases gracefully.
 *
 * 3. **Optimize for Efficiency**:
 *    The current implementation has a time complexity of O(n^2) due to the nested loops and the `includes` method inside the loop. This can be improved using a more efficient approach.
 *
 * 4. **Use a Set for Tracking**:
 *    Instead of checking if an element is already in the `duplicates` array using `includes`, which is O(n), you can use a `Set` to track seen elements and duplicates, which provides O(1) average time complexity for lookups.
 *
 * 5. **Code Readability and Comments**:
 *    Ensure the code is easy to read and understand. Adding comments can help explain the logic.
 *
 * Here is a revised version of the function with these best practices in mind:
 *
 * ```javascript
 * function findDuplicates(arr) {
 *   const seen = new Set();
 *   const duplicates = new Set();
 *
 *   for (const element of arr) {
 *     if (seen.has(element)) {
 *       duplicates.add(element);
 *     } else {
 *       seen.add(element);
 *     }
 *   }
 *
 *   // Convert the Set of duplicates to an array before returning
 *   return Array.from(duplicates);
 * }
 * ```
 *
 * ### Explanation:
 *
 * - **Sets for Efficiency**: We use two sets: `seen` to track all elements we have encountered and `duplicates` to store elements that appear more than once.
 * - **Single Loop**: The function now uses a single loop, reducing the time complexity to O(n).
 * - **Conversion to Array**: Finally, we convert the `duplicates` set to an array before returning it, as the function is expected to return an array.
 *
 * By following these practices, the function becomes more efficient and easier to maintain.
 *
 * 🧠 Complex Algorithm Design
 *
 * 🧠 Model Selection Analysis:
 *   Query: "Design a distributed caching algorithm that can handle high ..."
 *   Complexity: complex
 *   Domain: algorithm
 *   Selected Model: gpt-4o
 * 
 * Response: To design a distributed caching algorithm that handles high concurrency, provides consistent data
 * across multiple nodes, and includes automatic failover capabilities, we need to consider several key components
 * and strategies. Here's a high-level design using the CAP theorem principles, focusing on Consistency and
 * Availability while ensuring Partition Tolerance:
 *
 * ### 1. Architecture Overview
 *
 * - **Nodes**: Multiple cache nodes distributed across different servers or data centers.
 * - **Data Partitioning**: Use consistent hashing to distribute data evenly across nodes, minimizing data movement when nodes are added or removed.
 * - **Replication**: Implement data replication to ensure availability and fault tolerance.
 *
 * ### 2. Consistency Model
 *
 * - **Strong Consistency**: Use a consensus protocol like Paxos or Raft to ensure that all nodes agree on the data state before any read or write operation is considered complete.
 * - **Read Repair**: Implement read repair mechanisms to correct any inconsistencies detected during read operations.
 *
 * ### 3. Concurrency Control
 *
 * - **Optimistic Concurrency Control**: Allow multiple transactions to proceed without locking resources, checking for conflicts at commit time.
 * - **Versioning**: Use version numbers or timestamps to manage concurrent updates and resolve conflicts.
 *
 * ### 4. Automatic Failover
 *
 * - **Leader Election**: Use a leader election algorithm (e.g., Raft) to manage node failures and elect a new leader when necessary.
 * - **Heartbeat Mechanism**: Nodes send regular heartbeat messages to detect failures quickly.
- **Data Replication**: Maintain multiple replicas of each data item across different nodes to ensure data availability even if some nodes fail.
 *
 * ### 5. High Concurrency Handling
 *
 * - **Sharding**: Distribute data across multiple shards to balance load and reduce contention.
 * - **Load Balancing**: Use a load balancer to distribute incoming requests evenly across nodes.
 * - **Asynchronous Writes**: Allow asynchronous writes to improve write throughput, with mechanisms to ensure eventual consistency.
 *
 * ### 6. Implementation Considerations
 *
 * - **Data Serialization**: Use efficient serialization formats (e.g., Protocol Buffers) to minimize network overhead.
 * - **Network Protocol**: Use a lightweight protocol like gRPC for communication between nodes.
 * - **Monitoring and Logging**: Implement comprehensive monitoring and logging to track system performance and diagnose issues.
 *
 * ### 7. Example Technologies
 *
 * - **Distributed Consensus**: Apache Zookeeper, etcd
 * - **Distributed Cache**: Redis Cluster, Memcached with consistent hashing
 * - **Load Balancing**: NGINX, HAProxy
 *
 * ### 8. Challenges and Trade-offs
 *
 * - **Latency vs. Consistency**: Balancing the trade-off between low latency and strong consistency.
 * - **Network Partitions**: Designing the system to handle network partitions gracefully without compromising availability.
 *
 * This design provides a robust framework for a distributed caching system capable of handling high concurrency with consistent data across nodes and automatic failover capabilities. Implementing such a system requires careful consideration of the specific use case and workload characteristics to optimize performance and reliability.
 *
 * 📊 Usage Statistics
 * GPT-4o Complex calls: 1
 * GPT-4o Moderate calls: 1
 * GPT-4o-mini calls: 1
 * Total estimated cost: $0.0455
 */
