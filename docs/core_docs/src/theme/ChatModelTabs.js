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
  // OpenAI
  const openAIText = `import { ChatOpenAI } from "@langchain/openai";
  
const model = new ChatOpenAI(${openaiParams ?? "{}"});`;
  const openAIEnvText = `OPENAI_API_KEY=your-api-key`;
  const openAIProps = { value: "OpenAI", label: "OpenAI", default: true };

  // Anthropic
  const anthropicText = `import { ChatAnthropic } from "@langchain/anthropic";
  
const model = new ChatAnthropic(${anthropicParams ?? "{}"});`;
  const anthropicEnvText = `ANTHROPIC_API_KEY=your-api-key`;
  const anthropicProps = { value: "Anthropic", label: "Anthropic" };

  // FireworksAI
  const fireworksText = `import { ChatFireworks } from "@langchain/community/chat_models/fireworks";
  
const model = new ChatFireworks(${fireworksParams ?? "{}"});`;
  const fireworksEnvText = `FIREWORKS_API_KEY=your-api-key`;
  const fireworksProps = { value: "FireworksAI", label: "FireworksAI" };

  // MistralAI
  const mistralText = `import { ChatMistralAI } from "@langchain/mistralai";
  
const model = new ChatMistralAI(${mistralParams ?? "{}"});`;
  const mistralEnvText = `MISTRAL_API_KEY=your-api-key`;
  const mistralProps = { value: "MistralAI", label: "MistralAI" };

  return (
    <Tabs groupId="modelTabs">
      {hideOpenai ? null : (
        <TabItem {...openAIProps}>
          <InstallationInfo>@langchain/openai</InstallationInfo>
          <CodeBlock language="bash">{openAIEnvText}</CodeBlock>
          <CodeBlock language="typescript">{openAIText}</CodeBlock>
        </TabItem>
      )}
      {hideAnthropic ? null : (
        <TabItem {...anthropicProps}>
          <InstallationInfo>@langchain/anthropic</InstallationInfo>
          <CodeBlock language="bash">{anthropicEnvText}</CodeBlock>
          <CodeBlock language="typescript">{anthropicText}</CodeBlock>
        </TabItem>
      )}
      {hideFireworks ? null : (
        <TabItem {...fireworksProps}>
          <InstallationInfo>@langchain/community</InstallationInfo>
          <CodeBlock language="bash">{fireworksEnvText}</CodeBlock>
          <CodeBlock language="typescript">{fireworksText}</CodeBlock>
        </TabItem>
      )}
      {hideMistral ? null : (
        <TabItem {...mistralProps}>
          <InstallationInfo>@langchain/mistralai</InstallationInfo>
          <CodeBlock language="bash">{mistralEnvText}</CodeBlock>
          <CodeBlock language="typescript">{mistralText}</CodeBlock>
        </TabItem>
      )}
    </Tabs>
  );
}
