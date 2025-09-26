import { z } from "zod";
import { tool, createAgent, HumanMessage } from "langchain";
import { toolSequenceMiddleware } from "langchain/middleware";

// Data Processing Pipeline Example
// Demonstrates ETL (Extract, Transform, Load) workflow automation

const extractData = tool(
  async ({ source, format }) => {
    console.log(`Extracting data from ${source} in ${format} format`);
    // Simulate data extraction
    const mockData = {
      records: 1000,
      format: format,
      source: source,
      extractedAt: new Date().toISOString(),
    };
    return `Successfully extracted ${mockData.records} records from ${source}`;
  },
  {
    name: "extract_data",
    description: "Extract data from a specified source",
    schema: z.object({
      source: z.string().describe("Data source URL or path"),
      format: z
        .enum(["csv", "json", "xml", "parquet"])
        .describe("Expected data format"),
    }),
  }
);

const validateData = tool(
  async ({ expectedRecords, qualityThreshold }) => {
    console.log(`Validating data quality with threshold ${qualityThreshold}%`);
    // Simulate data validation
    const qualityScore = Math.random() * 100;
    if (qualityScore < qualityThreshold) {
      throw new Error(
        `Data quality score ${qualityScore.toFixed(
          1
        )}% below threshold ${qualityThreshold}%`
      );
    }
    return `Data validation passed with quality score: ${qualityScore.toFixed(
      1
    )}%`;
  },
  {
    name: "validate_data",
    description: "Validate data quality and integrity",
    schema: z.object({
      expectedRecords: z
        .number()
        .optional()
        .describe("Expected number of records"),
      qualityThreshold: z
        .number()
        .default(85)
        .describe("Minimum quality threshold percentage"),
    }),
  }
);

const cleanData = tool(
  async ({ removeNulls, standardizeFormats }) => {
    console.log(
      `Cleaning data: removeNulls=${removeNulls}, standardizeFormats=${standardizeFormats}`
    );
    // Simulate data cleaning
    const cleanedRecords = Math.floor(Math.random() * 50) + 900; // 900-950 records after cleaning
    return `Data cleaning completed. ${cleanedRecords} records remain after cleaning`;
  },
  {
    name: "clean_data",
    description: "Clean and standardize data",
    schema: z.object({
      removeNulls: z.boolean().default(true).describe("Remove null values"),
      standardizeFormats: z
        .boolean()
        .default(true)
        .describe("Standardize data formats"),
    }),
  }
);

const transformData = tool(
  async ({ transformations, outputFormat }) => {
    console.log(`Applying transformations: ${transformations.join(", ")}`);
    console.log(`Output format: ${outputFormat}`);
    // Simulate data transformation
    return `Data transformed successfully using ${transformations.length} transformation rules`;
  },
  {
    name: "transform_data",
    description: "Apply business logic transformations to data",
    schema: z.object({
      transformations: z
        .array(z.string())
        .describe("List of transformation rules to apply"),
      outputFormat: z
        .enum(["csv", "json", "parquet", "sql"])
        .describe("Desired output format"),
    }),
  }
);

const loadData = tool(
  async ({ destination, mode }) => {
    console.log(`Loading data to ${destination} using ${mode} mode`);
    // Simulate data loading
    const loadTime = Math.random() * 60 + 30; // 30-90 seconds
    return `Data loaded successfully to ${destination} in ${loadTime.toFixed(
      1
    )} seconds`;
  },
  {
    name: "load_data",
    description: "Load transformed data to destination",
    schema: z.object({
      destination: z
        .string()
        .describe("Destination database or data warehouse"),
      mode: z.enum(["append", "overwrite", "upsert"]).describe("Loading mode"),
    }),
  }
);

const generateReport = tool(
  async ({ reportType, recipients }) => {
    console.log(`Generating ${reportType} report for ${recipients.join(", ")}`);
    // Simulate report generation
    const metrics = {
      recordsProcessed: Math.floor(Math.random() * 1000) + 500,
      processingTime: Math.floor(Math.random() * 300) + 60,
      errorRate: (Math.random() * 5).toFixed(2),
    };
    return `Processing report generated: ${metrics.recordsProcessed} records processed in ${metrics.processingTime}s with ${metrics.errorRate}% error rate`;
  },
  {
    name: "generate_report",
    description: "Generate processing summary report",
    schema: z.object({
      reportType: z
        .enum(["summary", "detailed", "error_analysis"])
        .describe("Type of report to generate"),
      recipients: z
        .array(z.string())
        .describe("Email addresses to send report to"),
    }),
  }
);

// Create the data processing pipeline middleware
const dataProcessingPipeline = toolSequenceMiddleware({
  name: "process_dataset",
  description:
    "Process a dataset through complete ETL pipeline with validation and reporting",
  schema: z.object({
    source: z.string(),
    format: z.enum(["csv", "json", "xml", "parquet"]),
    destination: z.string(),
    transformations: z.array(z.string()),
    qualityThreshold: z.number().optional(),
    recipients: z.array(z.string()),
  }),
  workflow: {
    extract_data: "validate_data",
    validate_data: "clean_data",
    clean_data: "transform_data",
    transform_data: "load_data",
    load_data: "generate_report",
  },
  tools: [
    extractData,
    validateData,
    cleanData,
    transformData,
    loadData,
    generateReport,
  ],
  start: "extract_data",
});

// Create agent with the data processing pipeline
const dataAgent = createAgent({
  model: "openai:gpt-4o",
  middleware: [dataProcessingPipeline],
  systemPrompt: `You are a data engineering assistant specialized in ETL (Extract, Transform, Load) operations.
When given a data processing task, use the ETL pipeline to ensure data is properly extracted, validated, cleaned, transformed, loaded, and reported on.
The pipeline ensures data quality and provides comprehensive reporting on the processing results.`,
});

// Example usage scenarios
async function demonstrateDataProcessing() {
  // Scenario 1: Customer data migration
  console.log("=== Customer Data Migration ===");
  const customerMigration = await dataAgent.invoke({
    messages: [
      new HumanMessage(`
        I need to migrate customer data from our legacy CRM system:
        - Source: https://legacy-crm.company.com/export/customers.csv
        - Format: CSV
        - Destination: PostgreSQL customer_warehouse
        - Apply these transformations: normalize_phone_numbers, standardize_addresses, deduplicate_records
        - Quality threshold: 90%
        - Send report to: data-team@company.com, operations@company.com
      `),
    ],
  });

  console.log("Customer migration result:", customerMigration);
}

async function demonstrateAnalyticsProcessing() {
  // Scenario 2: Analytics data processing
  console.log("\n=== Analytics Data Processing ===");
  const analyticsProcessing = await dataAgent.invoke({
    messages: [
      new HumanMessage(`
        Process our daily analytics data:
        - Source: s3://analytics-bucket/daily/2024-01-15/events.parquet  
        - Format: Parquet
        - Destination: Snowflake analytics_warehouse
        - Transformations: aggregate_by_hour, calculate_conversion_rates, enrich_with_demographics
        - Quality threshold: 95%
        - Send detailed report to: analytics-team@company.com
      `),
    ],
  });

  console.log("Analytics processing result:", analyticsProcessing);
}

// Uncomment to run examples
// demonstrateDataProcessing().catch(console.error);
// demonstrateAnalyticsProcessing().catch(console.error);

export { dataProcessingPipeline, dataAgent };
