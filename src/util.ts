import { isDev } from "./dev"
import { isFunction, isDefined, isString, isSymbol, isClass } from "@3fv/guard"
import { InjectableId } from "./injector"
import { isEmpty, negate } from "lodash"

export function debug(test: boolean, ...args:any[])
export function debug(...args:any[])
export function debug(...args:any[]) {
  if (isDev && args[0] !== false) {
    console.debug(...args)
  }
}

export function info(test: boolean, ...args:any[]) {
  if (isDev && test) {
    console.info(...args)
  }
}

export function warn(test: boolean, ...args:any[]) {
  if (isDev && test) {
    console.warn(...args)
  }
}



// Help user locate misapplied decorators.
export function targetHint<T>(target: T) {

  return isFunction(target) ?
    target.name ?? target.constructor?.name :
    target?.toString()
}


export function isId(id: any): id is InjectableId<any>{
  return isString(id) || isSymbol(id) || isClass(id)
}

export function idHint(id: InjectableId<any>) {
  return isFunction(id) ?
    id.name ?? id.toString() :
    id?.toString()
}


export const isNotDefined = negate(isDefined)

export const isNotEmpty = negate(isEmpty)
