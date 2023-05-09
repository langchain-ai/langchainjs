import { BaseLLM, LLM } from '../../llms/base.js';
import { BaseFileStore } from '../../schema/index.js';

import { ICalTool } from '../ical.js';
import {
  getIcsString,
  getInputCommand,
  getOutputPrompt,
} from '../fixtures/ical.js';

export class FakeLLM extends LLM {
  _llmType(): string {
    return 'fake';
  }

  async _call(prompt: string): Promise<string> {
    return prompt;
  }
}

describe('ICalTool', () => {
  let tool: ICalTool;
  let store: BaseFileStore;
  let llm: BaseLLM;

  const uuidRegex =
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g;

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2019-10-21'));
  });

  beforeEach(() => {
    store = {
      writeFile: jest.fn(),
      readFile: jest.fn(),
    };
    llm = new FakeLLM({});
    tool = new ICalTool({ store, llm });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('_call', () => {
    it('should create iCal file and return success message', async () => {
      const inputStr = getInputCommand();

      const expectedFilename = 'events.ics';

      const writeFileSpy = jest
        .spyOn(store, 'writeFile')
        .mockResolvedValueOnce();
      jest
        .spyOn(llm, 'call')
        .mockResolvedValueOnce(getOutputPrompt());

      const result = await tool._call(inputStr);

      expect(result).toEqual(`${expectedFilename} created successfully`);
      expect(store.writeFile).toHaveBeenCalledWith(
        expectedFilename,
        expect.any(String)
      );
      expect(writeFileSpy.mock.calls[0][0]).toEqual(expectedFilename);
      expect(
        writeFileSpy.mock.calls[0][1]
          .replace(uuidRegex, 'UUID_PLACEHOLDER')
          .replace(/\r\n/g, '\n')
      ).toEqual(getIcsString());
    });
  });
});
