/* eslint-disable react/jsx-props-no-spreading */
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

/**
 * @param {{ openaiParams?: string, anthropicParams?: string, fireworksParams?: string, mistralParams?: string, hideOpenai?: boolean, hideAnthropic?: boolean, hideFireworks?: boolean, hideMistral?: boolean }} props
 */
export default function ChatModelTabs(props) {
  const {
    openaiParams,
    anthropicParams,
    fireworksParams,
    mistralParams,
    hideOpenai,
    hideAnthropic,
    hideFireworks,
    hideMistral,
  } = props;

  const tabs = [
    {
      value: "OpenAI",
      label: "OpenAI",
      default: true,
      text: `import { ChatOpenAI } from "@langchain/openai";\n\nconst model = new ChatOpenAI(${openaiParams ?? "{}"});`,
      envs: `OPENAI_API_KEY=your-api-key`,
      dependencies: "@langchain/openai",
      shouldHide: hideOpenai,
    },
    {
      value: "Anthropic",
      label: "Anthropic",
      default: false,
      text: `import { ChatAnthropic } from "@langchain/anthropic";\n\nconst model = new ChatAnthropic(${anthropicParams ?? "{}"});`,
      envs: `ANTHROPIC_API_KEY=your-api-key`,
      dependencies: "@langchain/anthropic",
      shouldHide: hideAnthropic,
    },
    {
      value: "FireworksAI",
      label: "FireworksAI",
      default: false,
      text: `import { ChatFireworks } from "@langchain/community/chat_models/fireworks";\n\nconst model = new ChatFireworks(${fireworksParams ?? "{}"});`,
      envs: `FIREWORKS_API_KEY=your-api-key`,
      dependencies: "@langchain/community",
      shouldHide: hideFireworks,
    },
    {
      value: "MistralAI",
      label: "MistralAI",
      default: false,
      text: `import { ChatMistralAI } from "@langchain/mistralai";\n\nconst model = new ChatMistralAI(${mistralParams ?? "{}"});`,
      envs: `MISTRAL_API_KEY=your-api-key`,
      dependencies: "@langchain/mistralai",
      shouldHide: hideMistral,
    },
  ]

  return (
    <div>
      <h3>Pick your chat model:</h3>
      <Tabs groupId="modelTabs">
        {tabs.filter(tab => !tab.shouldHide).map((tab) => (
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
