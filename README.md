# @effection/computation

An experiment in trying to find a primitive for working with
generators in the context of effection.

## Something is Missing from ExecutionContext

As we settle on better and better external interfaces for writing
programs with effection it's becoming clear that the underlying
flow-control mechanisms are not really adequate. Specifically,
working with low-level operators was sufficiently painful that
[implementing resources] was a pretty non- trivial exercise. Instead
of fighting the underlying runtime, is there a way we can be as
harmonic with it as possible?

The fact is, native javascript generators are really powerful, they
support asynchronous error handling as well as asynchronous
cleanup. These are the pieces that we've been missing, and so how can
we lean on these existing features as a single composable piece that
can be we can use to build our effection trees.

### What's missing from generators?

Why aren't generators alone enough? Why would we need to layer something on
top of them?

I believe that answer is that a single generators can only reppresent a
_single_ computation, and not a _stack_ or tree of computations that
depend on each other as we see in effection. What we're looking to do
is provide the minimum API possible to glue together individual
computations into a tree. This repository is an exploration of what
exactly that primitive for composing generators is so that even the
glue that holds them together is flexible and can be defined in an
extensible manner.

It's a spike with no correct answers that can be changed at any point.

We just want to see "How simple can we make it?"

## Blocks

The current implementation doubles down on the generator function API
and makes it ubiquitous. The heuristic is: if I could use a function
here or a generator, unless there is a compelling reason, let's use a
generator. The reason this is, is that any function can be modelled as
a generator, but not the other way around. Let's take for example an
simple function that logs to the console:

``` typescript
function logString(str) {
  console.log('str = ', str);
}
```

vs a generator:

``` typescript
function* logString(str) {
  console.log('str = ', str);
}
```

Anywhere we could use `logStr`, we could also use `*logStr` as well by
calling it, and then running the first operation.

To generalize this concept, this uses the idea of a `Block` as the
fundamental unit of composisiotn. It's just a single-arg function that
returns an iterator of Operations (except for the last item which is
the result).

``` typescript
type Block<Input,Output> = (input: Input) => Iterator<Operation, Output>;
```

> We should definitely explore generalizing this mechanism to take any
> number of arguments, but it was kept at a single argument for
> simplicity.

We can see that this is just the signature for a generalized
`GeneratorFunction`. and our `**logStr` would have a type of
`Block<string,void>`.

We can represent blocks as `GeneratorFunction`s, but we could also
represent them with nothing but an array of operations.

``` typescript

const logStr: Block<string,void> = (str) => iterate([
  op(() => console.log('str =', ))
])
```

> Glossing over the concept of an operation here.... so the `op`
> function is a bit magical, but let's assume for now that it takes a
> one-shot function and evaluates it as an operation. Also, let's just
> the assume the `iterate` function just gets the iterator for an
> iterable.

Now, we don't care if `logStr` is implemented as a generator or as
function that returns an iteration of operations. Everything is in
harmony with the underlying platform.

## Computation

A computation a the thing that evaluates the operations of a block, it
can compose results from other computations.

## Operation

In effection today, every operation boils down to a "control function" which
is a simple function that takes a set of controls which it can use to
resume, fail, or halt the current execution context. This repo, turns
that a bit on its head and uses a normal block to reresent an
operation. The only thing special about an operation is that an
its block doesn't take any old argument as its input, it takes the
current computation in which that operation is running: (that way it
can resume it)

If viewed that way, we can implement almost any "primitive operation"
as generator. For example, `timeout` becomes:

``` typescript
function timeout(durationMillis: number): Operation<void> {
  return function*(computation) {
    let timeoutId = setTimeout(() => computation.resume());
    try {
      yield computation;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

The only primitive needed then is for one computation to be able to
yield to another.

## Questions

- Should we break out the idea of a Computation and an Evaluation into
  separate concepts where Computation is not stateful and Evaluation
  is?

- The current computation still relies on callbacks via the
  `subscription` interface. That stinks, can we get rid of them and
  just always be able to call `resume` at the right time?

- Current computation has implicit semantics when the item yielded is
  a computation. I feel like we should make that explicit, not
  implicit

- Should `yield undefined` be the equivalent of `yield self`?

## Examples

``` sh
$ yarn node -r ts-node/register test/computation.test.ts
```
