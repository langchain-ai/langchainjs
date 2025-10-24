import React from "react";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import CodeBlock from "@theme-original/CodeBlock";

// Substitute component for Jupyter notebooks since Quarto has trouble
// parsing built-in npm2yarn markdown blocks
export default function Npm2Yarn({ children }) {
  return (
    <Tabs groupId="npm2yarn">
      <TabItem value="npm" label="npm">
        <CodeBlock language="bash">npm i {children}</CodeBlock>
      </TabItem>
      <TabItem value="yarn" label="yarn" default>
        <CodeBlock language="bash">yarn add {children}</CodeBlock>
      </TabItem>
      <TabItem value="pnpm" label="pnpm">
        <CodeBlock language="bash">pnpm add {children}</CodeBlock>
      </TabItem>
    </Tabs>
  );
}
