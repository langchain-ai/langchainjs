import { DynamicTool, DynamicToolInput } from "./dynamic.js";

/**
 * Interface for the configuration of the AWS Lambda function.
 */
interface LambdaConfig {
  functionName: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * Interface for the arguments to the LambdaClient constructor.
 */
interface LambdaClientConstructorArgs {
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

/**
 * Class for invoking AWS Lambda functions within the LangChain framework.
 * Extends the DynamicTool class.
 */
class AWSLambda extends DynamicTool {
  get lc_namespace(): string[] {
    return [...super.lc_namespace, "aws_lambda"];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      accessKeyId: "AWS_ACCESS_KEY_ID",
      secretAccessKey: "AWS_SECRET_ACCESS_KEY",
    };
  }

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

/**
 * Helper function that imports the necessary AWS SDK modules for invoking
 * the Lambda function. Returns an object that includes the LambdaClient
 * and InvokeCommand classes from the AWS SDK.
 */
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
