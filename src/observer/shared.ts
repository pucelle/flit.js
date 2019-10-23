import {observePlainObjectTarget} from './observe-object'
import {observeArrayTarget} from './observe-array'
import {observeMapOrSetTarget} from './observe-set-or-map'


/** Object or array target(unproxied), whose changing will trigger Updatable to update. */
export type Dependency = object

/** Component target (unproxied) instance, whose property changing will trigger Updatable to update. */
export type ComTarget = {[key: string]: any} & Dependency

/** 
 * Component instance (after proxied), or a watcher.
 * Property changes of their related dependencies will trigger Updatable to update.
 */
export interface Updatable {
	update(): void
}


/** `target -> proxy` and `proxy -> proxy` */
export const proxyMap: WeakMap<object, object> = new WeakMap()

/** `proxy -> target` */
export const targetMap: WeakMap<object, object> = new WeakMap()

const originalToString = Object.prototype.toString


export function observeTarget<T extends object>(obj: T): T {
	let str = originalToString.call(obj)

	if (str === '[object Array]') {
		return observeArrayTarget(obj as any[]) as T
	}
	
	if (str === '[object Object]') {
		return observePlainObjectTarget(obj) as T
	}

	if (str === '[object Set]' || str === '[object Map]') {
		return observeMapOrSetTarget(obj as any) as T
	}

	return obj
}
