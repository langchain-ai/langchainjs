/* eslint-disable react/jsx-props-no-spreading, react/destructuring-assignment */
import React from "react";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import CodeBlock from "@theme-original/CodeBlock";
import Npm2Yarn from "@theme/Npm2Yarn";
import Admonition from "@theme/Admonition";

function InstallationInfo({ children }) {
  return (
    <>
      <Admonition type="tip">
        <p>
          See{" "}
          <a href="/docs/how_to/installation/#installing-integration-packages">
            this section for general instructions on installing integration
            packages
          </a>
          .
        </p>
      </Admonition>
      <Npm2Yarn>{children}</Npm2Yarn>
    </>
  );
}

const DEFAULTS = {
  openaiParams: `{\n  model: "gpt-4o-mini",\n  temperature: 0\n}`,
  anthropicParams: `{\n  model: "claude-3-5-sonnet-20240620",\n  temperature: 0\n}`,
  fireworksParams: `{\n  model: "accounts/fireworks/models/llama-v3p1-70b-instruct",\n  temperature: 0\n}`,
  mistralParams: `{\n  model: "mistral-large-latest",\n  temperature: 0\n}`,
  groqParams: `{\n  model: "llama-3.3-70b-versatile",\n  temperature: 0\n}`,
  vertexParams: `{\n  model: "gemini-1.5-flash",\n  temperature: 0\n}`,
  geminiParams: `{\n  model: "gemini-2.0-flash",\n  temperature: 0\n}`,
};

const MODELS_WSO = [
  "openai",
  "anthropic",
  "gemini",
  "mistral",
  "groq",
  "vertex",
];

/**
 * @typedef {Object} ChatModelTabsProps - Component props.
 * @property {string} [openaiParams] - Parameters for OpenAI chat model. Defaults to `"{\n  model: "gpt-3.5-turbo",\n  temperature: 0\n}"`
 * @property {string} [anthropicParams] - Parameters for Anthropic chat model. Defaults to `"{\n  model: "claude-3-sonnet-20240229",\n  temperature: 0\n}"`
 * @property {string} [fireworksParams] - Parameters for Fireworks chat model. Defaults to `"{\n  model: "accounts/fireworks/models/firefunction-v1",\n  temperature: 0\n}"`
 * @property {string} [mistralParams] - Parameters for Mistral chat model. Defaults to `"{\n  model: "mistral-large-latest",\n  temperature: 0\n}"`
 * @property {string} [groqParams] - Parameters for Groq chat model. Defaults to `"{\n  model: "mixtral-8x7b-32768",\n  temperature: 0\n}"`
 * @property {string} [vertexParams] - Parameters for Google VertexAI chat model. Defaults to `"{\n  model: "gemini-1.5-pro",\n  temperature: 0\n}"`
 * @property {string} [geminiParams] - Parameters for Google Gemini chat model. Defaults to `"{\n  model: "gemini-2.0-flash",\n  temperature: 0\n}"`
 *
 * @property {boolean} [hideOpenai] - Whether or not to hide OpenAI chat model.
 * @property {boolean} [hideAnthropic] - Whether or not to hide Anthropic chat model.
 * @property {boolean} [hideFireworks] - Whether or not to hide Fireworks chat model.
 * @property {boolean} [hideMistral] - Whether or not to hide Mistral chat model.
 * @property {boolean} [hideGroq] - Whether or not to hide Groq chat model.
 * @property {boolean} [hideVertex] - Whether or not to hide VertexAI chat model.
 * @property {boolean} [hideGemini] - Whether or not to hide Google Gemini chat model.
 * @property {string} [customVarName] - Custom variable name for the model. Defaults to `"model"`.
 * @property {boolean} [onlyWso] - Only display models which have `withStructuredOutput` implemented.
 */

/**
 * @param {ChatModelTabsProps} props - Component props.
 */
export default function ChatModelTabs(props) {
  const { customVarName, additionalDependencies } = props;

  const llmVarName = customVarName ?? "model";

  const openaiParams = props.openaiParams ?? DEFAULTS.openaiParams;
  const anthropicParams = props.anthropicParams ?? DEFAULTS.anthropicParams;
  const fireworksParams = props.fireworksParams ?? DEFAULTS.fireworksParams;
  const mistralParams = props.mistralParams ?? DEFAULTS.mistralParams;
  const groqParams = props.groqParams ?? DEFAULTS.groqParams;
  const vertexParams = props.vertexParams ?? DEFAULTS.vertexParams;
  const geminiParams = props.geminiParams ?? DEFAULTS.geminiParams;
  const providers = props.providers ?? [
    "groq",
    "openai",
    "anthropic",
    "gemini",
    "fireworks",
    "mistral",
    "vertex",
  ];

  const tabs = {
    openai: {
      value: "openai",
      label: "OpenAI",
      default: true,
      text: `import { ChatOpenAI } from "@langchain/openai";\n\nconst ${llmVarName} = new ChatOpenAI(${openaiParams});`,
      envs: `OPENAI_API_KEY=your-api-key`,
      dependencies: "@langchain/openai",
    },
    anthropic: {
      value: "anthropic",
      label: "Anthropic",
      default: false,
      text: `import { ChatAnthropic } from "@langchain/anthropic";\n\nconst ${llmVarName} = new ChatAnthropic(${anthropicParams});`,
      envs: `ANTHROPIC_API_KEY=your-api-key`,
      dependencies: "@langchain/anthropic",
    },
    gemini: {
      value: "gemini",
      label: "Google Gemini",
      default: false,
      text: `import { ChatGoogleGenerativeAI } from "@langchain/google-genai";\n\nconst ${llmVarName} = new ChatGoogleGenerativeAI(${geminiParams});`,
      envs: `GOOGLE_API_KEY=your-api-key`,
      dependencies: "@langchain/google-genai",
    },
    fireworks: {
      value: "fireworks",
      label: "FireworksAI",
      default: false,
      text: `import { ChatFireworks } from "@langchain/community/chat_models/fireworks";\n\nconst ${llmVarName} = new ChatFireworks(${fireworksParams});`,
      envs: `FIREWORKS_API_KEY=your-api-key`,
      dependencies: "@langchain/community",
    },
    mistral: {
      value: "mistral",
      label: "MistralAI",
      default: false,
      text: `import { ChatMistralAI } from "@langchain/mistralai";\n\nconst ${llmVarName} = new ChatMistralAI(${mistralParams});`,
      envs: `MISTRAL_API_KEY=your-api-key`,
      dependencies: "@langchain/mistralai",
    },
    groq: {
      value: "groq",
      label: "Groq",
      default: false,
      text: `import { ChatGroq } from "@langchain/groq";\n\nconst ${llmVarName} = new ChatGroq(${groqParams});`,
      envs: `GROQ_API_KEY=your-api-key`,
      dependencies: "@langchain/groq",
    },
    vertex: {
      value: "vertex",
      label: "VertexAI",
      default: false,
      text: `import { ChatVertexAI } from "@langchain/google-vertexai";\n\nconst ${llmVarName} = new ChatVertexAI(${vertexParams});`,
      envs: `GOOGLE_APPLICATION_CREDENTIALS=credentials.json`,
      dependencies: "@langchain/google-vertexai",
    },
  };

  const displayedTabs = (props.onlyWso ? MODELS_WSO : providers).map(
    (provider) => tabs[provider]
  );

  return (
    <div>
      <h3>Pick your chat model:</h3>
      <Tabs groupId="modelTabs">
        {displayedTabs.map((tab) => (
          <TabItem value={tab.value} label={tab.label} key={tab.value}>
            <h4>Install dependencies</h4>
            <InstallationInfo>
              {[tab.dependencies, additionalDependencies].join(" ")}
            </InstallationInfo>
            <h4>Add environment variables</h4>
            <CodeBlock language="bash">{tab.envs}</CodeBlock>
            <h4>Instantiate the model</h4>
            <CodeBlock language="typescript">{tab.text}</CodeBlock>
          </TabItem>
        ))}
      </Tabs>
    </div>
  );
}
