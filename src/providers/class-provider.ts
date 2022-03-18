import { InjectableId, Injector, ClassConstructor } from "../injector"
import {
  _getInjectedIdAt,
  _getOptionalDefaultAt,
  FactoryMetadata
} from "../decorators"
import {
  POSTCONSTRUCT_ASYNC_METADATA_KEY,
  POSTCONSTRUCT_SYNC_METADATA_KEY,
  REFLECT_PARAMS,
  FACTORY_METADATA_KEY
} from "../constants"
import { State } from "../state"
import { BindableProvider } from "./bindable-provider"
import { ProviderOptions } from "./provider"
import { Option, Either, asOption } from "@3fv/prelude-ts"
import { isNotEmpty, warn, targetHint } from "../util"
import { match } from "ts-pattern"
import { isDefined, isFunction, isPromise } from "@3fv/guard"

export type ResolveStateCallback = (id: InjectableId<any>) => State

/**
 * @inheritDoc
 * This specialization invokes it's configured class constructor synchronously and then scans for (and invokes) any
 *   @PostConstruct (which may be synchronous or asynchronous).
 */
export class ClassBasedProvider<
  T,
  M extends ClassConstructor<T> = ClassConstructor<T>,
  Options extends ProviderOptions<T, M> = {}
> extends BindableProvider<T, M, Options> {
  constructor(
    injector: Injector,
    id: InjectableId<T>,
    maker: M,
    protected stateResolver: ResolveStateCallback,
    options: Options = {} as Options
  ) {
    super(injector, id, maker, options)
  }

  /**
   * @inheritDoc
   * @see the class description for this Provider.
   * This method is just a singleton guard, the real work is done by provideAsStateImpl.
   */
  provideAsState(): State<T> {
    let retVal = this.singleton
    if (!retVal) {
      retVal = this.provideAsStateImpl()
    }
    if (this.singleton === null) {
      this.singleton = retVal
    }
    return retVal
  }

  /**
   * Make a resolved or pending State that reflects any @PostConstruct annotations.
   */
  protected makePostConstructState(obj: any) {
    // Check to see if there is a @PostConstruct annotation on a method of the class.
    if (typeof obj === "object" && !Array.isArray(obj) && obj.constructor) {
      let maybeAsync = false
      let postConstruct = Reflect.getMetadata(
        POSTCONSTRUCT_SYNC_METADATA_KEY,
        obj.constructor
      )
      if (!postConstruct) {
        maybeAsync = true
        postConstruct = Reflect.getMetadata(
          POSTCONSTRUCT_ASYNC_METADATA_KEY,
          obj.constructor
        )
      }
      if (
        postConstruct &&
        obj.constructor.prototype[postConstruct] &&
        typeof obj.constructor.prototype[postConstruct] === "function"
      ) {
        let result: any
        try {
          result = obj[postConstruct]()
        } catch (err) {
          // The post construction method threw while executing, give the errorHandler (if any) a crack at recovery.
          try {
            obj = this.queryErrorHandler(err, obj) // The returned obj is unlikely to be the original obj.
            return State.create<T>(null, undefined, obj)
          } catch (e) {
            // could not recover, propagate the error.
            return State.create<T>(null, e, undefined)
          }
        }
        // The post construction method says it will let us know when it's finished.
        if (
          result instanceof Promise ||
          (maybeAsync && typeof result.then === "function")
        ) {
          // Return a State that is pending (the other return statements in this method return a State which is
          // resolved or rejected).
          return State.create<T>(
            this.makePromiseForObj<void>(result, () => obj)
          )
        }
      }
    }
    // No PostConstruct, just return a resolved State
    return State.create<T>(null, undefined, obj)
  }

  get hasFactory() {
    return Reflect.hasMetadata(FACTORY_METADATA_KEY, this.maker)
  }

  getFactoryMetadata() {
    return Reflect.getMetadata(
      FACTORY_METADATA_KEY,
      this.maker
    ) as FactoryMetadata
  }

  /**
   * This method collects the States of all the constructor parameters for our target class.
   */
  protected getRequiredParameterStates<T>(): State[] {
    return Option.ofNullable(this.getFactoryMetadata())
      .filter(({ params }) => Array.isArray(params))
      .map(({ params }) => params)
      .orElse(() =>
        Option.ofNullable(
          Reflect.getMetadata(REFLECT_PARAMS, this.maker) as Array<any>
        )
      )
      .filter(Array.isArray)
      .map(params =>
        params.map((argType, index) =>
          Option.ofNullable(argType)
            .map(argType => {
              const overrideToken = _getInjectedIdAt(this.maker, index)
              const actualToken =
                overrideToken === undefined ? argType : overrideToken
              // Ask our configured container to resolve the parameter.
              let param = this.stateResolver(actualToken)
              // If the parameter could not be resolved, see if there is an @Optional annotation
              if (!param.pending && param.rejected) {
                const md = _getOptionalDefaultAt(this.maker, index)
                if (md) {
                  param = State.create<any>(null, undefined, md.value)
                }
              }
              return param
            })
            .getOrCall(() => {
              throw new Error(
                `Injection error. Recursive dependency in constructor for ${this.maker.toString()} at index ${index}`
              )
            })
        )
      )
      .getOrElse([])

    // const argTypes = Reflect.getMetadata(REFLECT_PARAMS, this.maker)
    // if (argTypes === undefined) {
    //   return []
    // }
  }

  /**
   * Gather the needed constructor parameters, invoke the constructor, and figure out what post construction needs done.
   */
  private provideAsStateImpl(): State<T> {
    const params = this.getRequiredParameterStates()

    // If any of the params are in a rejected state, we cannot construct.
    const paramRejection = params.find(p => {
      return !p.pending && p.rejected
    })
    if (paramRejection) {
      return paramRejection
    }
    // If any of the params are in a pending state, we will have to wait for them to be resolved before we can
    // construct.
    try {
      return Option.of(
        params
          .filter(({ pending, fulfilled }) => isPromise(fulfilled) || !!pending)
          .map(({ promise, fulfilled }) =>
            isPromise(fulfilled) ? fulfilled : promise
          )
      )
        .filter(isNotEmpty)
        .match({
          Some: pendingParams => {
            // Some of the parameters needed for construction are not yet available, wait for them and then attempt
            // construction.
            const objPromise = this.makePromiseForObj<any[]>(
              Promise.all(pendingParams),
              () =>
                // All the parameters are now available, instantiate the class.
                // If this throws, it will be handled by our caller.
                this.createInstance(params)
            )

            // Once the obj is resolved, then we need to check for PostConstruct and if it was async, wait for that too.
            return State.create<T>(
              objPromise
                .then(obj =>
                  match<State<T>>(this.makePostConstructState(obj))
                    .with({ pending: true }, ({ promise }) => promise)
                    .when(
                      ({ rejected }) => isDefined(rejected),
                      state => Promise.reject(state.rejected)
                    )
                    .when(
                      ({ fulfilled }) => isDefined(fulfilled),
                      ({ fulfilled }: State<T>) => Promise.resolve(fulfilled)
                    )
                    .otherwise(() => {
                      throw new Error(`Unknown state`)
                    })
                )
                .catch(err => {
                  warn("Failed to construct " + targetHint(this.maker))
                  throw err
                })
            )
          },
          None: () =>
            // All parameters needed for construction are available, instantiate the object.
            Either.try(() =>
              Option.of(this.createInstance(params))
                .map(o => this.makePostConstructState(o))
                .get()
            )
              .recoverWith(err => {
                warn("Failed to construct", err)

                return Either.try(() =>
                  State.create<T>(null, undefined, this.queryErrorHandler(err))
                ).recoverWith(err2 => {
                  warn("Failed to construct", err2)
                  return Either.right(State.create<T>(null, err2, undefined))
                })
              })
              .getOrThrow(`Unable to create state`)
        })
    } catch (err) {
      warn("Failed to construct " + targetHint(this.maker))
      throw err
    }
  }

  private createInstance(params: State[]): Promise<T> | T | undefined {
    const args = params.map(p => p.fulfilled)
    const pendingObj = this.hasFactory
      ? asOption(this.getFactoryMetadata())
          .map(({ methodName }) =>
            asOption(this.maker[methodName])
              .filter(isFunction)
              .getOrThrow(`Factory method not found: ${methodName}`)
          )
          .map(factoryFn => {
            const checkValue = <T>(value: T): T => {
                if (
                  !(value instanceof this.maker) &&
                  !(value instanceof (this.id as any))
                ) {
                  throw new Error(
                    `Factory result value is not an instanceof class: ${targetHint(
                      this.maker
                    )}`
                  )
                }

                return value
              },
              result = factoryFn.apply(this.maker, args)
            return isPromise(result)
              ? result.then(checkValue)
              : checkValue(result)
          })

          .getOrThrow(`Unable to find factory metadata`)
      : Reflect.construct(this.maker, args)

      // TODO: Use injector here
      return pendingObj //isPromise(pendingObj) ? pendingObj(this)
  }
}
