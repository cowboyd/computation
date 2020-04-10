import { Computation, halt, timeout, fork } from '../src/index';

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
