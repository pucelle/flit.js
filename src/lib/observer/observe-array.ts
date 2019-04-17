import {mayAddDependency, notifyObjectSet, isUpdating} from './dependency'
import {proxyMap, targetMap, observeTarget} from './shared'


const ARRAY_SET_METHODS = ['push', 'pop', 'unshift', 'splice', 'shift', 'sort']


export function observeArrayTarget(arr: unknown[]) {
	let proxy = new Proxy(arr, proxyHandler)
	proxyMap.set(arr, proxy)
	proxyMap.set(proxy, proxy)
	targetMap.set(proxy, arr)
	return proxy
}


const proxyHandler = {

	get(arr: unknown[], prop: string | number): unknown {
		let value = (arr as any)[prop]
		let type = typeof value

		if (arr.hasOwnProperty(prop)) {
			mayAddDependency(arr)

			if (value && type === 'object') {
				if (proxyMap.has(value)) {
					return proxyMap.get(value)
				}
				else if (isUpdating()) {
					return observeTarget(value)
				}
			}
		}
		else if (type === 'function') {
			// Required, pass proxy to native Array methods may cause some mistakes or not necessary callings.
			value = value.bind(arr)
			mayAddDependency(arr)

			if (ARRAY_SET_METHODS.includes(prop as string)) {
				notifyObjectSet(arr)
			}
		}

		return value
	},

	set(arr: unknown[], prop: keyof typeof arr, value: unknown): true {
		(arr as any)[prop] = value
		notifyObjectSet(arr)
		return true
	},

	has(arr: unknown[], prop: string) {
		mayAddDependency(arr)
		return prop in arr
	},

	deleteProperty(arr: unknown[], prop: keyof typeof arr) {
		if (arr.hasOwnProperty(prop)) {
			mayAddDependency(arr)
			return delete arr[prop]
		}
		else {
			return true
		}
	}
}
