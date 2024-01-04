const fs = require("fs/promises");
const path = require("path");
const { glob } = require("glob");

const TOOLTIP_CODE = (packageName) => `import IntegrationInstallTooltip from "@mdx_components/integration_install_tooltip.mdx";

<IntegrationInstallTooltip></IntegrationInstallTooltip>

\`\`\`bash npm2yarn
npm install ${packageName}
\`\`\`
`;

const startOfNpm2Yarn = `\`\`\`bash npm2yarn
npm install `;
const toolTipContent = `:::tip
See [this section for general instructions on installing integration packages](/docs/get_started/installation#installing-integration-packages).
:::`;
const integrationToolTipComponent = "<IntegrationInstallTooltip></IntegrationInstallTooltip>";
const CODEBLOCK_OPENING_TAG = `<CodeBlock language="typescript">`;

const PACKAGE_NAME = "@langchain/core";

/**
 * @param {string} packageName The name of the package to add.
 */
async function main(packageName) {
  /** @type {string[]} */
  const examplesWithPackageImports = [];
  /** @type {string[]} */
  const MDXFilesWithExamplesImports = [];

  async function checkIfImportsPackage(filePath) {
    const fileContents = await fs.readFile(filePath, "utf-8");
    if (fileContents.includes(`from "${packageName}`)) {
      console.log("found one!")
      const cleanedPath = filePath.replace(path.join("examples", "src"), "examples");
      examplesWithPackageImports.push(cleanedPath);
    }
  }

  async function checkIfImportsExampleFile(MDXFilePath) {
    const fileContents = await fs.readFile(MDXFilePath, "utf-8");

    for await (const exampleFile of examplesWithPackageImports) {
      if (fileContents.includes(`from "@${exampleFile}"`)) {
        MDXFilesWithExamplesImports.push(MDXFilePath);
      }
    }
  }

  async function getAllMDXWhichImportPackage() {
    const allMDXFiles = await glob(`docs/core_docs/docs/**/*.mdx`);
    for await (const mdxFile of allMDXFiles) {
      await checkIfImportsExampleFile(mdxFile);
    }
  }

  const allTSFiles = await glob(`examples/src/**/*.ts`);

  for await (const tsFile of allTSFiles) {
    await checkIfImportsPackage(tsFile);
  }

  await getAllMDXWhichImportPackage();

  function checkForExistingTooltip(filePathContents) {
    if (filePathContents.includes(integrationToolTipComponent)) {
      return true;
    }
    if (filePathContents.includes(toolTipContent)) {
      return true;
    }
  }

  /**
   * @param {string} content 
   */
  function editNpm2Yarn(content) {
    // Find the first occurrence of the tooltip component
    const tooltipIndex = content.indexOf(integrationToolTipComponent);
    if (tooltipIndex === -1) return content; // Tooltip not found, return original content.

    // Split the content at the tooltip component
    const beforeTooltip = content.substring(0, tooltipIndex + integrationToolTipComponent.length);
    const afterTooltip = content.substring(tooltipIndex + integrationToolTipComponent.length);

    // Find the first occurrence of the npm2yarn code block after the tooltip
    const npm2YarnIndex = afterTooltip.indexOf(startOfNpm2Yarn);
    if (npm2YarnIndex === -1) return content; // npm2yarn block not found, return original content.

    // Extract the npm2yarn code block content
    const npm2YarnContent = afterTooltip.split("```bash npm2yarn")[1].split("```")[0];
    if (npm2YarnContent.includes(packageName)) {
      /** The npm install command already includes {packageName} */
      return content;
    }

    // Replace the start of the npm2yarn block with the command including packageName
    const updatedAfterTooltip = afterTooltip.replace(startOfNpm2Yarn, `${startOfNpm2Yarn}${packageName} `);

    // Reconstruct the full content with the updated npm2yarn block
    const updatedContent = `${beforeTooltip}${updatedAfterTooltip}`;
    return updatedContent;
  }

  const MDXFilesUnique = [...new Set(MDXFilesWithExamplesImports)];

  /**
   * @param {string} MDXFilePath 
   */
  async function editMDXFileToAddTooltip(MDXFilePath) {
    const fileContents = await fs.readFile(MDXFilePath, "utf-8");
    if (checkForExistingTooltip(fileContents)) {
      console.log(`Tooltip already exists in ${MDXFilePath}, updating npm2yarn block if necessary.`);
      await fs.writeFile(MDXFilePath, editNpm2Yarn(fileContents));
      return;
    }

    const codeBlockIndex = fileContents.indexOf(CODEBLOCK_OPENING_TAG);
    if (codeBlockIndex === -1) return; // TypeScript code block not found, exit function.

    const contentBeforeCodeBlock = fileContents.substring(0, codeBlockIndex);
    const contentAfterCodeBlock = fileContents.substring(codeBlockIndex);

    const updatedFileContents = `${contentBeforeCodeBlock}${TOOLTIP_CODE(packageName)}\n${contentAfterCodeBlock}`;
    await fs.writeFile(MDXFilePath, updatedFileContents);
  }

  for await (const MDXFileToEdit of MDXFilesUnique) {
    await editMDXFileToAddTooltip(MDXFileToEdit);
  }
}

main(PACKAGE_NAME)
