import { InjectableId, Injector } from "./injector"
import { isString, isFunction, isClass } from "@3fv/guard"
import { Option } from "@3fv/prelude-ts"
import { isId, idHint, targetHint } from "./util"

/**
 * You may bind an error handler which will be invoked, if the bound InjectableId could not be put into service.
 * An error handler *must* not throw, but may return an Error that will be propagated back up the call chain.
 *
 * @param binder   The Binder that experienced the error.
 * @param id   The identifier for what was trying to be made.
 * @param maker   The thing that made (or tried to provideAsState).  Will be one of type ClassConstructor, SyncFactory,
 *   or AsyncFactory, depending on how you registered the binding.
 * @param error   Identifies the problem that occurred.
 * @param value   If the 'maker' was able to create the thing, but it had an error during post construction, the made
 *   thing will be passed here.
 * @returns one of 3 results...
 *      A substitute thing (kind of like a 'maker' do-over) which must be fully operational (e.g. any @PostConstruct
 *   will be ignored). An alternate Error which will be propagated back up the call chain. Undefined, which means the
 *   'error' parameter will be propagated back up the call chain.
 */
export type OnErrorCallback<T, M> = (
  injector: Injector,
  id: InjectableId<T>,
  maker: M,
  error: Error,
  value?: T
) => T | Error | void

/**
 * Helper class to ensure we can distinguish between Error instances legitimately returned from Providers, and Errors
 * thrown by Providers.
 * @see resolve.
 */
export class ErrorReason extends Error {
  static parse(args:any[]) {
    if (isId(args[0])) {
      return {
        err:args[1],
        id: args[0]
      }

    } else if (args[0] instanceof Map) {
      const entries = [...args[0].entries()]
      return Option.of(
          entries.reduce(
            (pairs, [id, value]) => [
              [...pairs[0], idHint(id)],
              [...pairs[1], isString(value) ? value : isClass(value) ? targetHint(value) : value]
            ],
            [Array<string>(), Array<any>()]
          )
          )
          .map(([ids, values]) => ({
            id: ids.join(","),
            err: values
          }))
          .get()

    } else {
      return {
        id: "NONE",
        err: args
      }
    }
  }

  static format(args: any[]) {
    if (args[1]?.message) {
      return args[1]?.message
    }

    const {id, err} = this.parse(args)

    return err?.message ?
      err.message :
      isString(err) ?
        err :

      Array.isArray(err) ?
        err.map(err => err?.message ?? err.toString()).join(", ") :
        err?.toString()

  }


  readonly id: InjectableId<any>
  readonly err: any
  readonly args: any[]
  readonly details: Map<InjectableId<any>, ErrorReason>


  constructor(reasons: Map<InjectableId<any>, ErrorReason>)
  constructor(id: InjectableId<any>, err: any)
  constructor(causes: ErrorReason[])
  constructor(...args: any[]) {
    super(ErrorReason.format(args))

    this.details = args[0] instanceof Map ? args[0] : new Map<InjectableId<any>, ErrorReason>()
    this.args = args

    Object.assign(this, ErrorReason.parse(args))
  }

  get size() {
    return this.details.size
  }

  get(id: InjectableId<any>) {
    return this.details.get(id)
  }

  toString() {
    return this.args[1]?.message ? this.args[1]?.message : isString(this.args[1]) ? this.args[1] : ErrorReason.format(this.args)
  }
}
