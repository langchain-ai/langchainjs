import {Tool, Toolkit} from "./base";

function parseInput(input: string): (string | number)[] {
    const regex = /\[.*?]/g;
    const _res = input.match(regex) ?? [];
    const res = _res.map((i) => i.slice(1, -1).replace('"', ''));
    return res.map((i) => (Number.isNaN(+i) ? i : +i));
}

export class JsonSpec {
    obj: { [key: string]: any };

    max_value_length = 4000;


    constructor(obj: object, max_value_length = 4000) {
        this.obj = obj;
        this.max_value_length = max_value_length;
    }

    public getKeys(input: string): string {
        try {
            const keys = parseInput(input);
            let res = this.obj;
            for (const key of keys) {
                res = res[key];
            }
            // check if res is a dictionary
            if (typeof res === "object" && res !== null) {
                return Object.keys(res).join(", ");
            }
            throw new Error(`Value at ${input} is not a dictionary, get the value directly instead.`);
        } catch (error) {
            return `${error}`;
        }
    }

    public getValue(input: string): string {
        try {
            const keys = parseInput(input);
            let res = this.obj;
            for (const key of keys) {
                res = res[key];
            }
            const str = `${res}`;
            if (typeof res === "object" && res !== null && str.length > this.max_value_length) {
                return `Value is a large dictionary, should explore its keys directly.`;
            }

            if (str.length > this.max_value_length) {
                // truncate the string
                return `${str.slice(0, this.max_value_length)}...`;
            }
            return str;
        } catch (error) {
            return `${error}`;
        }
    }
}

export class JsonListKeysTool extends Tool {
    name = "json_list_keys";


    constructor(public jsonSpec: JsonSpec) {
        super();
    }

    async call(input: string) {
        return this.jsonSpec.getKeys(input);
    }

    description = `Useful for getting the keys of a json object. 
    The input to this tool should be a valid json path to a dictionary, e.g. [a, b, c]`;
}

export class JsonGetValueTool extends Tool {
    name = "json_get_value";

    constructor(public jsonSpec: JsonSpec) {
        super();
    }

    async call(input: string) {
        return this.jsonSpec.getValue(input);
    }
}
