import { BaseCallbackConfig } from "../../callbacks/manager.js";
import { Runnable } from "../../runnables/base.js";

export class FakeRunnable extends Runnable<string, Record<string, unknown>> {
  lc_namespace = ["tests", "fake"];

  returnOptions?: boolean;

  constructor(fields: { returnOptions?: boolean }) {
    super(fields);
    this.returnOptions = fields.returnOptions;
  }

  async invoke(
    input: string,
    options?: Partial<BaseCallbackConfig>
  ): Promise<Record<string, unknown>> {
    if (this.returnOptions) {
      return options ?? {};
    }
    return { input };
  }
}
