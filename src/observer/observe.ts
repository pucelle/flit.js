import {observePlainObjectTarget} from './observe-object'
import {observeArrayTarget} from './observe-array'
import {observeMapOrSetTarget} from './observe-set-or-map'
import {getObservedOf} from './target-proxy'


/** Original `toString` method of object. */
const originalToString = Object.prototype.toString


/**
 * Begin to track property changes of `value`, if use `value` during a updating of a component or watcher,
 * Then the property changes of returned observed object will trigger the component or watcher to be updated.
 * 
 * Note that it returns a proxy, it can be used just like original object,
 * but it's not absolutly equals with original value, and comparing with `===` will return `false`.
 * So it may cause some issues if you cached the original object and compare it with observed one.
 * 
 * Normally you don't need to call this method, properties of components will be observed automatically.
 * But once an object was observed, it can't be revoked.
 * 
 * @param value The object to be observed, it can also an observed object, will not observe it for twice.
 * @returns The observed object, it's properties changes will be watched.
 */
export function observe<T>(value: T): T {
	if (value && typeof value === 'object') {
		let proxy = getObservedOf(value)
		if (proxy) {
			return proxy
		}

		return observeTarget(value) 
	}
	else {
		return value
	}
}


/** Observe an unobserved target object. */
export function observeTarget<T>(obj: T): T {
	let str = originalToString.call(obj)

	if (str === '[object Array]') {
		return observeArrayTarget(obj as any) as T
	}
	
	if (str === '[object Object]') {
		return observePlainObjectTarget(obj as any) as T
	}

	if (str === '[object Set]' || str === '[object Map]') {
		return observeMapOrSetTarget(obj as any) as T
	}

	return obj
}
