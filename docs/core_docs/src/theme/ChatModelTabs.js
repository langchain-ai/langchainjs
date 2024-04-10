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
          <a href="/docs/get_started/installation#installing-integration-packages">
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
  openaiParams: `{\n  model: "gpt-3.5-turbo-0125",\n  temperature: 0\n}`,
  anthropicParams: `{\n  model: "claude-3-sonnet-20240229",\n  temperature: 0\n}`,
  fireworksParams: `{\n  model: "accounts/fireworks/models/firefunction-v1",\n  temperature: 0\n}`,
  mistralParams: `{\n  model: "mistral-large-latest",\n  temperature: 0\n}`,
};

/**
 * @typedef {Object} ChatModelTabsProps - Component props.
 * @property {string} [openaiParams] - Parameters for OpenAI chat model. Defaults to `"{\n  model: "gpt-3.5-turbo-0125",\n  temperature: 0\n}"`
 * @property {string} [anthropicParams] - Parameters for Anthropic chat model. Defaults to `"{\n  model: "claude-3-sonnet-20240229",\n  temperature: 0\n}"`
 * @property {string} [fireworksParams] - Parameters for Fireworks chat model. Defaults to `"{\n  model: "accounts/fireworks/models/firefunction-v1",\n  temperature: 0\n}"`
 * @property {string} [mistralParams] - Parameters for Mistral chat model. Defaults to `"{\n  model: "mistral-large-latest",\n  temperature: 0\n}"`
 * @property {boolean} [hideOpenai] - Whether or not to hide OpenAI chat model.
 * @property {boolean} [hideAnthropic] - Whether or not to hide Anthropic chat model.
 * @property {boolean} [hideFireworks] - Whether or not to hide Fireworks chat model.
 * @property {boolean} [hideMistral] - Whether or not to hide Mistral chat model.
 * @property {string} [customVarName] - Custom variable name for the model. Defaults to `"model"`.
 */

/**
 * @param {ChatModelTabsProps} props - Component props.
 */
export default function ChatModelTabs(props) {
  const {
    hideOpenai,
    hideAnthropic,
    hideFireworks,
    hideMistral,
    customVarName,
  } = props;

  const llmVarName = customVarName ?? "model";

  const openaiParams = props.openaiParams ?? DEFAULTS.openaiParams;
  const anthropicParams = props.anthropicParams ?? DEFAULTS.anthropicParams;
  const fireworksParams = props.fireworksParams ?? DEFAULTS.fireworksParams;
  const mistralParams = props.mistralParams ?? DEFAULTS.mistralParams;

  const tabs = [
    {
      value: "OpenAI",
      label: "OpenAI",
      default: true,
      text: `import { ChatOpenAI } from "@langchain/openai";\n\nconst ${llmVarName} = new ChatOpenAI(${openaiParams});`,
      envs: `OPENAI_API_KEY=your-api-key`,
      dependencies: "@langchain/openai",
      shouldHide: hideOpenai,
    },
    {
      value: "Anthropic",
      label: "Anthropic",
      default: false,
      text: `import { ChatAnthropic } from "@langchain/anthropic";\n\nconst ${llmVarName} = new ChatAnthropic(${anthropicParams});`,
      envs: `ANTHROPIC_API_KEY=your-api-key`,
      dependencies: "@langchain/anthropic",
      shouldHide: hideAnthropic,
    },
    {
      value: "FireworksAI",
      label: "FireworksAI",
      default: false,
      text: `import { ChatFireworks } from "@langchain/community/chat_models/fireworks";\n\nconst ${llmVarName} = new ChatFireworks(${fireworksParams});`,
      envs: `FIREWORKS_API_KEY=your-api-key`,
      dependencies: "@langchain/community",
      shouldHide: hideFireworks,
    },
    {
      value: "MistralAI",
      label: "MistralAI",
      default: false,
      text: `import { ChatMistralAI } from "@langchain/mistralai";\n\nconst ${llmVarName} = new ChatMistralAI(${mistralParams});`,
      envs: `MISTRAL_API_KEY=your-api-key`,
      dependencies: "@langchain/mistralai",
      shouldHide: hideMistral,
    },
  ];

  return (
    <div>
      <h3>Pick your chat model:</h3>
      <Tabs groupId="modelTabs">
        {tabs
          .filter((tab) => !tab.shouldHide)
          .map((tab) => (
            <TabItem value={tab.value} label={tab.label} key={tab.value}>
              <h4>Install dependencies</h4>
              <InstallationInfo>{tab.dependencies}</InstallationInfo>
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
