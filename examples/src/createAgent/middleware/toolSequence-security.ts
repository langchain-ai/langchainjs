import { z } from "zod";
import { tool, createAgent, HumanMessage } from "langchain";
import { toolSequenceMiddleware } from "langchain/middleware";

// Security Incident Response Pipeline Example
// Demonstrates automated security incident handling with proper escalation

const assessThreat = tool(
  async ({ incidentId, alertSource, threatIndicators }) => {
    console.log(
      `Assessing threat for incident ${incidentId} from ${alertSource}`
    );
    console.log("Threat indicators:", threatIndicators);

    // Simulate threat assessment
    const riskScore = Math.floor(Math.random() * 10) + 1; // 1-10 risk score
    const severity =
      riskScore >= 8
        ? "critical"
        : riskScore >= 6
        ? "high"
        : riskScore >= 4
        ? "medium"
        : "low";

    return `Threat assessment completed for ${incidentId}. Risk score: ${riskScore}/10, Severity: ${severity}`;
  },
  {
    name: "assess_threat",
    description: "Assess the severity and scope of a security threat",
    schema: z.object({
      incidentId: z.string(),
      alertSource: z.string(),
      threatIndicators: z
        .array(z.string())
        .describe("List of threat indicators or IOCs"),
    }),
  }
);

const isolateSystems = tool(
  async ({ incidentId, affectedSystems, isolationLevel }) => {
    console.log(`Isolating systems for incident ${incidentId}`);
    console.log(`Affected systems: ${affectedSystems.join(", ")}`);
    console.log(`Isolation level: ${isolationLevel}`);

    // Simulate system isolation
    const isolatedCount = affectedSystems.length;
    return `Successfully isolated ${isolatedCount} systems with ${isolationLevel} isolation for incident ${incidentId}`;
  },
  {
    name: "isolate_systems",
    description: "Isolate affected systems to contain the threat",
    schema: z.object({
      incidentId: z.string(),
      affectedSystems: z
        .array(z.string())
        .describe("List of affected system identifiers"),
      isolationLevel: z
        .enum(["network", "partial", "complete"])
        .describe("Level of system isolation"),
    }),
  }
);

const collectEvidence = tool(
  async ({ incidentId, evidenceSources, preservationMethod }) => {
    console.log(`Collecting evidence for incident ${incidentId}`);
    console.log(`Evidence sources: ${evidenceSources.join(", ")}`);
    console.log(`Preservation method: ${preservationMethod}`);

    // Simulate evidence collection
    const evidenceItems = Math.floor(Math.random() * 10) + 5; // 5-15 evidence items
    return `Collected ${evidenceItems} pieces of evidence from ${evidenceSources.length} sources for incident ${incidentId}`;
  },
  {
    name: "collect_evidence",
    description: "Collect and preserve digital evidence from the incident",
    schema: z.object({
      incidentId: z.string(),
      evidenceSources: z
        .array(z.string())
        .describe("Sources to collect evidence from"),
      preservationMethod: z
        .enum(["disk_image", "memory_dump", "network_capture", "log_archive"])
        .describe("Method for evidence preservation"),
    }),
  }
);

const analyzeImpact = tool(
  async ({ incidentId, businessFunctions, dataTypes }) => {
    console.log(`Analyzing impact for incident ${incidentId}`);
    console.log(`Business functions: ${businessFunctions.join(", ")}`);
    console.log(`Data types affected: ${dataTypes.join(", ")}`);

    // Simulate impact analysis
    const impactScore = Math.floor(Math.random() * 5) + 1; // 1-5 impact score
    const estimatedLoss = Math.floor(Math.random() * 100000) + 10000; // $10K-$110K

    return `Impact analysis completed for ${incidentId}. Impact score: ${impactScore}/5, Estimated loss: $${estimatedLoss.toLocaleString()}`;
  },
  {
    name: "analyze_impact",
    description: "Analyze the business impact of the security incident",
    schema: z.object({
      incidentId: z.string(),
      businessFunctions: z
        .array(z.string())
        .describe("Affected business functions"),
      dataTypes: z
        .array(z.string())
        .describe("Types of data potentially compromised"),
    }),
  }
);

const remediateVulnerability = tool(
  async ({ incidentId, vulnerabilities, remediationActions }) => {
    console.log(`Remediating vulnerabilities for incident ${incidentId}`);
    console.log(`Vulnerabilities: ${vulnerabilities.join(", ")}`);
    console.log(`Remediation actions: ${remediationActions.join(", ")}`);

    // Simulate vulnerability remediation
    const patchesApplied = Math.floor(Math.random() * 5) + 1;
    const systemsUpdated = Math.floor(Math.random() * 10) + 5;

    return `Remediation completed for ${incidentId}. Applied ${patchesApplied} patches, updated ${systemsUpdated} systems`;
  },
  {
    name: "remediate_vulnerability",
    description:
      "Apply fixes and patches to remediate the identified vulnerabilities",
    schema: z.object({
      incidentId: z.string(),
      vulnerabilities: z
        .array(z.string())
        .describe("List of vulnerabilities to remediate"),
      remediationActions: z
        .array(z.string())
        .describe("Specific remediation actions to take"),
    }),
  }
);

const documentIncident = tool(
  async ({ incidentId, timeline, lessonsLearned, recommendations }) => {
    console.log(`Documenting incident ${incidentId}`);
    console.log("Timeline events:", timeline.length);
    console.log("Lessons learned:", lessonsLearned);
    console.log("Recommendations:", recommendations);

    // Simulate incident documentation
    const reportId = `RPT-${incidentId}-${Date.now()}`;
    return `Incident report ${reportId} generated for ${incidentId}. Documentation complete with ${timeline.length} timeline events`;
  },
  {
    name: "document_incident",
    description:
      "Create comprehensive incident documentation and post-mortem report",
    schema: z.object({
      incidentId: z.string(),
      timeline: z
        .array(
          z.object({
            timestamp: z.string(),
            event: z.string(),
            actor: z.string(),
          })
        )
        .describe("Chronological timeline of incident events"),
      lessonsLearned: z
        .array(z.string())
        .describe("Key lessons learned from the incident"),
      recommendations: z
        .array(z.string())
        .describe("Recommendations for preventing similar incidents"),
    }),
  }
);

const notifyStakeholders = tool(
  async ({ incidentId, stakeholders, notificationType, urgency }) => {
    console.log(`Notifying stakeholders for incident ${incidentId}`);
    console.log(`Stakeholders: ${stakeholders.join(", ")}`);
    console.log(`Notification type: ${notificationType}, Urgency: ${urgency}`);

    // Simulate stakeholder notification
    return `Stakeholder notifications sent for ${incidentId} to ${stakeholders.length} recipients via ${notificationType}`;
  },
  {
    name: "notify_stakeholders",
    description: "Notify relevant stakeholders about the security incident",
    schema: z.object({
      incidentId: z.string(),
      stakeholders: z
        .array(z.string())
        .describe("List of stakeholders to notify"),
      notificationType: z
        .enum(["email", "sms", "phone", "slack"])
        .describe("Method of notification"),
      urgency: z
        .enum(["low", "medium", "high", "critical"])
        .describe("Urgency level of notification"),
    }),
  }
);

// Create the security incident response pipeline middleware
const securityIncidentPipeline = toolSequenceMiddleware({
  name: "handle_security_incident",
  description: "Execute comprehensive security incident response protocol",
  schema: z.object({
    incidentId: z.string(),
    alertSource: z.string(),
    threatIndicators: z.array(z.string()),
    affectedSystems: z.array(z.string()),
    businessFunctions: z.array(z.string()),
    dataTypes: z.array(z.string()),
    stakeholders: z.array(z.string()),
  }),
  workflow: {
    assess_threat: "isolate_systems",
    isolate_systems: "collect_evidence",
    collect_evidence: "analyze_impact",
    analyze_impact: "remediate_vulnerability",
    remediate_vulnerability: "document_incident",
    document_incident: "notify_stakeholders",
  },
  tools: [
    assessThreat,
    isolateSystems,
    collectEvidence,
    analyzeImpact,
    remediateVulnerability,
    documentIncident,
    notifyStakeholders,
  ],
  start: "assess_threat",
});

// Create agent with the security incident response pipeline
const securityAgent = createAgent({
  model: "openai:gpt-4o",
  middleware: [securityIncidentPipeline],
  systemPrompt: `You are a security incident response coordinator. When a security incident is reported, 
you must follow the established incident response protocol to ensure proper assessment, containment, 
eradication, recovery, and documentation. Each step must be completed before proceeding to the next 
to maintain the integrity of the response process and ensure compliance with security policies.`,
});

// Example usage scenarios
async function demonstrateSecurityIncident() {
  // Scenario 1: Malware detection
  console.log("=== Malware Detection Response ===");
  const malwareResponse = await securityAgent.invoke({
    messages: [
      new HumanMessage(`
        Security alert: Potential malware detected
        - Incident ID: INC-2024-0123
        - Alert source: Endpoint Detection and Response (EDR)
        - Threat indicators: suspicious_process.exe, unusual_network_traffic, registry_modifications
        - Affected systems: WS-001, WS-002, SRV-DB-01
        - Business functions: Customer Database, Email Services
        - Data types: Customer PII, Email Communications
        - Stakeholders: security-team@company.com, ciso@company.com, it-director@company.com
      `),
    ],
  });

  console.log("Malware response result:", malwareResponse);
}

console.log("\n=== Data Breach Response ===");
const breachResponse = await securityAgent.invoke({
  messages: [
    new HumanMessage(`
    CRITICAL: Suspected data breach detected
    - Incident ID: INC-2024-0124
    - Alert source: Database Activity Monitor
    - Threat indicators: unauthorized_access, bulk_data_extraction, privilege_escalation
    - Affected systems: DB-PROD-01, DB-PROD-02, API-Gateway
    - Business functions: Customer Management, Payment Processing, User Authentication
    - Data types: Customer PII, Payment Information, Authentication Credentials
    - Stakeholders: security-team@company.com, ciso@company.com, legal@company.com, ceo@company.com
    `),
  ],
});

console.log("Data breach response result:", breachResponse);
