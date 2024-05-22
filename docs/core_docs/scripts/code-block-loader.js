/* eslint-disable prefer-template */
/* eslint-disable no-param-reassign */
// eslint-disable-next-line import/no-extraneous-dependencies
const swc = require("@swc/core");
const path = require("path");
const fs = require("fs");

/**
 * Edge cases where the import will not match the proper API ref path.
 * This is typically caused by a re-export, or an aliased export so we
 * must manually map the import to the correct path.
 */
const SYMBOL_EDGE_CASE_MAP = {
  InMemoryStore: {
    sources: ["langchain/storage/in_memory"],
    originalSource: "@langchain/core/stores",
    originalSymbolName: null,
  },
  ToolMessage: {
    sources: ["@langchain/core/messages"],
    originalSource: "@langchain/core/messages/tool",
    originalSymbolName: null,
  },
  zodToGeminiParameters: {
    sources: ["@langchain/google-vertexai/utils"],
    originalSource: "@langchain/google-common",
    originalSymbolName: null,
  },
  FunctionalTranslator: {
    sources: ["langchain/retrievers/self_query/functional"],
    originalSource: "@langchain/core/structured_query",
    originalSymbolName: null,
  },
  ChatMessageHistory: {
    sources: [
      "langchain/stores/message/in_memory",
      "@langchain/community/stores/message/in_memory",
    ],
    originalSource: "@langchain/core/chat_history",
    originalSymbolName: "InMemoryChatMessageHistory",
  },
  GeminiTool: {
    sources: ["@langchain/google-vertexai/types"],
    originalSource: "@langchain/google-common/types",
    originalSymbolName: null,
  },
  RecursiveCharacterTextSplitter: {
    sources: ["langchain/text_splitter"],
    originalSource: "@langchain/textsplitters",
    originalSymbolName: null,
  },
  CharacterTextSplitter: {
    sources: ["langchain/text_splitter"],
    originalSource: "@langchain/textsplitters",
    originalSymbolName: null,
  },
  TokenTextSplitter: {
    sources: ["langchain/text_splitter"],
    originalSource: "@langchain/textsplitters",
    originalSymbolName: null,
  },
  SupportedTextSplitterLanguages: {
    sources: ["langchain/text_splitter"],
    originalSource: "@langchain/textsplitters",
    originalSymbolName: null,
  },
};

/**
 * Symbols which will never exist in the API refs.
 *
 * This can be caused by re-exports from non LangChain
 * packages.
 */
const SYMBOLS_TO_SKIP_MAP = {
  LunaryHandler: {
    source: "@langchain/community/callbacks/handlers/lunary",
  },
  updateEntrypointsFrom0_0_xTo0_1_x: {
    source: "@langchain/scripts/migrations",
  },
};

/**
 *
 * @param {string|Buffer} content Content of the resource file
 * @param {object} [map] SourceMap data consumable by https://github.com/mozilla/source-map
 * @param {any} [meta] Meta data, could be anything
 */
async function webpackLoader(content, map, meta) {
  const cb = this.async();
  const BASE_URL = "https://v02.api.js.langchain.com";
  // Directories generated inside the API docs (excluding "modules").
  const CATEGORIES = [
    "classes",
    "enums",
    "functions",
    "interfaces",
    "types",
    "variables",
  ];

  if (!this.resourcePath.endsWith(".ts")) {
    cb(null, JSON.stringify({ content, imports: [] }), map, meta);
    return;
  }

  try {
    const module = await swc.parse(content, {
      isModule: true,
      filename: this.resourcePath,
      syntax: "typescript",
    });

    const imports = [];

    module.body.forEach((node) => {
      if (node.type === "ImportDeclaration") {
        const source = node.source.value;

        if (
          !source.startsWith("langchain") &&
          !source.startsWith("@langchain")
        ) {
          return;
        }

        node.specifiers.forEach((specifier) => {
          if (specifier.type === "ImportSpecifier") {
            const local = specifier.local.value;
            const imported = specifier.imported?.value ?? local;
            // Only push imports if the symbol & source is not in the skip map.
            if (
              !(
                imported in SYMBOLS_TO_SKIP_MAP &&
                SYMBOLS_TO_SKIP_MAP[imported].source === source
              )
            ) {
              imports.push({ local, imported, source });
            }
          } else {
            throw new Error("Unsupported import type");
          }
        });
      }
    });

    /**
     * Create a full path to the API ref docs file, given a "componentPath".
     * A "componentPath" is a string in the format of "category/module/symbol.html".
     *
     * @param {string} componentPath The path to the component in the API docs.
     * @returns {string} The path to the API docs file.
     */
    const getDocsPath = (componentPath) =>
      path.resolve("..", "api_refs", "public", componentPath);

    /**
     * Given an imported symbol and source, find the path to the API ref docs.
     * If no match is found, return null.
     *
     * @param {string} imported The name of the imported symbol. E.g. `ChatOpenAI`
     * @param {string} source The name of the package/module it was imported from. E.g. `@langchain/openai`
     * @returns {string | null} The path to the API docs file or null if not found.
     */
    const findApiRefPath = (imported, source) => {
      // Fix the source if it's an edge case.
      if (
        imported in SYMBOL_EDGE_CASE_MAP &&
        SYMBOL_EDGE_CASE_MAP[imported].sources.some((s) => s === source)
      ) {
        source = SYMBOL_EDGE_CASE_MAP[imported].originalSource;
        imported =
          SYMBOL_EDGE_CASE_MAP[imported].originalSymbolName ?? imported;
      }

      let cleanedSource = "";
      if (source.startsWith("@langchain/")) {
        cleanedSource = source
          .replace("@langchain/", "langchain_")
          .replaceAll("/", "_")
          .replaceAll("-", "_");
      } else if (source.startsWith("langchain")) {
        cleanedSource = source
          .replace("langchain/", "langchain_")
          .replaceAll("/", "_")
          .replaceAll("-", "_");
      } else {
        throw new Error(
          `Invalid source: ${source}. Must be prefixed with one of "langchain/" or "@langchain/"`
        );
      }
      const componentPath = `${cleanedSource}.${imported}.html`;

      /**
       * Defaults to null, reassigned to string if a match is found.
       * @type {null | string}
       */
      let actualPath = null;
      CATEGORIES.forEach((category) => {
        if (actualPath !== null) {
          return;
        }
        const fullPath = `${category}/${componentPath}`;
        const pathExists = fs.existsSync(getDocsPath(fullPath));
        if (pathExists) {
          actualPath = fullPath;
        }
      });
      return actualPath;
    };

    imports.forEach((imp) => {
      const { imported, source } = imp;
      const apiRefPath = findApiRefPath(imported, source);

      if (apiRefPath) {
        imp.docs = BASE_URL + "/" + apiRefPath;
      } else {
        // `this.resourcePath` is typically the absolute path. By splitting at "examples/"
        // we can get the relative path to the examples directory, making the error more readable.
        const cleanedResourcePath = this.resourcePath.includes("examples/")
          ? this.resourcePath.split("examples/")[1]
          : this.resourcePath;
        console.warn(
          {
            imported,
            source,
          },
          `examples/${cleanedResourcePath}: Could not find API refs link.`
        );
      }
    });

    cb(null, JSON.stringify({ content, imports }), map, meta);
  } catch (err) {
    cb(err);
  }
}

module.exports = webpackLoader;
