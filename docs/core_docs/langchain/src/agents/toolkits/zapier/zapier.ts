import { Toolkit } from "../base.js";
import { Tool } from "../../../tools/base.js";
import { ZapierNLARunAction, ZapierNLAWrapper } from "../../../tools/zapier.js";

/**
 * Represents a toolkit for working with Zapier actions. It extends the
 * Toolkit class and provides functionality for managing Zapier tools.
 */
export class ZapierToolKit extends Toolkit {
  tools: Tool[] = [];

  /**
   * Creates a ZapierToolKit instance based on a ZapierNLAWrapper instance.
   * It retrieves the list of available actions from the ZapierNLAWrapper
   * and creates a ZapierNLARunAction tool for each action. The created
   * tools are added to the tools property of the ZapierToolKit instance.
   * @param zapierNLAWrapper The ZapierNLAWrapper instance to create the ZapierToolKit from.
   * @returns A Promise that resolves to a ZapierToolKit instance.
   */
  static async fromZapierNLAWrapper(
    zapierNLAWrapper: ZapierNLAWrapper
  ): Promise<ZapierToolKit> {
    const toolkit = new ZapierToolKit();
    const actions = await zapierNLAWrapper.listActions();
    for (const action of actions) {
      const tool = new ZapierNLARunAction(
        zapierNLAWrapper,
        action.id,
        action.description,
        action.params
      );
      toolkit.tools.push(tool);
    }
    return toolkit;
  }
}
