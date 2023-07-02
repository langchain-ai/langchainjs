import { Toolkit } from "../base.js";
import { Tool } from "../../../tools/base.js";
import { ZapierNLARunAction, ZapierNLAWrapper } from "../../../tools/zapier.js";

export class ZapierToolKit extends Toolkit {
  tools: Tool[] = [];

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
