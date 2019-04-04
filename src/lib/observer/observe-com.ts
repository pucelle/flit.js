import {mayAddComDependency, notifyComPropertySet, isUpdating} from './dependencies'
import {getPropertyDescriptor, proxyMap, Com, targetMap, justObserveIt} from './shared'


export function observeCom(com: Com): Com {
	let proxy = new Proxy(com, proxyHandler)
	proxyMap.set(com, proxy)
	targetMap.set(proxy, com)
	return proxy as Com
}


const proxyHandler = {

	get(com: Com, prop: keyof Com & PropertyKey): unknown {
		let value: any

		if (com.hasOwnProperty(prop)) {
			value = com[prop]
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
					return justObserveIt(value)
				}
			}
		}
		else {
			// If the name is a getter in obj, calling `obj[name]` will not pass proxy.
			// so we need to find the getter descriptor firstly.
			let comProxy = proxyMap.get(com)
			let descriptor = getPropertyDescriptor(com, prop)
			if (descriptor && descriptor.get) {
				value = descriptor.get.call(comProxy)
			}
			else {
				value = com[prop]
			}
		}

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