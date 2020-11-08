import { State } from "../state"

import { Injector, InjectableId } from "../injector"
import { defaults } from "lodash"
import { OnErrorCallback } from "../error"
import { Scopes, KnownScopes, KnownScope } from "../scope"

/**
 * Type definition for functions that return a value.
 * The function should return a valid value, but may throw an exception if it cannot.
 */
export type SyncFactory<T> = (injector: Injector) => T

/**
 * Type definition for functions that return a Promise for a value.
 * The function *must* not throw and must return a valid Promise (e.g. pending, resolved, rejected).
 */
export type AsyncFactory<T> = (injector: Injector) => Promise<T>

export interface ProviderConfig<T = any, M = any> {

  id?: InjectableId<any>

  scope: Scopes

  aliases: InjectableId<any>[]

  /**
   * A user supplied error handling function.
   * Default value is undefined.
   */
  onError?: OnErrorCallback<T, M>
}

export type ProviderOptions<T = any, M = any> = Partial<ProviderConfig<T,M>>

/**
 * Internally all InjectableIds are mapped to an abstract Provider<T>.
 * A Provider may choose to return a singleton or a new value each time it is queried.
 */
export abstract class Provider<T = any, M = any> {
  static readonly defaults: ProviderConfig = {
    scope: KnownScope.instance,
    aliases: []
  }

  readonly config: ProviderConfig<T, M>

  protected get errorHandler() {
    return this.config.onError
  }

  protected constructor(options: ProviderOptions<T, M> = {}) {
    this.config = defaults({}, options, Provider.defaults)

    if (this.isSingleton) {
      this.singleton = null
    }
  }

  /**
   * If the provider is configured as a singleton, this property will be the state of that singleton.
   * This value will be defined for resolved/resolving Singletons, null for Singletons that have not yet been queried,
   * and will remain undefined for non-Singleton Providers. Default value is undefined (e.g. not a Singleton).
   */
  protected singleton?: State<T> = undefined

  /**
   * This is the workhorse method of the Provider, and is invoked directly or indirectly by both Injector.get and
   * Injector.resolve. This method returns the current State<T> if it is already known (which it might be for Singleton
   * scenarios). Otherwise it resolves the State<T>. IF the Provider<T> is a Singleton, it's State<T> is updated before
   * returning.
   */
  abstract provideAsState(): State<T>

  /**
   * Whether or not this providers
   * result is only computed once
   *
   * @returns {boolean}
   */
  get isSingleton() {
    return this.config.scope === KnownScope.singleton || this.singleton !== undefined
  }

  /**
   * Base method to initialize the state of this Provider *if* (and only if) it has been configured as a Singleton.
   * If this Provider has not been configured as a singleton, this method is essentially a noop that returns undefined.
   *
   * @returns {Promise<undefined | T>} completion Promise if initialization requires asynchronicity, otherwise the
   *   return value is undefined.
   */
  async resolve(): Promise<T> {
    if (this.isSingleton) {
      let s = this.provideAsState()
      if (s.pending) {
        return s.promise
      }else if (s.rejected) {
        return Promise.reject(s.rejected)
      } else {
        return s.fulfilled
      }
    }
    return undefined
  }
}
