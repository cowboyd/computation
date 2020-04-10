import { iterable } from './iterable';

export class Computation<TResume, TResult = unknown> {
  block: Block<TResume, TResult>;
  iterator: Code<TResult>;
  current: IteratorResult<Operation, TResult> = { done: false, value: undefined };

  get done() { return this.current && this.current.done; }
  get value() { return this.current && this.current.value; }
  get result(): TResult { return this.done ? this.current.value as TResult : undefined; }
  error?: Error;

  static id<T>() {
    return new Computation<T,T>(function* (input) { return input; });
  }

  static of<TResume = void, TResult = unknown>(block: Block<TResume, TResult>) {
    return new Computation(block);
  }

  constructor(block: Block<TResume, TResult>) {
    this.block = block;
    this.resume = this.resume.bind(this);
    this.interrupt = this.interrupt.bind(this);
  }

  /**
   * Continue this computation. Right now, how operations are handled
   * is implicit, and that's not great. Either it's a computation, in
   * which case it gets subscribed to, or it's an operation in which
   * case it is run. Can we get away from subscriptions? Can we just
   * not assume anything about operations?
   */
  resume(input: TResume): void {
    if (this.done) {
      return;
    }

    if (!this.iterator) {
      this.iterator = this.block(input);
    }

    this.current = this.iterator.next(input);
    if (!this.done && this.value) {
      let caller = this;
      let scope = Computation.of<TResume>(function*(result) {
        caller.resume(result);
      })
      Computation.of(this.value as Operation).resume(scope);
    }
  }

  /**
   * Immediately marks this computation as finished, and aborts the
   * generator, then returns a computation representing the "rest" of
   * the teardown in anything that might be in a finally.
   */
  interrupt(): Computation<void,void> {

    let { iterator } = this;

    if (!iterator || !iterator.return) {
      return Computation.id();
    } else {
      let { done, value } = iterator.return();

      return Computation.of(function*() {
        if (!done) {
          yield value as Operation;
          yield* iterable(iterator);
        }
      });
    }
  }
}

export type Operation<Out = unknown> = Block<Computation<Out>, void>;

export type Code<Out> = Iterator<Operation, Out, any>;

export type Block<In,Out> = (input: In) => Code<Out>;

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
