import { Operation, Block, Computation } from '../src/computation';

Computation.of(function*() {
  console.log('Starting a Random Number server for 5 seconds...');

  let server = yield fork(function*() {
    try {
      while (true) {
        let randomNumber = Math.random() * 1000;
        console.log('here is a random number: ', randomNumber);
        yield timeout(randomNumber);
      }
    } finally {
      console.log('server cleanup...');
      for (let i = 5; i > 0; i--) {
        console.log(i);
        yield timeout(1000);
      }
    }
  });

  yield timeout(5000);

  console.log('halting server');
  yield halt(server);

}).resume();

export function timeout(durationMillis: number): Operation<void> {
  return function*(self: Computation<void, unknown>) {
    let timeoutId = setTimeout(() => self.resume(), durationMillis)
    try {
      yield self;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function fork<T>(block: Block<void, T>) {
  return function*(k: Computation<Computation<void, T>>) {
    let child = Computation.of(block)

    yield resume(child);

    yield resume(k, child);
  }
};

export function halt(computation: Computation<unknown>): Operation<void> {
  return function*(k: Computation<void>) {
    let teardown = computation.interrupt();

    yield resume(teardown);

    yield resume(k);
  }
}

export function resume<T>(computation: Computation<T>, input?: T): Operation<Computation<T>> {
  return function*(self) {
    setTimeout(() => {
      computation.resume(input);
    }, 0);

    self.resume(computation);
  }
}
