import { DynamicTool, DynamicToolInput } from "./dynamic.js";

interface LambdaConfig {
  functionName: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

interface LambdaClientConstructorArgs {
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

class AWSLambda extends DynamicTool {
  private lambdaConfig: LambdaConfig;

  constructor({
    name,
    description,
    ...rest
  }: LambdaConfig & Omit<DynamicToolInput, "func">) {
    super({
      name,
      description,
      func: async (input: string) => this._func(input),
    });

    this.lambdaConfig = rest;
  }

  /** @ignore */
  async _func(input: string): Promise<string> {
    const { Client, Invoker } = await LambdaImports();

    const clientConstructorArgs: LambdaClientConstructorArgs = {};

    if (this.lambdaConfig.region) {
      clientConstructorArgs.region = this.lambdaConfig.region;
    }

    if (this.lambdaConfig.accessKeyId && this.lambdaConfig.secretAccessKey) {
      clientConstructorArgs.credentials = {
        accessKeyId: this.lambdaConfig.accessKeyId,
        secretAccessKey: this.lambdaConfig.secretAccessKey,
      };
    }

    const lambdaClient = new Client(clientConstructorArgs);

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
