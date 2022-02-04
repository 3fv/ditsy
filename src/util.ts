import { isDev } from "./dev"
import { isFunction, isBoolean, isDefined, isString, isSymbol, isClass } from "@3fv/guard"
import { InjectableId } from "./injector"
import { isEmpty, negate } from "lodash"
import { Option } from "@3fv/prelude-ts"

export function debug(test: boolean | any, ...args: any[]) {
  if (isDev && !!test) {
    args = Option.of(test)
      .filter(negate(isBoolean))
      .map(test => [test, ...args])
      .getOrElse(args)

    console.debug(...args)
  }
}

export function info(test: boolean | any, ...args: any[]) {
  if (isDev && !!test) {
    args = Option.of(test)
      .filter(negate(isBoolean))
      .map(test => [test, ...args])
      .getOrElse(args)

    if (typeof process !== "undefined" && process?.env?.["JEST_WORKER_ID"]) {
      // IN JEST WORKER, DON'T WARN
      return
    }
    console.info(...args)
  }
}

export function warn(test: boolean | any, ...args: any[]) {
  if (isDev && !!test) {
    args = Option.of(test)
      .filter(negate(isBoolean))
      .map(test => [test, ...args])
      .getOrElse(args)

    if (typeof process !== "undefined" && process?.env?.["JEST_WORKER_ID"]) {
      // IN JEST WORKER, DON'T WARN
      return
    }
    console.warn(...args)
  }
}

// Help user locate misapplied decorators.
export function targetHint<T>(target: T) {
  return isFunction(target) ? target.name ?? target.constructor?.name : target?.toString()
}

export function isId(id: any): id is InjectableId<any> {
  return isString(id) || isSymbol(id) || isClass(id)
}

export function idHint(id: InjectableId<any>) {
  return isFunction(id) ? id.name ?? id.toString() : id?.toString()
}

export const isNotDefined = negate(isDefined)

export const isNotEmpty = negate(isEmpty)
