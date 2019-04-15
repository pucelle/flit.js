import {mayAddDependency, notifyObjectSet, isUpdating} from './dependency'
import {proxyMap, targetMap, justObserveIt} from './shared'


export function observeObject(obj: object) {
	let proxy = new Proxy(obj, proxyHandler)
	proxyMap.set(obj, proxy)
	targetMap.set(proxy, obj)
	return proxy
}


const proxyHandler = {

	get(obj: object, prop: keyof typeof obj): unknown {
		let value: any = obj[prop]

		if (obj.hasOwnProperty(prop)) {
			mayAddDependency(obj)

			if (value && typeof value === 'object') {
				if (proxyMap.has(value)) {
					return proxyMap.get(value)
				}
				else if (isUpdating()) {
					return justObserveIt(value)
				}
			}
		}

		return value
	},

	set(obj: object, prop: keyof typeof obj, value: unknown): true {
		(obj as any)[prop] = value
		notifyObjectSet(obj)
		return true
	},

	has(obj: object, prop: string) {
		mayAddDependency(obj)
		return prop in obj
	},

	deleteProperty(obj: object, prop: keyof typeof obj) {
		if (obj.hasOwnProperty(prop)) {
			mayAddDependency(obj)
			return delete obj[prop]
		}
		else {
			return true
		}
	}
}
