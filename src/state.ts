/**
 * Internal class that allows us to track the state of a promise (chain).
 */
import { isDefined, isPromise } from "@3fv/guard"

export interface StateData<T, E> {
  pending: boolean
  promise?: Promise<T>
  value?: T
  rejection?: Error | any
}

export class State<T = any, E = any> {
  /**
   * Create a state record
   *
   * @param {Promise<T>} promise
   * @param rejection
   * @param {T} value
   * @returns {State<T>}
   */
  static create<T = any, E = any>(promise: Promise<T>, rejection?: E, value?: T): State<T> {
    const state = new State<T, E>()

    const { data } = state

    if (isPromise(promise)) {
      Object.assign(data, {
        pending: true,
        promise: promise.then(
          v => {
            data.value = v
            data.pending = false
            return v
          },
          (e: any) => {
            data.rejection = e
            data.pending = false
            throw e
          }
        )
      })
    } else {
      data.pending = false
      if (rejection) {
        data.rejection = rejection
      } else {
        data.value = value
      }
      data.promise = null
    }
    return state
  }

  protected readonly data: StateData<T, E>

  protected constructor() {
    this.data = {
      pending: true,
      promise: null,
      value: null,
      rejection: null
    }
  }

  get promise(): Promise<T> {
    return this.data.promise
  }

  get pending(): boolean {
    return this.data.pending
  }

  get fulfilled(): T {
    return this.data.value
  }

  get rejected(): E | any{
    return this.data.rejection
  }
}
