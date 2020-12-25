import "reflect-metadata"
import { AbstractConstructor, ClassConstructor, InjectableId } from "./injector"
import { Binder } from "./binder"
import { INJECTABLE_METADATA_KEY, SCOPE_METADATA_KEY, CONTAINER_ID } from "./constants"
import { State } from "./state"
import {
  AsyncFactory,
  Provider,
  SyncFactory,
  ProviderOptions,
  ConstantProvider,
  FactoryBasedProvider,
  AsyncFactoryBasedProvider,
  ClassBasedProvider
} from "./providers"
import { Deferred } from "@3fv/deferred"
import { isFunction, isObject, isPromise, isString } from "@3fv/guard"
import { Option } from "@3fv/prelude-ts"
import { debug, idHint, isNotEmpty, isNotDefined, warn, targetHint } from "./util"
import { ErrorReason } from "./error"
import { match, __ } from "ts-pattern"
import { uniq } from "lodash"

/**
 * Binder and Injector (aka Container) to handle (a)synchronous dependency management.
 */
export class Container implements Binder {
  private initDeferred: Deferred<this>

  protected providers = new Map<InjectableId<any>, Provider>()

  /**
   * Create a new Container, with an optional parent Injector which will be searched if any given InjectableId is not
   * bound within this Container.
   *
   * @param parent
   */
  constructor(protected parent?: Container) {
    this.bindConstant(CONTAINER_ID, this)
  }

  get isReady() {
    return this.initDeferred?.isFulfilled() === true
  }

  protected addProvider(id: InjectableId<any>, provider: Provider, options?: ProviderOptions) {
    const allIds = uniq([id,...(options?.aliases ?? []),...(provider.config?.aliases ?? [])]),
      conflictedIds = allIds.filter(id => this.providers.has(id))
    if (isNotEmpty(conflictedIds)) {
      throw new Error(`InjectableId conflicts: ${conflictedIds.join(", ")}`)
    }

    allIds.forEach(id => this.providers.set(id,provider))
  }

  whenReady() {
    return this.init()
  }

  /**
   * @inheritDoc
   */
  isIdKnown<T>(id: InjectableId<T>, ascending?: boolean): boolean {
    if (!!this.providers.get(id)) return true
    if (ascending && this.parent) return this.parent.isIdKnown(id, true)
    return false
  }

  /**
   * @inheritDoc
   */
  get<T>(id: InjectableId<T>): T {
    if (!this.isReady) {
      throw Error("Container has not finished initializing")
    }

    const provider = this.providers.get(id)
    if (!provider) {
      if (this.parent) return this.parent.get<T>(id)
      throw new Error("Symbol not bound: " + targetHint(id))
    }
    const state = provider.provideAsState()
    if (state.pending)
      throw new Error("Synchronous request on unresolved asynchronous dependency tree: " + targetHint(id))
    if (state.rejected) throw state.rejected
    return state.fulfilled
  }


  /**
   * Once resolution (`init`) has begun,
   * nothing else can be bound to this container
   * and the only option is a child or a whole new container
   *
   * @returns {boolean}
   */
  get isBindable() {
    return !this.initDeferred
  }
  /**
   * Once resolution (`init`) has begun,
   * nothing else can be bound to this container
   * and the only option is a child or a whole new container
   */
  assertBindable() {
    if (!this.isBindable) {
      throw Error(`
         Once resolution (\`init\`) has begun,
         nothing else can be bound to this container
         and the only option is a child or a whole new container
       `)
    }
  }

  protected async init(): Promise<this> {
    if (!!this.initDeferred) {
      return this.initDeferred.promise
    }

    const deferred = (this.initDeferred = new Deferred<this>())

    if (!!this.parent) {
      await this.parent.init()
    }

    const results = await Promise.all(
      [...this.providers.entries()].map(
        ([id, provider]) =>
          Promise.resolve(provider.resolve())
            .then(value => Promise.resolve([id, value, provider]))
            .catch(e => Promise.resolve([id, new ErrorReason(new Map([[id, e]])), provider]))
      )
    )

    Option.of(
      results
        .filter(([, value]) => value instanceof ErrorReason)
        .reduce((errors, [key, err]: [InjectableId<any>, ErrorReason]) => {
          errors.set(key, err)
          return errors
        }, new Map<InjectableId<any>, ErrorReason>())
    )
      .filter(it => it.size > 0)
      .ifSome(errors => {
        warn("Failed to resolve", ...errors)
        throw new ErrorReason(errors)
      })

    deferred.resolve(this)
    return deferred.promise
  }

  /**
   * Resolve all bindings
   *
   * @returns {Promise<this>}
   */
  resolveAll() {
    return this.init()
  }

  /**
   * @inheritDoc
   */
  async resolve<T>(id: InjectableId<T>): Promise<T> {
    await this.init()

    const state = this.resolveState(id)

    if (state.promise) {
      return state.promise
    }
    if (state.rejected) {
      return Promise.reject(state.rejected)
    }
    return Promise.resolve(state.fulfilled)
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * This method is not part of the Binding interface, because it is highly unusual.
   * But that doesn't mean we can't imagine scenarios where you might require it.
   * @param id    The id to be removed.
   * @param ascending  If true, this will remove all bindings of the specified id all the way up the parent container
   *   chain (if it exists).
   */
  removeBinding<T>(id: InjectableId<T>, ascending?: boolean): void {
    this.assertBindable()
    this.providers.delete(id)
    if (ascending && isFunction(this.parent.removeBinding)) {
      this.parent.removeBinding(id, true)
    }
  }

  /**
   * @inheritDoc
   */
  bindConstant<T>(id: InjectableId<T>, value: T) {
    this.assertBindable()
    this.addProvider(id, new ConstantProvider(value))
    return this
  }

  /**
   * @inheritDoc
   */
  bindClass<T>(constructor: ClassConstructor<T>, options?: ProviderOptions): this
  bindClass<T>(
    id: string | symbol | AbstractConstructor<T>,
    constructor: ClassConstructor<T>,
    options?: ProviderOptions
  ): this
  bindClass<T>(
    constructorOrAbstractOrId: ClassConstructor<T>,
    constructorOrOptions: ClassConstructor<T> | ProviderOptions = undefined,
    options: ProviderOptions = undefined
  ) {
    this.assertBindable()
    const [defaultId, constructor] = (isFunction(constructorOrAbstractOrId)
      ? !isFunction(constructorOrOptions)
        ? [constructorOrAbstractOrId, constructorOrAbstractOrId]
        : [constructorOrAbstractOrId, constructorOrOptions]
      : isFunction(constructorOrOptions)
      ? [constructorOrAbstractOrId, constructorOrOptions]
      : [undefined, undefined]) as [InjectableId<T>, ClassConstructor<T>]

    const id = options?.id ?? defaultId

    if ([id, constructor].some(isNotDefined)) {
      throw Error(`Class constructor/id could not be established`)
    }

    if (!options) {
      options = (isObject(constructorOrOptions) && constructorOrOptions !== constructor
        ? constructorOrOptions
        : {}) as ProviderOptions
    }

    if (!Reflect.getMetadata(INJECTABLE_METADATA_KEY, constructor)) {
      throw new Error("Class not decorated with @Injectable [" + constructor.toString() + "]")
    }

    Option.ofNullable(Reflect.getMetadata(SCOPE_METADATA_KEY, constructor))
      .filter(isString)
      .filter(isNotEmpty)
      .ifSome(scope => Object.assign(options, { scope }))

    const provider = new ClassBasedProvider(
      this,
      id,
      constructor,
      (i: InjectableId<any>) => {
        return this.resolveState(i)
      },
      options
    )
    this.addProvider(id, provider, options)
    return this
  }

  /**
   * @inheritDoc
   */
  bindFactory<T>(id: InjectableId<T>, factory: SyncFactory<T>, options: ProviderOptions = {}): this {
    this.assertBindable()
    const provider = new FactoryBasedProvider(this, id, factory, options)
    this.addProvider(id, provider, options)
    return this
  }

  /**
   * @inheritDoc
   */
  bindAsyncFactory<T>(id: InjectableId<T>, factory: AsyncFactory<T>, options: ProviderOptions = {}): this {
    this.assertBindable()
    const provider = new AsyncFactoryBasedProvider(this, id, factory, options)
    this.addProvider(id, provider, options)
    return this
  }

  /**
   * As implied by the name prefix, this is a factored out method invoked only by the 'resolve' method.
   * It makes searching our parent (if it exists) easier (and quicker) IF our parent is a fellow instance of Container.
   */
  protected resolveState<T>(id: InjectableId<T>): State<T> {
    const provider = this.providers.get(id)
    if (!provider) {
      return this.parent?.isIdKnown(id, true)
        ? this.parent.resolveState<T>(id)
        : State.create<T>(null, new Error("Symbol not bound: " + id.toString()))
    }
    return provider.provideAsState()
  }
}
