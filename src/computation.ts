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
  }

  /**
   * Continue this computation. Right now, how operations are handled
   * is implicit, and that's not great. Either it's a computation, in
   * which case it gets subscribed to, or it's an operation in which
   * case it is run. Can we get away from subscriptions? Can we just
   * not assume anything about operations?
   */
  resume(input: TResume): void {
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
}

export type Operation<Out = unknown> = Block<Computation<Out>, void>;

export type Code<Out> = Iterator<Operation, Out, any>;

export type Block<In,Out> = (input: In) => Code<Out>;
