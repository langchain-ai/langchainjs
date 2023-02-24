import {Tool, Toolkit} from "./base";

function parseInput(input: string): (string | number)[] {
    const regex = /\[.*?]/g;
    const _res = input.match(regex) ?? [];
    const res = _res.map((i) => i.slice(1, -1).replace(/['"]+/g, ''));
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
        const keys = parseInput(input);
        let res = this.obj;
        for (const key of keys) {
            res = res[key];
        }
        if (res.constructor === Object) {
            return Object.keys(res).join(", ");
        }
        throw new Error(`Value at ${input} is not a dictionary, get the value directly instead.`);
    }

    public getValue(input: string): string {
        const keys = parseInput(input);
        let res = this.obj;
        for (const key of keys) {
            res = res[key];
        }
        const str = res.constructor === Object ? JSON.stringify(res) : res.toString();
        if (res.constructor === Object && str.length > this.max_value_length) {
            return `Value is a large dictionary, should explore its keys directly.`;
        }

        if (str.length > this.max_value_length) {
            return `${str.slice(0, this.max_value_length)}...`;
        }
        return str;
    }
}

export class JsonListKeysTool extends Tool {
    name = "json_list_keys";


    constructor(public jsonSpec: JsonSpec) {
        super();
    }

    async call(input: string) {
        try {
            return this.jsonSpec.getKeys(input);
        } catch (error) {
            return `${error}`;
        }
    }

    description = `Can be used to list all keys at a given path. 
    Before calling this you should be SURE that the path to this exists.
    The input is a text representation of the path to the dict in Python syntax (e.g. data["key1"][0]["key2"]).`;
}

export class JsonGetValueTool extends Tool {
    name = "json_get_value";

    constructor(public jsonSpec: JsonSpec) {
        super();
    }

    async call(input: string) {
        try {
            return this.jsonSpec.getValue(input);
        } catch (error) {
            return `${error}`;
        }
    }

    description: `Can be used to see value in string format at a given path.
    Before calling this you should be SURE that the path to this exists.
    The input is a text representation of the path to the dict in Python syntax (e.g. data["key1"][0]["key2"]).`;
}

export class JsonToolkit extends Toolkit {
    tools: Tool[];

    constructor(public jsonSpec: JsonSpec) {
        super();
        this.tools = [new JsonListKeysTool(jsonSpec), new JsonGetValueTool(jsonSpec)];
    }
}
