import { InjectableId, Injector } from "../injector"
import {
	SyncFactory,
	Provider,
	ProviderOptions, AsyncFactory
} from "./provider"
import { State } from "../state"
import { BindableProvider } from "./bindable-provider"
import { asOption, Either } from "@3fv/prelude-ts"
import { identity } from "lodash"
import { Bind } from "../internal"


/**
 * @inheritDoc
 * This specialization simply invokes it's configured Factory and provides the
 *   result.
 */
export class FactoryBasedProvider<
  T,
  M extends SyncFactory<T> | AsyncFactory<T> = SyncFactory<T>,
  Options extends ProviderOptions<T, M> = {}
> extends BindableProvider<T, M> {
  constructor(
    injector: Injector,
    id: InjectableId<T>,
    maker: M,
    options: Options = {} as Options
  ) {
    super(injector, id, maker, options)
  }

	@Bind
	protected createState() {
		return State.create<T, M>(null, undefined, (this.maker as SyncFactory<T>)(this.injector))
	}
	
  /**
   * @inheritDoc
   * This specialization invokes it's configured Factory and provides the
   *   result (or invokes the error handler if necessary).
   */
  provideAsState(): State<T, M> {
    let retVal = asOption(this.singleton).getOrCall(() =>
      Either.try(this.createState).match({
        // There was an error, give the errorHandler (if any) a crack at recovery.
        Left: err =>
          Either.try(() =>
            State.create<T>(null, undefined, this.queryErrorHandler(err))
          ).match({
            // could not recover, propagate the error.
            Left: e => State.create<T>(null, e, undefined),
            Right: identity
          }),
        Right: identity
      })
    )

    if (this.singleton === null)
			this.singleton = retVal
   
	  return retVal
  }

  /**
   * @inheritDoc
   * This specialization returns undefined anytime 'asyncOnly' is true (since
   *   this Provider is by definition synchronous).
   */
  resolve(): Promise<T> {
    return super.resolve()
  }
}
