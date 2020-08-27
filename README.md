# wordlist-iterator
## Supports only ES6 or higher.
**wordlist-iterator**'s only export is [async generator function][async-generator] which gives you ability to continue iteration of wordlist after **breaks**, **returns** and **throws** in [_for await...of_][for-await-of] loop from where you left off, and thus get around the [_Do not reuse generators_][Do-not-reuse-generators] problem.

## Usage
The only export of **wordlist-iterator**  is **wordlistIterator** _async generator function_ which accepts two arguments - _wordlistPath_, _WordListIteratorOptions_,  and returns [async Iterable][async-iterable] to iterate through the words of wordlist.

**Arguments:**
1. _wordlistPath_ - absolute path to wordlist
1. _WordListIteratorOptions_? - **Optional** object which takes only property _highWaterMark_, which will be passed to **openReadStream** function under the hood, for more details see [fs.createReadStream options][nodejs-docs].

This examples below are very self explanatory:
```javascript
const { wordlistIterator, testWordlist } = require('wordlist-iterator')


const execute = async () => {
    const wordlist = wordlistIterator(testWordlist)

    let index = 0
    for await (const word of wordlist) {
        console.log(`word: ${word}`)
        // do some async stuff...
        if (index++ === 2) break // stop on 3rd word if reached.
    }
    // do stuff between iterations...
    // ... await stuff1()
    // ... stuff2()
    // do some logs...
    console.log('First Iteration Finished.')

    // continue iteration from where you left off ( where you break, return or throw ).
    // in this case from 4th word.
    for await (const word of wordlist) {
        console.log(`word: ${word}`)
        if (index++ === 4) break // break on 5th word if reached.
    }
    console.log('Second Iteration finished.')
    // and so on.
}

execute()
```

If you need you can pass **iterable** to function and after it returns, or throws, you can continue to use your **iterable** of words from outside. e.g.
```javascript
const { wordlistIterator, testWordlist } = require('wordlist-iterator')


const execute = async () => {
    const wordlist = wordlistIterator(testWordlist)

    let currentIterationState

    let index = 0
    // 1. First Iteration.
    for await (const word of wordlist) {
        console.log(`word: ${word}`)
        // do some async stuff...
        if (index++ === 2) break // break on 3-rd word.
    }
    console.log('First Iteration Finished.')

    // 2. Second Iteration.
    currentIterationState = { wordlist, index }
    try {
        const result = await innerFunctionFail(currentIterationState)
        console.log(result)
    } catch (error) {
        console.log(error.message)
    }

    // 3. Third Iteration
    currentIterationState = { wordlist, index }
    const result = await innerFunctionSuccess(currentIterationState)
    console.log(result)
    // continue to do something...

}

const innerFunctionSuccess = async ({ wordlist, index }) => {
    for await (const word of wordlist) {
        console.log(`word: ${word}`)
        if (index++ === 4) break // break on 5-th word if reached.
    }
    console.log('innerFunctionSuccess: Iteration Finished.')
    return 'Success'
}

const innerFunctionFail = async ({ wordlist, index }) => {
    for await (const word of wordlist) {
        console.log(`word: ${word}`)
        throw new Error('innerFunctionFail: Error occure') // throw error on 1st iteration.
    }
    // This will be reached only if theres no words left to iterate through.
    console.log('innerFunctionFail: Iteration Finished.')
    return 'Success'
}

execute()
```

### Important
To close underlying **ReadableStream** of _wordlist_ before iteration is finished ensure to call one of the [generator methods][generator-instance-methods] - **generator.next()**, **generator.return()** with truthy value, or **generator.throw()** with any value ( including case without value ), e.g.
```javascript
wordlist.next(true)
// or
wordlist.return(1)
// or as an exception for wordlist.throw().
wordlist.throw('error') // truthy
wordlist.throw(null) // falsy
wordlist.throw() // without value
```
This will ensure that all underlying resources used by generator are freed.
> NOTE: If Iteration is finished this will be done automatically.



[Do-not-reuse-generators]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of#Do_not_reuse_generators
[nodejs-docs]: https://nodejs.org/api/fs.html#fs_fs_createreadstream_path_options
[async-iterable]: https://github.com/tc39/proposal-async-iteration#async-iterators-and-async-iterables
[generator-instance-methods]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator#Instance_methods
[async-generator]: https://github.com/tc39/proposal-async-iteration#async-generator-functions
[for-await-of]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of