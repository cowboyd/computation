
export function iterable<T>(iterator: Iterator<T>): Iterable<T> {
  return {
    [Symbol.iterator]: () => iterator
  };
}
