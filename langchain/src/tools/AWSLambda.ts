import { Tool } from "./base.js";

interface LambdaConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  functionName: string;
}

class AWSLambda extends Tool {
  name: string;

  description: string;

  private lambdaConfig: LambdaConfig;

  constructor(
    toolName: string,
    toolDescription: string,
    lambdaConfig: LambdaConfig
  ) {
    super();

    this.name = toolName;
    this.description = toolDescription;
    this.lambdaConfig = lambdaConfig;
  }

  async _call(input: string): Promise<string> {
    const { Client, Invoker } = await LambdaImports();

    const lambdaClient = new Client({
      region: this.lambdaConfig.region,
      credentials: {
        accessKeyId: this.lambdaConfig.accessKeyId,
        secretAccessKey: this.lambdaConfig.secretAccessKey,
      },
    });

    return new Promise((resolve) => {
      const payloadUint8Array = new TextEncoder().encode(JSON.stringify(input));

      const command = new Invoker({
        FunctionName: this.lambdaConfig.functionName,
        InvocationType: "RequestResponse",
        Payload: payloadUint8Array,
      });

      lambdaClient
        .send(command)
        .then((response) => {
          const responseData = JSON.parse(
            new TextDecoder().decode(response.Payload)
          );

          resolve(responseData.body ? responseData.body : "request completed.");
        })
        .catch((error: Error) => {
          console.error("Error invoking Lambda function:", error);
          resolve("failed to complete request");
        });
    });
  }
}

async function LambdaImports() {
  try {
    const { LambdaClient, InvokeCommand } = await import(
      "@aws-sdk/client-lambda"
    );

    return {
      Client: LambdaClient as typeof LambdaClient,
      Invoker: InvokeCommand as typeof InvokeCommand,
    };
  } catch (e) {
    console.error(e);
    throw new Error(
      "Failed to load @aws-sdk/client-lambda'. Please install it eg. `yarn add @aws-sdk/client-lambda`."
    );
  }
}

export { AWSLambda };
