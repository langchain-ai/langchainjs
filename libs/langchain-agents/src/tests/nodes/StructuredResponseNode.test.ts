// describe("getModel", () => {
//   it("Should extract the model from different inputs", async () => {
//     const model = new FakeToolCallingChatModel({
//       responses: [new AIMessage("test")],
//     });
//     expect(await getModel(model)).toBe(model);

//     const tool1 = tool((input) => `Tool 1: ${input.someVal}`, {
//       name: "tool1",
//       description: "Tool 1 docstring.",
//       schema: z.object({
//         someVal: z.number().describe("Input value"),
//       }),
//     });

//     const modelWithTools = model.bindTools([tool1]);
//     expect(await getModel(modelWithTools)).toBe(model);

//     const seq = RunnableSequence.from([
//       model,
//       RunnableLambda.from((message) => message),
//     ]);
//     expect(await getModel(seq)).toBe(model);

//     const seqWithTools = RunnableSequence.from([
//       model.bindTools([tool1]),
//       RunnableLambda.from((message) => message),
//     ]);
//     expect(await getModel(seqWithTools)).toBe(model);

//     const raisingSeq = RunnableSequence.from([
//       RunnableLambda.from((message) => message),
//       RunnableLambda.from((message) => message),
//     ]);
//     await expect(async () => await getModel(raisingSeq)).rejects.toThrow(Error);

//     // test configurable model
//     const configurableModel = new FakeConfigurableModel({
//       model,
//     });

//     expect(await getModel(configurableModel)).toBe(model);
//     expect(await getModel(configurableModel.bindTools([tool1]))).toBe(model);

//     const configurableSeq = RunnableSequence.from([
//       // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       configurableModel as any,
//       RunnableLambda.from((message) => message),
//     ]);
//     expect(await getModel(configurableSeq)).toBe(model);

//     const configurableSeqWithTools = RunnableSequence.from([
//       // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       configurableModel.bindTools([tool1]) as any,
//       RunnableLambda.from((message) => message),
//     ]);
//     expect(await getModel(configurableSeqWithTools)).toBe(model);

//     const raisingConfigurableSeq = RunnableSequence.from([
//       RunnableLambda.from((message) => message),
//       RunnableLambda.from((message) => message),
//     ]);
//     await expect(
//       async () => await getModel(raisingConfigurableSeq)
//     ).rejects.toThrow(Error);
//   });
// });
