import { customZip } from "../utils/utils.js"

describe('Custom zip function', () => {
  test('should return an array of tuples', async () => {
    const tuples = customZip([1,2,3,4,5], ["a","b","c","d","e"])
    expect(tuples).toStrictEqual([[1, 'a'], [2, 'b'], [3, 'c'], [4, 'd'], [5, 'e']])
  })

  test('should return an array of tuples with arrays of different lengths', async () => {
    const tuples = customZip([1,2,3,4,5], ["a","b","c"])
    expect(tuples).toStrictEqual([[1, 'a'], [2, 'b'], [3, 'c']])
  })

  test('should return an array of tuples of with n arrays', async () => {
    const tuples = customZip([1,2,3,4,5], ["a","b","c","d","e"], [{key1: "value1"}, {key2: "value2"}, {key3: "value3"}])
    expect(tuples).toStrictEqual([[1, 'a', {key1: "value1"}], [2, 'b', {key2: "value2"}], [3, 'c', {key3: "value3"}]])
  })
})