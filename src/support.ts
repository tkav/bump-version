import * as fs from 'fs'
import retrier from 'retry'
import * as path from 'path'
import { glob } from 'smart-glob'

export const versionRegex = /[0-9]+\.[0-9]+\.[0-9]+(?:-[\w\d\.-]+)?/

export interface LineReplaced {
    line: number
    path: string
    newValue: string
}

export const replacePattern = async (p: {
    pattern: RegExp
    replacer: RegExp
    value: string
    explicit?: string
    ignore?: string[]
}) => {
    const { pattern, replacer, value, explicit='**', ignore = [] } = p
    const files = await glob(explicit, {
        gitignore: true,
        //expandDirectories: true,
        filesOnly: true,
        ignore: ['node_modules', ...ignore],
    })
    console.log('scanned files')
    const linesReplaced: LineReplaced[] = []
    files.forEach((pathName) => {
        console.log(pathName)
        let found = false
        let currentLine = 0
        const lines = fs.readFileSync(pathName, 'utf8').toString().split('\n')
        const result = lines
            .reduce(
                (acc, last) => {
                    if (acc[acc.length - 1].search(pattern) !== -1) {
                        found = true
                        linesReplaced.push({
                            line: currentLine,
                            path: pathName,
                            newValue: value,
                        })
                        last = last.replace(replacer, value)
                    }
                    currentLine += 1
                    return [...acc, last]
                },
                [''],
            )
            .slice(1)
            .join('\n')
        if (found) {
            fs.writeFileSync(pathName, result, 'utf8')
        }
    })
    return { linesReplaced }
    //
}

export const capitalize = (prefix) => {
    return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}
// console.log(bump('0.1.0'))

// replacePattern(/.*\[bump\].*/, /[0-9]+\.[0-9]+\.[0-9]+/, '0.1.2')

const defaultOpts = {
    randomize: true,
    onRetry: (e, i) => console.error(`retrying after error: ${e}`),
    retries: 3,
}

export function retry(fn, opts = defaultOpts) {
    function run(resolve, reject) {
        var options = opts || {}
        var op

        op = retrier.operation(options)

        // We allow the user to abort retrying
        // this makes sense in the cases where
        // knowledge is obtained that retrying
        // would be futile (e.g.: auth errors)

        function bail(err) {
            reject(err || new Error('Aborted'))
        }

        function onError(err, num) {
            if (err.bail) {
                bail(err)
                return
            }

            if (!op.retry(err)) {
                reject(op.mainError())
            } else if (options.onRetry) {
                options.onRetry(err, num)
            }
        }

        function runAttempt(num) {
            var val

            try {
                val = fn(bail, num)
            } catch (err) {
                onError(err, num)
                return
            }

            Promise.resolve(val)
                .then(resolve)
                .catch(function catchIt(err) {
                    onError(err, num)
                })
        }

        op.attempt(runAttempt)
    }

    return new Promise(run)
}
