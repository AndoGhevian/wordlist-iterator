import * as fs from 'fs'
import * as readline from 'readline'
import * as path from 'path'

import { once } from 'events'

import { promisify } from 'util'
const readFd = promisify(fs.read) as (...args: any[]) => Promise<{
    bytesRead: number;
    buffer: NodeJS.ArrayBufferView;
}>

/**
 * Options for **wordlistIterator**.
 */
export interface WordListIteratorOptions {
    /****highWaterMark** value for readStream representing wordlist file. */
    highWaterMark?: number
}

/**
 * Function Generator which is return iterator for words in wordlist.
 * @param wordlistPath - Wordlist file path.
 * @param wordlistIteratorOptions - Options to consider when iterating throw provided wordlist.
 */
export function wordlistIterator(wordlistPath: string, {
    highWaterMark
}: WordListIteratorOptions = {} as any) {
    highWaterMark = highWaterMark!

    let rl: readline.Interface

    const wordlistIterable = (async function* (wordlistPath: string, {
        highWaterMark
    }: Required<WordListIteratorOptions> = {} as any): AsyncGenerator<string> {
        let stream: fs.ReadStream
        try {
            stream = fs.createReadStream(wordlistPath, {
                ...(highWaterMark !== undefined ? {} : { highWaterMark }),
            })
            // stream.on('close', () => {
            //     console.log('stream closed. HEY STREAM CLOSED!!!')
            // })

            // 1. Check if file has content.
            const [fd] = await once(stream, 'open')
            const content = await readFd(fd, {
                buffer: Buffer.alloc(1),
                length: 1,
                position: 0,
            })

            if (content.bytesRead === 0) {
                // console.log('no content.')
                stream.push(null)
                stream.read(0)
                return
            }
        } catch (err) {
            throw new Error(`Cant open file at wordlistPath: ${wordlistPath}`)
        }

        // 2. Create rl interface if file opened and content exists.
        rl = readline.createInterface({
            input: stream,
            crlfDelay: Infinity
        })

        let closed = false
        let lines: string[] = []

        rl.on('line', (line) => {
            // console.log('line-read.')
            lines.push(line)
        })
        rl.once('close', () => {
            // console.log('close.')
            closed = true
        })

        while (true) {
            await once(rl, 'line')
            rl.pause()
            for (let line of lines) {
                const finish = yield line
                if (finish) return rl.close()
            }

            if (closed) return

            lines = []
            rl.resume()
        }
    })(wordlistPath, {
        highWaterMark
    })


    wordlistIterable.return = new Proxy(wordlistIterable.return, {
        async apply(target, thisArg, args) {
            if (!args[0]) {
                return { value: undefined, done: false }
            }

            if (rl) rl.close()
            return await target.apply(thisArg, args)
        }
    })
    wordlistIterable.throw = new Proxy(wordlistIterable.throw, {
        async apply(target, thisArg, args) {
            if (rl) rl.close()
            await target.apply(thisArg, args)
        }
    })

    return wordlistIterable
}

/**Wordlist path to use for tests and examples. */
const testWordlist = path.join(__dirname, '../testWordlist')
export { testWordlist }