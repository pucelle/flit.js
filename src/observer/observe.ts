import {proxyMap, observeTarget} from './shared'


/**
 * Begin to track `value`'s property settings, and update components which use `value`'s properties when needed.
 * Note that if returns a proxy, it can be used like original object, but it's not it, compare with `===` will return `false`.
 * So it may cause some issue if you cached the original object and compare it with observed one.
 * Normally you don't need to call this, component's properties will be observed automatically after used when rendering.
 * Once an object was observed, it can't be revoked.
 */
export function observe<T>(value: T): T {
	if (value && typeof value === 'object') {
		let proxy = proxyMap.get(value as unknown as object)
		if (proxy) {
			return proxy as unknown as T
		}

		return observeTarget(value as unknown as object) as unknown as T
	}
	else {
		return value
	}
}
