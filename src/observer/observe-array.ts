import {addDependency, notifyObjectSet, isUpdating} from './dependency'
import {observeTarget} from './observe'
import {addTargetAndProxy, getObservedOf} from './target-proxy'


const WillObserveArrayMethods = ['push', 'pop', 'unshift', 'splice', 'shift', 'sort']


export function observeArrayTarget(array: any[]) {
	let proxy = new Proxy(array, proxyHandler)
	addTargetAndProxy(array, proxy)

	return proxy
}


const proxyHandler = {

	get(array: any, prop: any): any {
		let value = array[prop]
		let type = typeof value

		if (array.hasOwnProperty(prop)) {
			addDependency(array)

			if (value && type === 'object') {
				let observed = getObservedOf(value)
				if (observed) {
					return observed
				}
				else if (isUpdating()) {
					return observeTarget(value)
				}
			}
		}
		else if (type === 'function') {
			addDependency(array)

			if (WillObserveArrayMethods.includes(prop as string)) {
				notifyObjectSet(array)
			}
		}

		return value
	},

	set(array: any, prop: any, value: any): true {
		(array as any)[prop] = value
		notifyObjectSet(array)

		return true
	},

	has(arr: any, prop: any): boolean {
		addDependency(arr)

		return prop in arr
	},

	deleteProperty(arr: any, prop: any): boolean {
		if (arr.hasOwnProperty(prop)) {
			addDependency(arr)

			return delete arr[prop]
		}
		else {
			return true
		}
	}
}
