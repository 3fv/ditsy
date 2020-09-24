import {InjectableId, Injector} from '../injector';
import { SyncFactory, Provider, ProviderOptions } from "./provider"
import {State} from '../state';
import {BindableProvider} from './bindable-provider';

/**
 * @inheritDoc
 * This specialization simply invokes it's configured Factory and provides the result.
 */
export class FactoryBasedProvider<T, M extends SyncFactory<T> = SyncFactory<T>, Options extends ProviderOptions<T,M> = {}> extends BindableProvider<T, M> {
	constructor(injector: Injector, id: InjectableId<T>, maker: M, options: Options = {} as Options) {
		super(injector, id, maker, options);
	}

	/**
	 * @inheritDoc
	 * This specialization invokes it's configured Factory and provides the result (or invokes the error handler if necessary).
	 */
	provideAsState(): State<T, M> {
		let retVal = this.singleton;
		if (!retVal) {
			try {
				retVal = State.create<T, M>(null, undefined, this.maker(this.injector));
			}
			catch (err) {
				// There was an error, give the errorHandler (if any) a crack at recovery.
				try {
					// queryErrorHandler will throw if it could not obtain a substitute object.
					retVal = State.create<T>(null, undefined, this.queryErrorHandler(err));
				}
				catch (e) {
					// could not recover, propagate the error.
					retVal = State.create<T>(null, e, undefined);
				}
			}
		}
		if (this.singleton === null)
			this.singleton = retVal;
		return retVal;
	}

	/**
	 * @inheritDoc
	 * This specialization returns undefined anytime 'asyncOnly' is true (since this Provider is by definition synchronous).
	 */
	resolve(): Promise<T> {
		return super.resolve();
	}
}
