import { CallbackManagerForChainRun, Callbacks } from "callbacks/manager.js";
import { BaseChain, ChainInputs } from "chains/base.js";
import { ChainValues } from "schema/index.js";

export interface Route {
  destination?: string;
  nextInputs: { [key: string]: any };
}

export interface MultiRouteChainInput extends ChainInputs {
  routerChain: RouterChain;
  destinationChains: { [name: string]: BaseChain };
  defaultChain: BaseChain;
  silentErrors?: boolean;
}

export abstract class RouterChain extends BaseChain {
  get outputKeys(): string[] {
    return ["destination", "next_inputs"];
  }

  async route(inputs: ChainValues, callbacks?: Callbacks): Promise<Route> {
    const result = await this.call(inputs, callbacks);
    return {
      destination: result.destination,
      nextInputs: result.next_inputs,
    };
  }
}

export class MultiRouteChain extends BaseChain {
  routerChain: RouterChain;
  destinationChains: { [name: string]: BaseChain };
  defaultChain: BaseChain;
  silentErrors: boolean = false;

  constructor(fields: MultiRouteChainInput) {
    super(fields.memory, fields.verbose, fields.callbackManager);
    this.routerChain = fields.routerChain;
    this.destinationChains = fields.destinationChains;
    this.defaultChain = fields.defaultChain;
    this.silentErrors = fields.silentErrors ?? this.silentErrors;
  }

  get inputKeys(): string[] {
    return this.routerChain.inputKeys;
  }

  get outputKeys(): string[] {
    return [];
  }

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    const { destination, nextInputs } = await this.routerChain.route(
      values,
      runManager?.getChild()
    );
    runManager?.handleText(`${destination}: ${JSON.stringify(nextInputs)}`);

    if (!destination) {
      return this.defaultChain.call(nextInputs, runManager?.getChild());
    } else if (destination in this.destinationChains) {
      return this.destinationChains[destination].call(
        nextInputs,
        runManager?.getChild()
      );
    } else if (this.silentErrors) {
      return this.defaultChain.call(nextInputs, runManager?.getChild());
    } else {
      throw new Error(
        `Destination ${destination} not found in destination chains.`
      );
    }
  }

  _chainType(): string {
    return "multi_route_chain";
  }
}
