import { Block, Computation, Operation } from './computation';
import { iterable } from './iterable';

/**
 * resume `computation` in the next tick of the run loop
 */
export function resume<T>(computation: Computation<T>, input?: T): Operation<void> {
  return function*(self) {
    let timeouts = [
      setTimeout(() => computation.resume(input), 0),
      setTimeout(() => self.resume(), 0)
    ]
    try {
      yield;
    } finally {
      timeouts.forEach(clearTimeout);
    }
  }
}

/**
 * Immediately return from `computation`, and then if there are any operations left over,
 * run them.
 *
 * > Note: This does not issue any warnings or errors, or if the halt takes too long!!!
 * > also, is it right to yield?
 */
export function halt(computation: Computation<unknown>): Operation<void> {
  return function*(k: Computation<void>) {

    let { done, value } = computation.iterator.return();

    if (!done) {
      yield value as Operation;
      yield* iterable(computation.iterator);
    }

    yield resume(k);
  }
}

/**
 * Creates another computation, starts it, and then immediately resumes the original
 * computation, similar to the way `spawn` works in effection currently.
 *
 * > Note: This does not yet do any automatic halting of the fork when the parent exits.
 * > This is a big TODO:
 */
export function fork<T>(block: Block<void, T>) {
  return function*(k: Computation<Computation<void, T>>) {
    let child = Computation.of(block)

    yield resume(child);

    yield resume(k, child);
  }
};

export function timeout(durationMillis: number): Operation<void> {
  return function*(self: Computation<void, unknown>) {
    let timeoutId = setTimeout(() => self.resume(), durationMillis)
    try {
      yield;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
