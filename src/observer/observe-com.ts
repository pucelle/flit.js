import {mayAddComDependency, notifyComPropertySet, isUpdating} from './dependency'
import {proxyMap, Com, targetMap, observeTarget} from './shared'


export function observeComTarget<T extends Com>(com: T): T {
	let proxy = new Proxy(com, proxyHandler)
	proxyMap.set(com, proxy)
	proxyMap.set(proxy, proxy)
	targetMap.set(proxy, com)
	return proxy as T
}


const proxyHandler = {

	get(com: Com, prop: keyof Com & PropertyKey): unknown {
		let value: any = com[prop]

		// It doesn't check if own property exists here.
		mayAddComDependency(com, prop)

		if (value && typeof value === 'object') {
			if (proxyMap.has(value)) {
				return proxyMap.get(value)
			}
			// Here means it will only observe more data when updating.
			// If we choose to always observe every value, so many proxies will be generated.
			// Only generate new proxy only when updating still have a little problem.
			// If we cached some not proxy values, modify them will not cause rerender.
			else if (isUpdating()) {
				return observeTarget(value)
			}
		}

		// After think more about it, we decided to drop supports for observing getter.
		// else {
		// 	// If the name is a getter in obj, calling `obj[name]` will not pass proxy.
		// 	// so we need to find the getter descriptor firstly.
		// 	let comProxy = proxyMap.get(com)
		// 	let descriptor = getPropertyDescriptor(com, prop)
		// 	if (descriptor && descriptor.get) {
		// 		value = descriptor.get.call(comProxy)
		// 	}
		// 	else {
		// 		value = com[prop]
		// 	}
		// }

		return value
	},

	set(com: Com, prop: keyof Com & string, value: unknown): true {
		com[prop] = value
		notifyComPropertySet(com, prop)
		return true
	},

	has(com: Com, prop: string) {
		mayAddComDependency(com, prop)
		return prop in com
	},

	deleteProperty(com: Com, prop: string): boolean {
		if (com.hasOwnProperty(prop)) {
			mayAddComDependency(com, prop)
			return delete com[prop]
		}
		else {
			return true
		}
	}
}