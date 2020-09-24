import { InjectableId, Injector, ClassConstructor } from "../injector"
import { BindAs, BindErrHandler } from "../binder"
import { AsyncFactory, Provider, SyncFactory, ProviderOptions } from "./provider"
import { OnErrorCallback, ErrorReason } from "../error"
import { isPromise } from "@3fv/guard"
import { Option } from "@3fv/prelude-ts"

function isErrorObj(err: any): boolean {
  if (err instanceof Error || err instanceof ErrorReason) return true
  return err && typeof err.message === "string" && typeof err.stack === "string"
}

/**
 * @inheritDoc
 * This abstraction is for Providers that can be additionally configured as Singletons and/or configured with an error
 *   handling callback.
 */
export abstract class BindableProvider<
  T,
  M = ClassConstructor<T> | SyncFactory<T> | AsyncFactory<T>,
  Options extends ProviderOptions<T, M> = any
> extends Provider<T, M> {
  protected constructor(
    protected injector: Injector,
    protected id: InjectableId<T>,
    protected maker: M,
    options: Options = {} as Options
  ) {
    super(options)
  }

  /**
   * Encapsulate the logic of invoking any configured error handler, and processing it's result.
   * @see OnErrorCallback
   *
   * @returns The object substituted by the callback (otherwise this method throws the appropriate error).
   */
  protected queryErrorHandler(err: Error, obj?: any): T {
    // There was an error during construction, see if an error handler was provided, and if so, see what it wants to do.
    if (this.errorHandler) {
      let handlerResult = this.errorHandler(this.injector, this.id, this.maker, err, obj)
      // Error handler wants us to propagate an error.
      if (isErrorObj(handlerResult)) throw handlerResult
      // Error handler has no opinion, so provideAsState a state that reflects the error we just caught.
      if (typeof handlerResult === "undefined") throw err
      // Error handler provided a valid (fully resolved) replacement.
      return handlerResult as T
    }
    // No error handler, provideAsState a state that reflects the error we just caught.
    throw err
  }

  /**
   * This is like a retry mechanism that uses the Provider's errorHandler (if any) to attempt recovery whenever the
   * supplied Promise rejects. This method returns a Promise that rejects if recovery was not possible. If the supplied
   * Promise resolves, then this method passes the result to the callback, and then resolve as whatever that callback
   * returns.
   *
   * @param waitFor   The supplied Promise.
   * @param cb    Callback to be invoked if the supplied Promise resolves.
   */
  protected async makePromiseForObj<R>(waitFor: Promise<R>, cb: (result: R) => T): Promise<T> {
    try {
      const pending = await waitFor,
        result = cb(pending)
      return await (isPromise(result) ? result : Promise.resolve(result))
    } catch (err: any) {
      // There was an error during async post construction, see if an error handler was provided, and if so, see what it wants to do.
      if (this.errorHandler) {
        const handlerResult = this.errorHandler(this.injector, this.id, this.maker, err)
        // Error handler wants us to propagate an alternative error.
        if (isErrorObj(handlerResult)) {
          throw handlerResult
        }
        // Fall thru
        if (typeof handlerResult !== "undefined") {
          return handlerResult as T // Error handler provided a replacement, so change the State that we returned from pending to resolved.
        }
      } else {
        // This will change the State that we returned from pending to rejected.
        throw err
      }
    }
  }
}
