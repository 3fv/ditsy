import { ClassConstructor, InjectableId, Injector, AbstractConstructor } from "./injector"
import { AsyncFactory, SyncFactory, ProviderOptions } from "./providers"
import { OnErrorCallback } from "./error"

/**
 * An interface allowing binding of an error handler.
 * @see OnErrorCallback
 */
export interface BindErrHandler<T, M> {
  onError(cb: OnErrorCallback<T, M>): void
}

/**
 * @inheritDoc
 * This specialization also allows you to specify that the binding is 'Singleton' (e.g. only one in the system).
 */
export interface BindAs<T, M> extends BindErrHandler<T, M> {
  asSingleton(): BindErrHandler<T, M>
}

/**
 * Bind Ids to producers.
 */
export interface Binder extends Injector {
  /**
   * Bind an InjectableId to a constant value.
   * Constants are by their very nature singleton, and are assumed to be error proof.
   */
  bindConstant<T>(id: InjectableId<T>, value: T): this

  /**
   * Bind an InjectableId to a class (actually it's constructor).
   * As a shortcut, you may use the class constructor as the 'id' (e.g. container.bindClass(A); ).
   * The container will also invoke any @PostConstruct present on the class.
   */
  bindClass<T>(
    constructor: ClassConstructor<T>,
    options?: ProviderOptions
  ): this
  bindClass<T>(
    id: string | symbol | AbstractConstructor<T>,
    constructor: ClassConstructor<T>,
    options?:ProviderOptions
  ): this

  /**
   * Bind an InjectableId to a synchronous factory that will be invoked on demand when the object is needed.
   * The factory should produce the needed value
   * NOTE:  The container will not invoke any @PostConstruct present on the class, this is the responsibility of the factory.
   */
  bindFactory<T>(id: InjectableId<T>, factory: SyncFactory<T>): this

  /**
   * Bind an InjectableId to an asynchronous factory that will be invoked on demand when the object is needed.
   * The factory should produce the needed value (asynchronously of course).
   * NOTE:  The container will not invoke any @PostConstruct present on the class, this is the responsibility of the factory.
   * WARNING!!! The factory may not throw and must return a valid Promise (which can be pending, resolved, rejected, etc.).
   */
  bindAsyncFactory<T>(id: InjectableId<T>, factory: AsyncFactory<T>): this
}
