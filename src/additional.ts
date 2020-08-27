import fs from 'fs'
import readline from 'readline'

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
    highWaterMark?: number,
    /**line to start read wordlist from. */
    start?: number,
    /**line to finish read of wordlist at. */
    end?: number
}

/**
 * Function Generator which is return iterator for words in wordlist.
 * @param wordlistPath - Wordlist file path.
 * @param wordlistIteratorOptions - Options to consider when iterating throw provided wordlist.
 * @defaultValue `{ start = 0, end = Infinity }`
 */
export function wordlistIterator(wordlistPath: string, {
    highWaterMark,
    start = 0,
    end = Infinity
}: WordListIteratorOptions = {} as any) {
    highWaterMark = highWaterMark!

    start = +start!
    end = +end!
    if (isNaN(start)) throw new Error(`"start" must be number`)
    if (isNaN(end)) throw new Error(`"end" must be number`)

    if (start < 0) start = 0
    if (end < start) end = Infinity

    let rl: readline.Interface

    const wordlistIterable = (async function* (wordlistPath: string, {
        highWaterMark,
        start,
        end
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

        const rl = readline.createInterface({
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

        let linesCount = 0
        let firstLineIndex = 0
        while (true) {
            firstLineIndex += linesCount

            await once(rl, 'line')
            rl.pause()

            linesCount = lines.length
            if (firstLineIndex + linesCount - 1 < start) {
                if (closed) return

                lines = []
                rl.resume()
                continue
            }

            const startIndex = firstLineIndex <= start ? start - firstLineIndex : 0
            const endIndex = firstLineIndex + linesCount - 1 < end ? linesCount - 1 : end - firstLineIndex
            for (let index = startIndex; index <= endIndex; index++) {
                const finish = yield lines[index]
                if (finish) return rl.close()
            }

            if (firstLineIndex + linesCount - 1 >= end) return rl.close()

            if (closed) return

            lines = []
            rl.resume()
        }
    })(wordlistPath, {
        highWaterMark,
        start,
        end
    })

    wordlistIterable.return = new Proxy(wordlistIterable.return, {
        async apply(target, thisArg, args) {
            if (!args[0]) {
                return { value: undefined, done: false }
            }

            if(rl) rl.close()
            return await target.apply(thisArg, args)
        }
    })
    wordlistIterable.throw = new Proxy(wordlistIterable.throw, {
        async apply(target, thisArg, args) {
            if(rl) rl.close()
            return await target.apply(thisArg, args)
        }
    })
    return wordlistIterable
}