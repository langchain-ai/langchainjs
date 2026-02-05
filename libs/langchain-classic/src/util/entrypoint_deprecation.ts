import { getEnvironmentVariable } from "./env.js";

export function logVersion010MigrationWarning({
  oldEntrypointName,
  newEntrypointName,
  newPackageName = "@langchain/community",
}: {
  oldEntrypointName: string;
  newEntrypointName?: string;
  newPackageName?: string;
}) {
  let finalEntrypointName = "";
  if (newEntrypointName === undefined) {
    finalEntrypointName = `/${oldEntrypointName}`;
  } else if (newEntrypointName !== "") {
    finalEntrypointName = `/${newEntrypointName}`;
  }
  let warningText = [
    `[WARNING]: Importing from "langchain/${oldEntrypointName}" is deprecated.`,
    ``,
    `Instead, please add the "${newPackageName}" package to your project with e.g.`,
    ``,
    `    $ npm install ${newPackageName}`,
    ``,
    `and import from "${newPackageName}${finalEntrypointName}".`,
    ``,
    `This will be mandatory after the next "langchain" minor version bump to 0.2.`,
  ].join("\n");
  if (newPackageName === "@langchain/core") {
    warningText = [
      `[WARNING]: Importing from "langchain/${oldEntrypointName}" is deprecated.`,
      ``,
      `Instead, please import from "${newPackageName}${finalEntrypointName}".`,
      ``,
      `This will be mandatory after the next "langchain" minor version bump to 0.2.`,
    ].join("\n");
  }
  if (
    getEnvironmentVariable("LANGCHAIN_SUPPRESS_MIGRATION_WARNINGS") !== "true"
  ) {
    console.warn(warningText);
  }
}

export function logVersion020MigrationWarning({
  oldEntrypointName,
  newEntrypointName,
  newPackageName = "@langchain/community",
}: {
  oldEntrypointName: string;
  newEntrypointName?: string;
  newPackageName?: string;
}) {
  let finalEntrypointName = "";
  if (newEntrypointName === undefined) {
    finalEntrypointName = `/${oldEntrypointName}`;
  } else if (newEntrypointName !== "") {
    finalEntrypointName = `/${newEntrypointName}`;
  }
  let warningText = [
    `[WARNING]: Importing from "langchain/${oldEntrypointName}" is deprecated.`,
    ``,
    `Instead, please add the "${newPackageName}" package to your project with e.g.`,
    ``,
    `    $ npm install ${newPackageName}`,
    ``,
    `and import from "${newPackageName}${finalEntrypointName}".`,
    ``,
    `This will be mandatory after the next "langchain" minor version bump to 0.3.`,
  ].join("\n");
  if (newPackageName === "@langchain/core") {
    warningText = [
      `[WARNING]: Importing from "langchain/${oldEntrypointName}" is deprecated.`,
      ``,
      `Instead, please import from "${newPackageName}${finalEntrypointName}".`,
      ``,
      `This will be mandatory after the next "langchain" minor version bump to 0.3.`,
    ].join("\n");
  }
  if (
    getEnvironmentVariable("LANGCHAIN_SUPPRESS_MIGRATION_WARNINGS") !== "true"
  ) {
    console.warn(warningText);
  }
}
