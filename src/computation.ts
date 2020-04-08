export class Computation<TResume, TResult = unknown> {
  block: Block<TResume, TResult>;
  iterator: Code<TResult>;
  current: IteratorResult<Executable, TResult> = { done: false, value: undefined };

  get done() { return this.current && this.current.done; }
  get value() { return this.current && this.current.value; }
  get result(): TResult { return this.done ? this.current.value as TResult : undefined; }
  error?: Error;

  subscriptions = new Set<Callback<TResult>>();

  static id<T>() {
    return new Computation<T,T>(function* (input) { return input; });
  }

  static of<TResume = void, TResult = unknown>(block: Block<TResume, TResult>) {
    return new Computation(block);
  }

  constructor(block: Block<TResume, TResult>) {
    this.block = block;
    this.resume = this.resume.bind(this);
    this.fail = this.fail.bind(this);
    this.interrupt = this.interrupt.bind(this);
  }

  /**
   * Return a new computation that takes the result of this
   * computaiton, and then uses it as the input for `block`
   */
  then<Out>(block: Block<TResult, Out>): Computation<TResume, Out> {
    let antecedent = this;

    return new Computation<TResume, Out>(function* (input: TResume) {
      antecedent.resume(input);
      let result: TResult = yield antecedent;

      return yield* iterable(block(result));
    });
  }

  /**
   * Return a new comptation that executes `block` and then uses the
   * output of it as the input to the previous computation.
   */
  before<In>(block: Block<In, TResume>): Computation<In,TResult> {
    let antecedent = this;

    return new Computation(function*(input: In) {
      let result: TResume = yield* iterable(block(input));
      antecedent.resume(result);
      return yield antecedent;
    });
  }

  /**
   * Return a new computation which runs the previous computation, but
   * catches any error and passing `error` to the given block. The new
   * computation will return either the same result type of the
   * original computation, or `Error` result if an error occured.
   */
  rescue<ErrorResult>(block: Block<Error, ErrorResult>): Computation<TResume, TResult | ErrorResult> {
    let current = this;

    return new Computation(function*(input) {
      try {
        current.resume(input);
        return yield current;
      } catch (error) {
        return yield* iterable(block(error));
      }
    });
  }

  /**
   * Return a new computation that has the exact same input/output
   * type as the original, but it is guaranteed to run the `block`
   */
  ensure(block: Block<void, void>): Computation<TResume, TResult> {
    let current = this;

    return new Computation<TResume, TResult>(function*(input) {
      try {
        current.resume(input);
        return yield current;
      } finally {
        yield* iterable(block());
      }
    });
  }



  /**
   * Continue this computation. Right now, how operations are handled
   * is implicit, and that's not great. Either it's a computation, in
   * which case it gets subscribed to, or it's an operation in which
   * case it is run. Can we get away from subscriptions? Can we just
   * not assume anything about operations?
   */
  resume(input: TResume, cb: Callback<TResult> = x => x): void {
    this.subscribe(cb);
    if (this.done) {
      return;
    } else {
      if (!this.iterator) {
        this.iterator = this.block(input);
      }
      this.current = this.iterator.next(input);
      if (this.done) {
        finalize(this);
      } else {
        if (this.value instanceof Computation) {
          let antecedent: Computation<unknown> = this.value;
          let propagate = () => link(antecedent, this);
          let unsubscribe = antecedent.subscribe(propagate);
          this.subscribe(unsubscribe);
        } else {
          let caller = this;
          let scope = Computation.id<TResume>()
            .then(function*(result) {
              caller.resume(result);
            }).rescue(function*(error) {
              caller.fail(error);
            });
          Computation.of(this.value as Operation).resume(scope);
        }
      }
    }
  }

  subscribe(callback: Callback<TResult>): () => void {
    if (this.done) {
      callback(this);
      return () => null;
    } else {
      this.subscriptions.add(callback);
      return () => this.subscriptions.delete(callback);
    }
  }

  /**
   * Immediately marks this computation as finished, and aborts the
   * generator, then returns a computation representing the "rest" of
   * the teardown in anything that might be in a finally.
   */
  interrupt(): Computation<void,void> {
    finalize(this);

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

  fail(error: Error) {
    //TODO
    console.error('fail with: ', error);
  }
}

export type Operation<Out = unknown> = Block<Computation<Out>, void>;

export type Executable<T = unknown> = Operation<T> | Computation<T>;

export type Code<Out> = Iterator<Executable<unknown>, Out, any>;

export type Block<In,Out> = (input: In) => Code<Out>;

interface Callback<TResult> {
  (computation: Computation<unknown, TResult>): void;
}

function iterable<T>(iterator: Iterator<T>): Iterable<T> {
  return {
    [Symbol.iterator]: () => iterator
  };
}

function finalize(computation: Computation<unknown>): void {
  for (let listener of computation.subscriptions) {
    listener(computation);
  }
  computation.subscriptions.clear();
}

function link<Value>(source: Computation<unknown, Value>, destination: Computation<Value>) {
  if (source.error) {
    destination.fail(source.error);
  } else if (!source.done) {
    let error = new Error(`InterruptedError`);
    destination.fail(error);
  } else if (source.done) {
    destination.resume(source.result);
  }
}
