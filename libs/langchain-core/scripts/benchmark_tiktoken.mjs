import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const coreRoot = resolve(dirname(scriptPath), "..");
const repositoryRoot = resolve(coreRoot, "../..");
const requireFromCore = createRequire(resolve(coreRoot, "package.json"));
const encodings = ["cl100k_base", "o200k_base"];
const documentTypes = ["prose", "typescript", "cjk"];
const coldScenarios = ["hypertok", "js-fetch", "js-cached"];
const steadyScenarios = ["hypertok", "js-cached"];
const samples = 9;
const coldCheckpoints = [1, 10, 100];
const warmups = 2;
const coldDocumentBytes = 4 * 1024;
const steadyCorpusBytes = 512 * 1024;
const steadyDocumentCharacters = 16_000;

const proseSources = ["README.md", "CONTRIBUTING.md"];
const typescriptSources = [
  "libs/langchain-core/src/language_models/base.ts",
  "libs/langchain-core/src/language_models/chat_models.ts",
  "libs/langchain-core/src/messages/base.ts",
  "libs/langchain-core/src/prompts/chat.ts",
  "libs/langchain-core/src/runnables/base.ts",
  "libs/langchain-core/src/output_parsers/base.ts",
];
const cjkSeed = `机器学习系统需要准确计算多语言文本的标记数量。检索、工具调用和结构化输出共享同一个上下文预算。
東京とソウルの利用者も同じ経路を使います。正確なトークン数は、検索と生成の両方で重要です。
한국어 문서에서도 토큰 수를 정확하게 계산해야 합니다. 검색, 도구 호출, 구조화된 출력을 함께 처리합니다.
`;

function readSources(paths) {
  return paths
    .map((path) => readFileSync(resolve(repositoryRoot, path), "utf8"))
    .join("\n");
}

function getSeed(type) {
  if (type === "prose") {
    return readSources(proseSources);
  }
  if (type === "typescript") {
    return readSources(typescriptSources);
  }
  return cjkSeed;
}

function truncateUtf8(text, byteLimit) {
  let low = 0;
  let high = text.length;
  while (low < high) {
    const midpoint = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(text.slice(0, midpoint), "utf8") <= byteLimit) {
      low = midpoint;
    } else {
      high = midpoint - 1;
    }
  }
  return text.slice(0, low);
}

function repeatToBytes(seed, byteTarget) {
  return seed.repeat(
    Math.ceil(byteTarget / Buffer.byteLength(seed, "utf8")) + 1
  );
}

function createCorpus(type) {
  const seed = getSeed(type);
  const expanded = repeatToBytes(seed, steadyCorpusBytes);
  const coldDocument = truncateUtf8(expanded, coldDocumentBytes);
  const documents = [];
  let offset = 0;
  let bytes = 0;
  while (bytes < steadyCorpusBytes) {
    const candidate = expanded.slice(offset, offset + steadyDocumentCharacters);
    const document = truncateUtf8(candidate, steadyCorpusBytes - bytes);
    if (document.length === 0) {
      break;
    }
    documents.push(document);
    bytes += Buffer.byteLength(document, "utf8");
    offset += candidate.length;
  }
  return {
    coldDocument,
    coldBytes: Buffer.byteLength(coldDocument, "utf8"),
    documents,
    bytes,
  };
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

function configureBackend(scenario, encoding) {
  if (scenario !== "hypertok") {
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === "hypertok" || specifier.startsWith("hypertok/")) {
          throw new Error("hypertok disabled for comparison");
        }
        return nextResolve(specifier, context);
      },
    });
  }

  let fetchCount = 0;
  let fetchedUrl;
  const expectedUrl = `https://tiktoken.pages.dev/js/${encoding}.json`;
  if (scenario === "js-fetch") {
    const nativeFetch = globalThis.fetch;
    globalThis.fetch = async (...args) => {
      fetchCount += 1;
      fetchedUrl = String(args[0]);
      return nativeFetch(...args);
    };
  } else if (scenario === "js-cached") {
    const ranks = requireFromCore(`js-tiktoken/ranks/${encoding}`);
    globalThis.fetch = async (url) => {
      fetchCount += 1;
      fetchedUrl = String(url);
      return { ok: true, json: async () => ranks };
    };
  } else {
    globalThis.fetch = async (url) => {
      throw new Error(`unexpected network request: ${url}`);
    };
  }

  return () => {
    if (scenario === "hypertok") {
      assert.equal(fetchCount, 0);
    } else {
      assert.equal(fetchCount, 1);
      assert.equal(fetchedUrl, expectedUrl);
    }
  };
}

async function importGetEncoding() {
  const module = await import(
    pathToFileURL(resolve(coreRoot, "dist/utils/tiktoken.js")).href
  );
  return module.getEncoding;
}

async function runColdWorker(scenario, encoding, type) {
  const assertBackend = configureBackend(scenario, encoding);
  const getEncoding = await importGetEncoding();
  const { coldDocument, coldBytes } = createCorpus(type);
  globalThis.gc?.();
  const started = performance.now();
  const encoder = await getEncoding(encoding);
  const cumulativeMs = {};
  let tokenCount;
  for (let call = 1; call <= coldCheckpoints.at(-1); call += 1) {
    const count = encoder.encode(coldDocument).length;
    tokenCount ??= count;
    assert.equal(count, tokenCount);
    if (coldCheckpoints.includes(call)) {
      cumulativeMs[call] = performance.now() - started;
    }
  }
  assertBackend();
  return { coldBytes, tokenCount, cumulativeMs };
}

function measureSteady(encoder, documents) {
  globalThis.gc?.();
  let tokenCount = 0;
  const started = performance.now();
  for (const document of documents) {
    tokenCount += encoder.encode(document).length;
  }
  return { tokenCount, milliseconds: performance.now() - started };
}

async function runSteadyWorker(scenario, encoding, type) {
  const assertBackend = configureBackend(scenario, encoding);
  const getEncoding = await importGetEncoding();
  const { documents, bytes } = createCorpus(type);
  const encoder = await getEncoding(encoding);
  assertBackend();
  for (let warmup = 0; warmup < warmups; warmup += 1) {
    measureSteady(encoder, documents);
  }
  const timings = [];
  let tokenCount;
  for (let sample = 0; sample < samples; sample += 1) {
    const measurement = measureSteady(encoder, documents);
    tokenCount ??= measurement.tokenCount;
    assert.equal(measurement.tokenCount, tokenCount);
    timings.push(measurement.milliseconds);
  }
  return { bytes, documents: documents.length, tokenCount, timings };
}

function runWorker(args) {
  const child = spawnSync(
    process.execPath,
    ["--expose-gc", scriptPath, "--worker", ...args],
    { encoding: "utf8" }
  );
  if (child.status !== 0) {
    throw new Error(
      `${args.join("/")} failed (${child.status})\n${child.stdout}\n${child.stderr}`
    );
  }
  return JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1));
}

function collectColdResults() {
  const raw = {};
  for (const encoding of encodings) {
    raw[encoding] = {};
    for (const type of documentTypes) {
      raw[encoding][type] = Object.fromEntries(
        coldScenarios.map((scenario) => [scenario, []])
      );
      for (let sample = 0; sample < samples; sample += 1) {
        const order = coldScenarios.map(
          (_, index) => coldScenarios[(index + sample) % coldScenarios.length]
        );
        for (const scenario of order) {
          raw[encoding][type][scenario].push(
            runWorker(["cold", scenario, encoding, type])
          );
        }
      }
      const counts = new Set(
        coldScenarios.flatMap((scenario) =>
          raw[encoding][type][scenario].map((result) => result.tokenCount)
        )
      );
      assert.equal(counts.size, 1);
    }
  }
  return raw;
}

function collectSteadyResults() {
  const raw = {};
  for (const encoding of encodings) {
    raw[encoding] = {};
    for (const type of documentTypes) {
      raw[encoding][type] = {};
      const order =
        (encodings.indexOf(encoding) + documentTypes.indexOf(type)) % 2 === 0
          ? steadyScenarios
          : [...steadyScenarios].reverse();
      for (const scenario of order) {
        raw[encoding][type][scenario] = runWorker([
          "steady",
          scenario,
          encoding,
          type,
        ]);
      }
      assert.equal(
        raw[encoding][type].hypertok.tokenCount,
        raw[encoding][type]["js-cached"].tokenCount
      );
    }
  }
  return raw;
}

function renderResults(cold, steady) {
  const lines = [
    "# LangChainJS token-count benchmark",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Node: ${process.version}. Medians of ${samples}. Equal token counts are asserted for every comparison.`,
    "",
    "## Cold start",
    "",
    "Each sample runs in a fresh process. Timing begins immediately before `getEncoding` and includes encoder initialization plus 1, 10, or 100 counts of one document. Process startup, corpus preparation, and module import are excluded. Values are median milliseconds per call, including initialization amortized across the named call count.",
    "",
    "| Encoding | Document type | Path | Document bytes | Tokens | 1 call | 10 calls | 100 calls |",
    "|---|---|---|---:|---:|---:|---:|---:|",
  ];
  for (const encoding of encodings) {
    for (const type of documentTypes) {
      for (const scenario of coldScenarios) {
        const results = cold[encoding][type][scenario];
        const cumulative = Object.fromEntries(
          coldCheckpoints.map((checkpoint) => [
            checkpoint,
            median(results.map((result) => result.cumulativeMs[checkpoint])),
          ])
        );
        const label = {
          hypertok: "hypertok local",
          "js-fetch": "js-tiktoken live fetch",
          "js-cached": "js-tiktoken pre-cached JSON",
        }[scenario];
        lines.push(
          `| ${encoding} | ${type} | ${label} | ${results[0].coldBytes} | ${results[0].tokenCount} | ${cumulative[1].toFixed(4)} | ${(cumulative[10] / 10).toFixed(4)} | ${(cumulative[100] / 100).toFixed(4)} |`
        );
      }
    }
  }
  lines.push(
    "",
    "### Cold-start raw timings",
    "",
    "Each entry contains cumulative milliseconds at 1, 10, and 100 calls for all nine samples.",
    ""
  );
  for (const encoding of encodings) {
    for (const type of documentTypes) {
      for (const scenario of coldScenarios) {
        const raw = cold[encoding][type][scenario].map((result) =>
          coldCheckpoints.map((checkpoint) => result.cumulativeMs[checkpoint])
        );
        lines.push(
          `- ${encoding} / ${type} / ${scenario}: \`${JSON.stringify(raw)}\``
        );
      }
    }
  }

  lines.push(
    "",
    "## Steady state",
    "",
    `Each path is constructed once through \`getEncoding\`. Two warmups are discarded, followed by ${samples} timed corpus passes. The js-tiktoken path receives pre-cached rank JSON so the table isolates encode throughput.`,
    "",
    "| Encoding | Document type | Path | Corpus bytes | Documents | Tokens | Median ms | MB/s | Relative speed |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|"
  );
  for (const encoding of encodings) {
    for (const type of documentTypes) {
      const hypertokMedian = median(steady[encoding][type].hypertok.timings);
      for (const scenario of steadyScenarios) {
        const result = steady[encoding][type][scenario];
        const milliseconds = median(result.timings);
        const mbps = result.bytes / 1_000_000 / (milliseconds / 1000);
        const relative =
          scenario === "hypertok" ? 1 : milliseconds / hypertokMedian;
        const label = scenario === "hypertok" ? "hypertok" : "js-tiktoken";
        lines.push(
          `| ${encoding} | ${type} | ${label} | ${result.bytes} | ${result.documents} | ${result.tokenCount} | ${milliseconds.toFixed(4)} | ${mbps.toFixed(2)} | ${relative.toFixed(2)}x |`
        );
      }
    }
  }
  lines.push("", "### Steady-state raw timings", "");
  for (const encoding of encodings) {
    for (const type of documentTypes) {
      for (const scenario of steadyScenarios) {
        lines.push(
          `- ${encoding} / ${type} / ${scenario}: \`${JSON.stringify(steady[encoding][type][scenario].timings)}\``
        );
      }
    }
  }

  lines.push(
    "",
    "## Method",
    "",
    "- `hypertok local` uses the default `getEncoding` path and rejects any unexpected network request.",
    "- `js-tiktoken live fetch` rejects hypertok imports and verifies exactly one request to `tiktoken.pages.dev`.",
    "- `js-tiktoken pre-cached JSON` rejects hypertok imports and supplies the rank object from memory through the same fetch boundary.",
    "- Prose comes from the repository README and contributing guide. TypeScript comes from six `@langchain/core` source files. CJK uses Chinese, Japanese, and Korean text. No result blends document types.",
    "- Garbage collection runs immediately before timed sections when Node exposes it. Operating-system file caches are not flushed. Live-fetch results include network conditions on the generation date.",
    "",
    "Run from the repository root:",
    "",
    "```sh",
    "node libs/langchain-core/scripts/benchmark_tiktoken.mjs",
    "```",
    ""
  );
  return lines.join("\n");
}

async function main() {
  const [mode, regime, scenario, encoding, type] = process.argv.slice(2);
  if (mode === "--worker") {
    assert.ok(["cold", "steady"].includes(regime));
    assert.ok(encodings.includes(encoding));
    assert.ok(documentTypes.includes(type));
    assert.ok(
      (regime === "cold" ? coldScenarios : steadyScenarios).includes(scenario)
    );
    const result =
      regime === "cold"
        ? await runColdWorker(scenario, encoding, type)
        : await runSteadyWorker(scenario, encoding, type);
    console.log(JSON.stringify(result));
    return;
  }
  const cold = collectColdResults();
  const steady = collectSteadyResults();
  console.log(renderResults(cold, steady));
}

await main();
