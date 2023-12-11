import { RunnableLambda } from "./base.js";

const double = RunnableLambda.from((n: number) => n * 2)
const addStr = RunnableLambda.from((s: string) => s + "test")

const a = double.pipe(_n => 'test')
const b = double.pipe(_n => double)
const c = double.pipe(async (n: number) => {
    if (n > 3) return 2
    return double
})


const y = double.pipe(n => {
    if (n > 3) return double
    return 2
})

const z = double.pipe(addStr)
