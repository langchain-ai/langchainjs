import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
  mkdirSync,
  cpSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execSync, type ExecSyncOptions } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LANGCHAIN_ROOT = join(__dirname, "..", "..", "..", "..");
const LANGCHAIN_PKG_DIST = join(LANGCHAIN_ROOT, "langchain", "dist");
const LANGCHAIN_CORE_PKG_DIST = join(LANGCHAIN_ROOT, "langchain-core", "dist");
const TYPESCRIPT_VERSION = process.env.TSC_BENCH_TS_VERSION ?? "^5.9.3";

const TRACE_OUTPUT_DIR = join(LANGCHAIN_ROOT, "..", "tsc-traces");

interface TscResult {
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  exitCode: number | null;
}

interface ProjectConfig {
  name: string;
  packageJson: Record<string, unknown>;
  tsconfig: Record<string, unknown>;
  sourceFiles: Record<string, string>;
}

interface TscOptions {
  timeout?: number;
  generateTrace?: boolean;
  traceName?: string;
}

function runTsc(projectDir: string, options: TscOptions = {}): TscResult {
  const { timeout = 120_000, generateTrace = false, traceName } = options;

  let traceDir: string | undefined;
  if (generateTrace && traceName) {
    traceDir = join(TRACE_OUTPUT_DIR, traceName);
    if (!existsSync(TRACE_OUTPUT_DIR)) {
      mkdirSync(TRACE_OUTPUT_DIR, { recursive: true });
    }
    if (existsSync(traceDir)) {
      rmSync(traceDir, { recursive: true, force: true });
    }
    mkdirSync(traceDir, { recursive: true });
  }

  const execOptions: ExecSyncOptions = {
    cwd: projectDir,
    encoding: "utf-8",
    timeout,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      npm_config_loglevel: "error",
    },
  };

  let tscCommand = "npx tsc --noEmit";
  if (traceDir) {
    tscCommand += ` --generateTrace "${traceDir}"`;
  }

  const startTime = performance.now();
  let stdout = "";
  let stderr = "";
  let exitCode: number | null = 0;

  try {
    stdout = execSync(tscCommand, execOptions) as string;
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      status?: number;
    };
    stdout = execError.stdout ?? "";
    stderr = execError.stderr ?? "";
    exitCode = execError.status ?? 1;
  }

  const durationMs = performance.now() - startTime;

  const filteredStderr = stderr
    .split("\n")
    .filter((line) => !line.includes("npm warn") && !line.includes("npm WARN"))
    .join("\n")
    .trim();

  const hasTypeScriptErrors =
    stdout.includes("error TS") || filteredStderr.includes("error TS");

  if (traceDir) {
    console.log(`\n📁 TypeScript trace saved to: ${traceDir}`);
    console.log("   Files: trace.json, types.json");
    console.log(
      "   View in: https://ui.perfetto.dev/ or Chrome DevTools Performance tab"
    );
  }

  return {
    success: exitCode === 0 && !hasTypeScriptErrors,
    stdout,
    stderr: filteredStderr,
    durationMs,
    exitCode,
  };
}

function createTempProject(config: ProjectConfig): string {
  const tempDir = mkdtempSync(
    join(tmpdir(), `langchain-tsc-bench-${config.name}-`)
  );
  const srcDir = join(tempDir, "src");

  mkdirSync(srcDir, { recursive: true });

  writeFileSync(
    join(tempDir, "package.json"),
    JSON.stringify(config.packageJson, null, 2)
  );

  writeFileSync(
    join(tempDir, "tsconfig.json"),
    JSON.stringify(config.tsconfig, null, 2)
  );

  for (const [filename, content] of Object.entries(config.sourceFiles)) {
    const filePath = join(srcDir, filename);
    const fileDir = join(filePath, "..");
    if (!existsSync(fileDir)) {
      mkdirSync(fileDir, { recursive: true });
    }
    writeFileSync(filePath, content);
  }

  return tempDir;
}

function cleanupProject(projectDir: string): void {
  if (existsSync(projectDir)) {
    rmSync(projectDir, { recursive: true, force: true });
  }
}

const basePackageJson = {
  name: "tsc-bench-test",
  version: "1.0.0",
  private: true,
  dependencies: {
    langchain: "latest",
    "@langchain/core": "latest",
    zod: "^3.25.76",
    typescript: `${TYPESCRIPT_VERSION}`,
  },
};

function installDependencies(projectDir: string, timeout = 180_000): void {
  const execOptions: ExecSyncOptions = {
    cwd: projectDir,
    encoding: "utf-8",
    timeout,
    stdio: "pipe",
  };

  execSync("npm install --legacy-peer-deps", execOptions);
  replaceDistFolders(projectDir);
}

function replaceDistFolders(projectDir: string): void {
  const nodeModules = join(projectDir, "node_modules");

  const langchainDist = join(nodeModules, "langchain", "dist");
  if (existsSync(langchainDist) && existsSync(LANGCHAIN_PKG_DIST)) {
    rmSync(langchainDist, { recursive: true, force: true });
    cpSync(LANGCHAIN_PKG_DIST, langchainDist, { recursive: true });
  }

  const coreDist = join(nodeModules, "@langchain", "core", "dist");
  if (existsSync(coreDist) && existsSync(LANGCHAIN_CORE_PKG_DIST)) {
    rmSync(coreDist, { recursive: true, force: true });
    cpSync(LANGCHAIN_CORE_PKG_DIST, coreDist, { recursive: true });
  }
}

const commonjsTsconfig = {
  compilerOptions: {
    target: "ES2020",
    module: "commonjs",
    lib: ["ES2020"],
    outDir: "./dist",
    rootDir: "./src",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    moduleResolution: "node",
    noEmit: true,
  },
  include: ["src/**/*"],
};

const esmTsconfig = {
  compilerOptions: {
    target: "ES2022",
    module: "ES2022",
    lib: ["ES2022"],
    outDir: "./dist",
    rootDir: "./src",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    moduleResolution: "bundler",
    noEmit: true,
  },
  include: ["src/**/*"],
};

const sourceFilesExplicit = {
  "createAgentWithResponseFormat.ts": `
import { createAgent, tool } from "langchain";
import { z } from "zod";

const weatherSchema = z.object({
  city: z.string().describe("The city to get the weather for"),
});

const getWeather = tool(
  (input: z.infer<typeof weatherSchema>) => \`It's always sunny in \${input.city}!\`,
  {
    name: "get_weather",
    description: "Get the weather for a given city",
    schema: weatherSchema,
  }
);

const responseFormat = z.object({
  answer: z.string(),
});

const agent = createAgent({
  model: "gpt-4",
  tools: [getWeather],
  responseFormat,
});

export { agent };
`,

  "simpleTool.ts": `
import { tool } from "langchain";
import { z } from "zod";

const greetSchema = z.object({
  name: z.string(),
});

const myTool = tool(
  (input: z.infer<typeof greetSchema>) => \`Hello, \${input.name}!\`,
  {
    name: "greet",
    description: "Greet someone by name",
    schema: greetSchema,
  }
);

export { myTool };
`,

  "createAgentNoResponseFormat.ts": `
import { createAgent, tool } from "langchain";
import { z } from "zod";

const searchSchema = z.object({
  query: z.string(),
});

const searchTool = tool(
  (input: z.infer<typeof searchSchema>) => \`Results for: \${input.query}\`,
  {
    name: "search",
    description: "Search for something",
    schema: searchSchema,
  }
);

const agent = createAgent({
  model: "gpt-4",
  tools: [searchTool],
});

export { agent };
`,

  "multipleTools.ts": `
import { createAgent, tool } from "langchain";
import { z } from "zod";

const tool1Schema = z.object({
  field1: z.string(),
  field2: z.number().optional(),
});

const tool1 = tool(
  (input: z.infer<typeof tool1Schema>) => JSON.stringify(input),
  {
    name: "tool1",
    description: "Tool 1",
    schema: tool1Schema,
  }
);

const tool2Schema = z.object({
  items: z.array(z.string()),
  config: z.object({
    enabled: z.boolean(),
    count: z.number(),
  }).optional(),
});

const tool2 = tool(
  (input: z.infer<typeof tool2Schema>) => JSON.stringify(input),
  {
    name: "tool2",
    description: "Tool 2",
    schema: tool2Schema,
  }
);

const tool3Schema = z.object({
  data: z.record(z.string(), z.unknown()),
});

const tool3 = tool(
  (input: z.infer<typeof tool3Schema>) => JSON.stringify(input),
  {
    name: "tool3",
    description: "Tool 3",
    schema: tool3Schema,
  }
);

const agent = createAgent({
  model: "gpt-4",
  tools: [tool1, tool2, tool3],
});

export { agent };
`,

  "complexResponseFormat.ts": `
import { createAgent, tool } from "langchain";
import { z } from "zod";

const analyzeSchema = z.object({
  text: z.string(),
});

const analysisTool = tool(
  (input: z.infer<typeof analyzeSchema>) => \`Analyzing: \${input.text}\`,
  {
    name: "analyze",
    description: "Analyze text",
    schema: analyzeSchema,
  }
);

const complexResponse = z.object({
  summary: z.string(),
  details: z.object({
    category: z.string(),
    confidence: z.number(),
    tags: z.array(z.string()),
    metadata: z.object({
      source: z.string(),
      timestamp: z.string(),
    }).optional(),
  }),
  recommendations: z.array(z.object({
    action: z.string(),
    priority: z.enum(["low", "medium", "high"]),
  })),
});

const agent = createAgent({
  model: "gpt-4",
  tools: [analysisTool],
  responseFormat: complexResponse,
});

export { agent };
`,
};

const sourceFilesImplicit = {
  "index.ts": `
import { createAgent, tool } from "langchain";
import { z } from "zod";

const getWeather = tool(
  (input) => \`It's always sunny in \${input.city}!\`,
  {
    name: "get_weather",
    description: "Get the weather for a given city",
    schema: z.object({
      city: z.string().describe("The city to get the weather for"),
    }),
  }
);

const responseFormat = z.object({
  answer: z.string(),
});

const agent = createAgent({
  model: "gpt-4",
  tools: [getWeather],
  responseFormat,
});

export { agent };
`,
};

const commonjsRelaxedTsconfig = {
  compilerOptions: {
    target: "ES2020",
    module: "commonjs",
    lib: ["ES2020"],
    outDir: "./dist",
    rootDir: "./src",
    strict: false,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    moduleResolution: "node",
    noEmit: true,
  },
  include: ["src/**/*"],
};

describe("TypeScript Compilation Benchmarks", () => {
  const projectDirs: string[] = [];

  afterAll(() => {
    for (const dir of projectDirs) {
      cleanupProject(dir);
    }
  });

  describe("CommonJS Module Resolution (explicit types)", () => {
    let projectDir: string;

    beforeAll(() => {
      projectDir = createTempProject({
        name: "commonjs-explicit",
        packageJson: basePackageJson,
        tsconfig: commonjsTsconfig,
        sourceFiles: sourceFilesExplicit,
      });
      projectDirs.push(projectDir);
      installDependencies(projectDir);
    }, 300_000);

    it("should compile createAgent with explicit input types", () => {
      const result = runTsc(projectDir, {
        generateTrace: true,
        traceName: "commonjs-explicit",
      });
      const errorCount = countErrors(result);
      const ts2589 = hasTS2589Error(result);

      console.log("\n📊 CommonJS (explicit types) Compilation Result:");
      console.log(`   Duration: ${result.durationMs.toFixed(2)}ms`);
      console.log(`   Success: ${result.success}`);
      console.log(`   TypeScript Errors: ${errorCount}`);
      console.log(`   TS2589 (type depth): ${ts2589 ? "YES ⚠️" : "No"}`);

      if (!result.success) {
        const errors = extractTypeScriptErrors(result);
        if (errors.length > 0) {
          console.log("\n   TypeScript Errors Found:");
          for (const error of errors.slice(0, 5)) {
            console.log(`   ${"-".repeat(60)}`);
            console.log(
              `   ${error
                .split("\n")
                .map((l) => `   ${l}`)
                .join("\n")}`
            );
          }
          if (errors.length > 5) {
            console.log(`   ... and ${errors.length - 5} more errors`);
          }
        }
      }

      expect(result.durationMs).toBeLessThan(120_000);
      expect(ts2589).toBe(false);
      expect(result.success).toBe(true);
    });
  });

  describe("CommonJS Module Resolution (implicit types - issue reproduction)", () => {
    let projectDir: string;

    beforeAll(() => {
      projectDir = createTempProject({
        name: "commonjs-implicit",
        packageJson: basePackageJson,
        tsconfig: commonjsRelaxedTsconfig,
        sourceFiles: sourceFilesImplicit,
      });
      projectDirs.push(projectDir);
      installDependencies(projectDir);
    }, 300_000);

    it("should compile createAgent with implicit input types (TS2589 regression test)", () => {
      const result = runTsc(projectDir, {
        generateTrace: true,
        traceName: "commonjs-implicit",
      });
      const errorCount = countErrors(result);
      const ts2589 = hasTS2589Error(result);

      console.log("\n📊 CommonJS (implicit types) Compilation Result:");
      console.log(`   Duration: ${result.durationMs.toFixed(2)}ms`);
      console.log(`   Success: ${result.success}`);
      console.log(`   TypeScript Errors: ${errorCount}`);
      console.log(`   TS2589 (type depth): ${ts2589 ? "YES ⚠️" : "No"}`);

      if (!result.success) {
        const errors = extractTypeScriptErrors(result);
        if (errors.length > 0) {
          console.log("\n   TypeScript Errors Found:");
          for (const error of errors.slice(0, 5)) {
            console.log(`   ${"-".repeat(60)}`);
            console.log(
              `   ${error
                .split("\n")
                .map((l) => `   ${l}`)
                .join("\n")}`
            );
          }
          if (errors.length > 5) {
            console.log(`   ... and ${errors.length - 5} more errors`);
          }
        }
      }

      expect(result.durationMs).toBeLessThan(120_000);
      expect(ts2589).toBe(false);
      expect(result.success).toBe(true);
    });
  });

  describe("ESM Module Resolution", () => {
    let projectDir: string;

    beforeAll(() => {
      projectDir = createTempProject({
        name: "esm",
        packageJson: {
          ...basePackageJson,
          type: "module",
        },
        tsconfig: esmTsconfig,
        sourceFiles: sourceFilesExplicit,
      });
      projectDirs.push(projectDir);
      installDependencies(projectDir);
    }, 300_000);

    it("should compile createAgent with tool and responseFormat", () => {
      const result = runTsc(projectDir, {
        generateTrace: true,
        traceName: "esm",
      });

      console.log("\n📊 ESM Compilation Result:");
      console.log(`   Duration: ${result.durationMs.toFixed(2)}ms`);
      console.log(`   Success: ${result.success}`);
      if (!result.success) {
        console.log(`   Errors:\n${result.stderr || result.stdout}`);
      }

      expect(result.success).toBe(true);
      expect(result.durationMs).toBeLessThan(120_000);
    });
  });

  describe("Compilation Performance Comparison", () => {
    const results: Record<string, TscResult> = {};

    beforeAll(() => {
      const configs = [
        {
          name: "commonjs-perf",
          packageJson: basePackageJson,
          tsconfig: commonjsRelaxedTsconfig,
        },
        {
          name: "esm-perf",
          packageJson: { ...basePackageJson, type: "module" },
          tsconfig: esmTsconfig,
        },
      ];

      for (const config of configs) {
        const dir = createTempProject({
          ...config,
          sourceFiles: sourceFilesImplicit,
        });
        projectDirs.push(dir);
        installDependencies(dir);
        results[config.name] = runTsc(dir, {
          generateTrace: true,
          traceName: `comparison-${config.name}`,
        });
      }
    }, 600_000);

    it("should report compilation time comparison", () => {
      const separator = "=".repeat(80);
      console.log(`\n${separator}`);
      console.log("📊 TypeScript Compilation Performance Comparison");
      console.log("=".repeat(80));

      const cjsResult = results["commonjs-perf"];
      const esmResult = results["esm-perf"];

      console.log(
        "\n┌────────────────┬────────────────┬─────────────┬──────────────────┐"
      );
      console.log(
        "│ Configuration  │ Duration (ms)  │ Success     │ Errors           │"
      );
      console.log(
        "├────────────────┼────────────────┼─────────────┼──────────────────┤"
      );
      console.log(
        `│ CommonJS       │ ${cjsResult.durationMs
          .toFixed(2)
          .padStart(14)} │ ${(cjsResult.success ? "✓" : "✗").padEnd(
          11
        )} │ ${countErrors(cjsResult).toString().padEnd(16)} │`
      );
      console.log(
        `│ ESM            │ ${esmResult.durationMs
          .toFixed(2)
          .padStart(14)} │ ${(esmResult.success ? "✓" : "✗").padEnd(
          11
        )} │ ${countErrors(esmResult).toString().padEnd(16)} │`
      );
      console.log(
        "└────────────────┴────────────────┴─────────────┴──────────────────┘"
      );

      if (cjsResult.durationMs > esmResult.durationMs) {
        const slowdown = (
          (cjsResult.durationMs / esmResult.durationMs - 1) *
          100
        ).toFixed(1);
        console.log(`\n⚠️  CommonJS is ${slowdown}% slower than ESM`);
      }

      const cjsHasTS2589 = hasTS2589Error(cjsResult);
      const esmHasTS2589 = hasTS2589Error(esmResult);

      if (cjsHasTS2589) {
        console.log(
          "\n🔴 REGRESSION: CommonJS has TS2589 (Type instantiation excessively deep)"
        );
        const errors = extractTypeScriptErrors(cjsResult);
        for (const error of errors.slice(0, 3)) {
          console.log("-".repeat(60));
          console.log(error);
        }
      }

      if (esmHasTS2589) {
        console.log(
          "\n🔴 REGRESSION: ESM has TS2589 (Type instantiation excessively deep)"
        );
      }

      if (!cjsResult.success && !cjsHasTS2589) {
        console.log("\n📋 CommonJS Compilation Errors:");
        console.log("-".repeat(40));
        const errors = extractTypeScriptErrors(cjsResult);
        for (const error of errors.slice(0, 3)) {
          console.log(error);
        }
      }

      expect(cjsResult.durationMs).toBeLessThan(120_000);
      expect(esmResult.durationMs).toBeLessThan(120_000);
      expect(cjsResult.success).toBe(true);
      expect(esmResult.success).toBe(true);
    });
  });
});

function countErrors(result: TscResult): number {
  const output = result.stderr + result.stdout;
  const matches = output.match(/error TS\d+/g);
  return matches?.length ?? 0;
}

function extractTypeScriptErrors(result: TscResult): string[] {
  const output = result.stderr + result.stdout;
  const lines = output.split("\n");
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("error TS")) {
      const contextLines = lines.slice(i, Math.min(i + 6, lines.length));
      errors.push(contextLines.join("\n"));
      i += 5;
    }
  }

  return errors;
}

function hasTS2589Error(result: TscResult): boolean {
  const output = result.stderr + result.stdout;
  return (
    output.includes("TS2589") ||
    output.includes("excessively deep and possibly infinite")
  );
}
