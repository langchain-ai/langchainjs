# @langchain/azure-dynamic-sessions 

This package contains the [Azure Container Apps dynamic sessions](https://learn.microsoft.com/azure/container-apps/sessions) tool integration.

Learn more about how to use this tool in the [LangChain documentation](https://js.langchain.com/docs/integrations/tools/azure_dynamic_sessions).

## Installation

```bash npm2yarn
npm install @langchain/azure-dynamic-sessions
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate fields to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/azure-openai": "^0.0.4",
    "langchain": "0.0.207"
  },
  "resolutions": {
    "@langchain/core": "0.1.5"
  },
  "overrides": {
    "@langchain/core": "0.1.5"
  },
  "pnpm": {
    "overrides": {
      "@langchain/core": "0.1.5"
    }
  }
}
```

The field you need depends on the package manager you're using, but we recommend adding a field for the common `yarn`, `npm`, and `pnpm` to maximize compatibility.

## Tool usage

```typescript
import { SessionsPythonREPLTool } from "@langchain/azure-dynamic-sessions";

const tool = new SessionsPythonREPLTool({
  poolManagementEndpoint:
    process.env.AZURE_CONTAINER_APP_SESSION_POOL_MANAGEMENT_ENDPOINT || "",
});

const result = await tool.invoke("print('Hello, World!')\n1+2");

console.log(result);

// {
//   stdout: "Hello, World!\n",
//   stderr: "",
//   result: 3,
// }
```
