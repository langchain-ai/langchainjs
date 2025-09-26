import { z } from "zod";
import { tool, createAgent, HumanMessage } from "langchain";
import { toolSequenceMiddleware } from "langchain/middleware";

// Dynamic Workflow Example: Adaptive CI/CD Pipeline
// This example demonstrates both deterministic and LLM-assisted workflow decisions

const runTests = tool(
  async ({ repository, testSuite }) => {
    console.log(`Running ${testSuite} tests for ${repository}`);
    // Simulate test execution with random results
    const success = Math.random() > 0.3; // 70% success rate
    const result = success ? "PASSED" : "FAILED";
    const details = success
      ? "All tests passed successfully"
      : "Found 3 failing tests in authentication module";
    return `Test execution ${result}: ${details}`;
  },
  {
    name: "run_tests",
    description: "Execute test suite for the repository",
    schema: z.object({
      repository: z.string(),
      testSuite: z.enum(["unit", "integration", "e2e"]),
    }),
  }
);

const fixIssues = tool(
  async ({ repository, issueType }) => {
    console.log(`Fixing ${issueType} issues in ${repository}`);
    // Simulate issue fixing
    const fixTime = Math.floor(Math.random() * 30) + 10; // 10-40 minutes
    return `Fixed ${issueType} issues in ${fixTime} minutes. Ready for re-testing.`;
  },
  {
    name: "fix_issues",
    description: "Fix identified issues in the codebase",
    schema: z.object({
      repository: z.string(),
      issueType: z.string(),
    }),
  }
);

const performanceTest = tool(
  async ({ repository, loadLevel }) => {
    console.log(
      `Running performance tests for ${repository} at ${loadLevel} load`
    );
    // Simulate performance testing
    const responseTime = Math.floor(Math.random() * 500) + 100; // 100-600ms
    const throughput = Math.floor(Math.random() * 1000) + 500; // 500-1500 req/s
    return `Performance test completed: ${responseTime}ms avg response, ${throughput} req/s throughput`;
  },
  {
    name: "performance_test",
    description: "Run performance and load tests",
    schema: z.object({
      repository: z.string(),
      loadLevel: z.enum(["light", "moderate", "heavy"]),
    }),
  }
);

const securityScan = tool(
  async ({ repository, scanType }) => {
    console.log(`Running ${scanType} security scan for ${repository}`);
    // Simulate security scanning
    const vulnerabilities = Math.floor(Math.random() * 5); // 0-4 vulnerabilities
    return vulnerabilities === 0
      ? "Security scan completed: No vulnerabilities found"
      : `Security scan completed: Found ${vulnerabilities} vulnerabilities (severity varies)`;
  },
  {
    name: "security_scan",
    description: "Perform security vulnerability scanning",
    schema: z.object({
      repository: z.string(),
      scanType: z.enum(["static", "dynamic", "dependency"]),
    }),
  }
);

const deployStaging = tool(
  async ({ repository, version }) => {
    console.log(`Deploying ${repository} version ${version} to staging`);
    return `Successfully deployed ${repository} v${version} to staging environment`;
  },
  {
    name: "deploy_staging",
    description: "Deploy application to staging environment",
    schema: z.object({
      repository: z.string(),
      version: z.string(),
    }),
  }
);

const deployProduction = tool(
  async ({ repository, version }) => {
    console.log(`Deploying ${repository} version ${version} to production`);
    return `Successfully deployed ${repository} v${version} to production environment`;
  },
  {
    name: "deploy_production",
    description: "Deploy application to production environment",
    schema: z.object({
      repository: z.string(),
      version: z.string(),
    }),
  }
);

const notifyTeam = tool(
  async ({ repository, status, details }) => {
    console.log(`Notifying team about ${repository} deployment: ${status}`);
    return `Team notification sent: ${status} - ${details}`;
  },
  {
    name: "notify_team",
    description: "Send deployment notification to team",
    schema: z.object({
      repository: z.string(),
      status: z.enum(["success", "failure", "warning"]),
      details: z.string(),
    }),
  }
);

// Create adaptive CI/CD pipeline with dynamic workflow decisions
const adaptiveCICDPipeline = toolSequenceMiddleware({
  name: "adaptive_cicd_pipeline",
  description: "Execute adaptive CI/CD pipeline with intelligent routing",
  schema: z.object({
    repository: z.string(),
    branch: z.string(),
    deploymentTarget: z.enum(["staging", "production"]),
    requiresPerformanceTest: z.boolean().optional(),
    requiresSecurityScan: z.boolean().optional(),
  }),
  workflow: {
    // Deterministic decision based on test results
    run_tests: (state, runtime) => {
      const lastMessage = state.messages.at(-1);
      if (lastMessage?.content?.includes("FAILED")) {
        return "fix_issues";
      }
      // If tests pass, check if we need additional testing
      const context = runtime.context as any;
      if (context.requiresPerformanceTest) {
        return "performance_test";
      }
      if (context.requiresSecurityScan) {
        return "security_scan";
      }
      // Default to staging deployment
      return "deploy_staging";
    },

    // After fixing issues, always re-run tests
    fix_issues: "run_tests",

    // After performance test, check if security scan is needed
    performance_test: (state, runtime) => {
      const context = runtime.context as any;
      return context.requiresSecurityScan ? "security_scan" : "deploy_staging";
    },

    // After security scan, decide deployment target
    security_scan: (state, runtime) => {
      const context = runtime.context as any;
      const lastMessage = state.messages.at(-1);

      // If vulnerabilities found, only deploy to staging
      if (lastMessage?.content?.includes("vulnerabilities")) {
        return "deploy_staging";
      }

      // If no vulnerabilities and target is production, deploy to production
      return context.deploymentTarget === "production"
        ? "deploy_production"
        : "deploy_staging";
    },

    // After staging deployment, decide if we should proceed to production
    deploy_staging: (state, runtime) => {
      const context = runtime.context as any;

      // Only proceed to production if explicitly requested and no issues found
      if (context.deploymentTarget === "production") {
        const hasIssues = state.messages.some(
          (m) =>
            m.content?.includes("vulnerabilities") ||
            m.content?.includes("FAILED")
        );
        return hasIssues ? "notify_team" : "deploy_production";
      }

      return "notify_team";
    },

    // After production deployment, always notify team
    deploy_production: "notify_team",
  },
  tools: [
    runTests,
    fixIssues,
    performanceTest,
    securityScan,
    deployStaging,
    deployProduction,
    notifyTeam,
  ],
  start: "run_tests",
});

// Create agent with adaptive pipeline
const adaptiveCICDAgent = createAgent({
  model: "openai:gpt-4o",
  middleware: [adaptiveCICDPipeline],
  systemPrompt: `You are an intelligent CI/CD pipeline orchestrator. 
You adapt the deployment workflow based on test results, security requirements, and deployment targets.
The pipeline makes smart decisions about whether to run additional tests, fix issues, or proceed with deployments.`,
});

// Example usage scenarios
async function demonstrateAdaptiveWorkflow() {
  console.log("=== Adaptive CI/CD Pipeline Demo ===");

  // Scenario 1: Simple staging deployment
  console.log("\n1. Simple staging deployment:");
  const stagingDeploy = await adaptiveCICDAgent.invoke(
    {
      messages: [
        new HumanMessage(`
          Deploy the user-service repository, main branch to staging.
          No special requirements.
        `),
      ],
    },
    {
      context: {
        repository: "user-service",
        branch: "main",
        deploymentTarget: "staging",
        requiresPerformanceTest: false,
        requiresSecurityScan: false,
      },
    }
  );

  // Scenario 2: Production deployment with full testing
  console.log("\n2. Production deployment with full testing:");
  const productionDeploy = await adaptiveCICDAgent.invoke(
    {
      messages: [
        new HumanMessage(`
          Deploy the payment-service repository, release/v2.1 branch to production.
          This is a critical service, so run performance tests and security scans.
        `),
      ],
    },
    {
      context: {
        repository: "payment-service",
        branch: "release/v2.1",
        deploymentTarget: "production",
        requiresPerformanceTest: true,
        requiresSecurityScan: true,
      },
    }
  );

  // Scenario 3: Deployment with performance testing only
  console.log("\n3. Deployment with performance testing:");
  const performanceDeploy = await adaptiveCICDAgent.invoke(
    {
      messages: [
        new HumanMessage(`
          Deploy the api-gateway repository, feature/new-routing branch to staging.
          Run performance tests to validate the new routing logic.
        `),
      ],
    },
    {
      context: {
        repository: "api-gateway",
        branch: "feature/new-routing",
        deploymentTarget: "staging",
        requiresPerformanceTest: true,
        requiresSecurityScan: false,
      },
    }
  );

  console.log("All scenarios completed!");
}

// Uncomment to run the demo
// demonstrateAdaptiveWorkflow().catch(console.error);

export { adaptiveCICDPipeline, adaptiveCICDAgent };
