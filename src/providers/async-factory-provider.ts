import { InjectableId, Injector } from "../injector"
import { AsyncFactory, ProviderOptions } from "./provider"
import { State } from "../state"
import { FactoryBasedProvider } from "./sync-factory-provider"
import { Bind } from "../internal"

/**
 * @inheritDoc
 * This specialization invokes it's configured Factory asynchronously and waits until it can provide the result.
 */
export class AsyncFactoryBasedProvider<T, M extends AsyncFactory<T> = AsyncFactory<T>, Options extends ProviderOptions<T,M> = {}> extends FactoryBasedProvider<T, M, Options> {
  constructor(injector: Injector, id: InjectableId<T>, maker: M, options: Options = {} as Options) {
    super(injector, id, maker, options)
  }
  
  @Bind
  protected createState() {
    return State.create<T, M>(this.makePromiseForObj<T>(this.maker(this.injector), obj => obj))
  }
  
}
