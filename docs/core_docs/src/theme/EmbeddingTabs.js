/* eslint-disable react/jsx-props-no-spreading, react/destructuring-assignment */
import React from "react";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import CodeBlock from "@theme-original/CodeBlock";
import Npm2Yarn from "@theme/Npm2Yarn";

const DEFAULTS = {
  openaiParams: `{\n  model: "text-embedding-3-large"\n}`,
  azureParams: `{\n  azureOpenAIApiEmbeddingsDeploymentName: "text-embedding-ada-002"\n}`,
  awsParams: `{\n  model: "amazon.titan-embed-text-v1"\n}`,
  vertexParams: `{\n  model: "text-embedding-004"\n}`,
  mistralParams: `{\n  model: "mistral-embed"\n}`,
  cohereParams: `{\n  model: "embed-english-v3.0"\n}`,
};

/**
 * @typedef {Object} EmbeddingTabsProps - Component props.
 * @property {string} [openaiParams]
 * @property {string} [azureParams]
 * @property {string} [awsParams]
 * @property {string} [vertexParams]
 * @property {string} [mistralParams]
 * @property {string} [cohereParams]
 *
 * @property {boolean} [hideOpenai]
 * @property {boolean} [hideAzure]
 * @property {boolean} [hideAws]
 * @property {boolean} [hideVertex]
 * @property {boolean} [hideMistral]
 * @property {boolean} [hideCohere]
 *
 * @property {string} [customVarName] - Custom variable name for the model. Defaults to `"embeddings"`.
 */

/**
 * @param {EmbeddingTabsProps} props - Component props.
 */
export default function EmbeddingTabs(props) {
  const { customVarName } = props;

  const embeddingsVarName = customVarName ?? "embeddings";

  const openaiParams = props.openaiParams ?? DEFAULTS.openaiParams;
  const azureParams = props.azureParams ?? DEFAULTS.azureParams;
  const awsParams = props.awsParams ?? DEFAULTS.awsParams;
  const vertexParams = props.vertexParams ?? DEFAULTS.vertexParams;
  const mistralParams = props.mistralParams ?? DEFAULTS.mistralParams;
  const cohereParams = props.cohereParams ?? DEFAULTS.cohereParams;
  const providers = props.providers ?? [
    "openai",
    "azure",
    "aws",
    "vertex",
    "mistral",
    "cohere",
  ];

  const tabs = {
    openai: {
      value: "openai",
      label: "OpenAI",
      default: true,
      text: `import { OpenAIEmbeddings } from "@langchain/openai";\n\nconst ${embeddingsVarName} = new OpenAIEmbeddings(${openaiParams});`,
      envs: `OPENAI_API_KEY=your-api-key`,
      dependencies: "@langchain/openai",
    },
    azure: {
      value: "azure",
      label: "Azure",
      default: false,
      text: `import { AzureOpenAIEmbeddings } from "@langchain/openai";\n\nconst ${embeddingsVarName} = new AzureOpenAIEmbeddings(${azureParams});`,
      envs: `AZURE_OPENAI_API_INSTANCE_NAME=<YOUR_INSTANCE_NAME>\nAZURE_OPENAI_API_KEY=<YOUR_KEY>\nAZURE_OPENAI_API_VERSION="2024-02-01"`,
      dependencies: "@langchain/openai",
    },
    aws: {
      value: "aws",
      label: "AWS",
      default: false,
      text: `import { BedrockEmbeddings } from "@langchain/aws";\n\nconst ${embeddingsVarName} = new BedrockEmbeddings(${awsParams});`,
      envs: `BEDROCK_AWS_REGION=your-region`,
      dependencies: "@langchain/aws",
    },
    vertex: {
      value: "vertex",
      label: "VertexAI",
      default: false,
      text: `import { VertexAIEmbeddings } from "@langchain/google-vertexai";\n\nconst ${embeddingsVarName} = new VertexAIEmbeddings(${vertexParams});`,
      envs: `GOOGLE_APPLICATION_CREDENTIALS=credentials.json`,
      dependencies: "@langchain/google-vertexai",
    },
    mistral: {
      value: "mistral",
      label: "MistralAI",
      default: false,
      text: `import { MistralAIEmbeddings } from "@langchain/mistralai";\n\nconst ${embeddingsVarName} = new MistralAIEmbeddings(${mistralParams});`,
      envs: `MISTRAL_API_KEY=your-api-key`,
      dependencies: "@langchain/mistralai",
    },
    cohere: {
      value: "cohereParams",
      label: "Cohere",
      default: false,
      text: `import { CohereEmbeddings } from "@langchain/cohere";\n\nconst ${embeddingsVarName} = new CohereEmbeddings(${cohereParams});`,
      envs: `COHERE_API_KEY=your-api-key`,
      dependencies: "@langchain/cohere",
    },
  };

  const displayedTabs = providers.map((provider) => tabs[provider]);

  return (
    <div>
      <h3>Pick your embedding model:</h3>
      <Tabs groupId="modelTabs">
        {displayedTabs.map((tab) => (
          <TabItem value={tab.value} label={tab.label} key={tab.value}>
            <h4>Install dependencies</h4>
            <Npm2Yarn>{tab.dependencies}</Npm2Yarn>
            <CodeBlock language="bash">{tab.envs}</CodeBlock>
            <CodeBlock language="typescript">{tab.text}</CodeBlock>
          </TabItem>
        ))}
      </Tabs>
    </div>
  );
}
