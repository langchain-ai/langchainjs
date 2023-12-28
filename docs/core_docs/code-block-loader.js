/* eslint-disable prefer-template */
/* eslint-disable no-param-reassign */
// eslint-disable-next-line import/no-extraneous-dependencies
const swc = require("@swc/core");
const path = require("path");
const fs = require("fs");

/**
 *
 * @param {string|Buffer} content Content of the resource file
 * @param {object} [map] SourceMap data consumable by https://github.com/mozilla/source-map
 * @param {any} [meta] Meta data, could be anything
 */
async function webpackLoader(content, map, meta) {
  const cb = this.async();
  const BASE_URL = "https://api.js.langchain.com";
  // Directories generated inside the API docs (excluding "modules").
  const CATEGORIES = [
    "classes",
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
            imports.push({ local, imported, source });
          } else {
            throw new Error("Unsupported import type");
          }
        });
      }
    });

    const getDocsPath = (componentPath) =>
      path.resolve(__dirname, "..", "api_refs", "public", componentPath);

    const getPackageModuleName = (moduleName, imported, category) => {
      const prefix = `${category}/langchain`;
      const suffix = `.${imported}.html`;

      if (suffix.includes("Runnable") && moduleName.startsWith("core")) {
        return `${category}/langchain_schema_runnable${suffix}`;
      }

      // @TODO - Find a better way to deal with core
      if (moduleName.startsWith("core")) {
        return `${category}/langchain_schema${suffix}`;
      }

      return `${prefix}_${moduleName}_${suffix}`;
    };

    /**
     * Somewhat of a hacky solution to finding the exact path of the docs file.
     * Maps over all categories in the API docs and if the file exists, returns the path.
     * @param {string} moduleName
     * @param {string} imported
     * @returns {string | undefined}
     */
    const findExactPath = (moduleName, imported) => {
      let modulePath;
      CATEGORIES.forEach((category) => {
        // from langchain/src
        const componentPathLangChain = `${category}/langchain_${
          moduleName.startsWith("core_")
            ? moduleName.replace("core_", "")
            : moduleName
        }.${imported}.html`;
        const docsPathLangChain = getDocsPath(componentPathLangChain);

        // from packages
        const componentPathPackage = getPackageModuleName(
          moduleName,
          imported,
          category
        );
        const docsPathPackage = componentPathPackage
          ? getDocsPath(componentPathPackage)
          : null;

        // The modules from `langchain-core` are named differently in the API docs.
        const componentPathWithSchema = `${category}/langchain_schema_${moduleName.slice(
          0,
          -1
        )}.${imported}.html`;
        const newDocsPath = getDocsPath(componentPathWithSchema);

        // Check with the package name split off.
        // This is because some modules are re-exported from langchain
        // but the import might be from the package itself.
        if (fs.existsSync(docsPathLangChain)) {
          modulePath = componentPathLangChain;
        } else if (fs.existsSync(newDocsPath)) {
          modulePath = componentPathWithSchema;
        } else if (docsPathPackage && fs.existsSync(docsPathPackage)) {
          modulePath = componentPathPackage;
        }
      });
      return modulePath;
    };

    imports.forEach((imp) => {
      const { imported, source } = imp;
      const moduleName = source.split("/").slice(1).join("_").replace("-", "_");
      const exactPath = findExactPath(moduleName, imported);
      if (exactPath) {
        imp.docs = BASE_URL + "/" + exactPath;
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `${this.resourcePath}: Could not find docs for ${moduleName}.${imported} or schema_${moduleName}.${imported} in api_refs/public/`
        );
      }
    });

    cb(null, JSON.stringify({ content, imports }), map, meta);
  } catch (err) {
    cb(err);
  }
}

module.exports = webpackLoader;
