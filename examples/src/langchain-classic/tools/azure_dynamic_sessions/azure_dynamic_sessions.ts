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
