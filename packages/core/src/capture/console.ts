import type { BugcrumbsInstance } from '../bugcrumbs'
import { safely } from '../safe'
import type { ConsoleEntry } from '../types'
import { patchMethod } from './patch'
import { toSerializable } from './serialize'

const LEVELS: ConsoleEntry['level'][] = ['log', 'info', 'warn', 'error']
const MAX_ARGS = 20

/** Call-site stack without the "Error" header and our own wrapper frames. */
function callerStack(): string | undefined {
  const lines = new Error().stack?.split('\n') ?? []
  // V8 starts with an "Error" line; Firefox and Safari don't.
  if (lines[0] && !lines[0].includes('@') && !/^\s+at /.test(lines[0])) lines.shift()
  // callerStack → hook → patchMethod wrapper
  return lines.slice(3).join('\n') || undefined
}

/** Records console.log/info/warn/error (FR-02), with a stack trace for warn and error. */
export function patchConsole(api: BugcrumbsInstance): () => void {
  if (typeof console === 'undefined') return () => {}
  // Guards against recursion if serialising an argument logs something itself.
  let capturing = false

  const restores = LEVELS.map((level) =>
    patchMethod(console, level, (original) =>
      function (this: Console, ...args: unknown[]) {
        if (!capturing) {
          capturing = true
          safely(() =>
            api.push({
              kind: 'console',
              level,
              // One shared budget for all arguments keeps each entry small, however much is logged.
              args: toSerializable(args.length > MAX_ARGS ? [...args.slice(0, MAX_ARGS), `[${args.length - MAX_ARGS} more arguments]`] : args) as unknown[],
              stack: level === 'warn' || level === 'error' ? callerStack() : undefined,
            }),
          )
          capturing = false
        }
        return original.apply(this, args)
      },
    ),
  )
  return () => restores.forEach((restore) => restore())
}
