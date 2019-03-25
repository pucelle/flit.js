import {addComDependency, notifyComPropertySet} from './dependencies'
import {getPropertyDescriptor, proxyMap, Com, targetMap, observe} from './shared'


export function observeCom(com: Com): Com {
	let proxy = new Proxy(com, proxyHandler)
	proxyMap.set(com, proxy)
	targetMap.set(proxy, com)
	return proxy as Com
}


const proxyHandler = {

	get(com: Com, prop: keyof Com & PropertyKey): unknown {
		let value: any = com[prop]

		// We never observe function, which implies function type property should not be changed,
		// no matter it's own properties or in prototype chain.
		let type = typeof value
		if (type === 'function') {
			return value
		}

		/**
		 * If the name is a getter in obj, calling `obj[name]` will not pass proxy.
		 * so we need to find the getter descriptor firstly.
		 */
		if (!com.hasOwnProperty(prop)) {
			let proxy = proxyMap.get(com)
			let descriptor = getPropertyDescriptor(com, prop)
			if (descriptor && descriptor.get) {
				value = descriptor.get.call(proxy)
			}
		}

		addComDependency(com, prop)

		if (value && type === 'object') {
			return observe(value)
		}

		return value
	},

	set(com: Com, prop: keyof Com & string, value: unknown): true {
		com[prop] = value
		notifyComPropertySet(com, prop)
		return true
	},

	has(com: Com, prop: string) {
		addComDependency(com, prop)
		return prop in com
	},

	deleteProperty(com: Com, prop: string): boolean {
		if (com.hasOwnProperty(prop)) {
			addComDependency(com, prop)
			return delete com[prop]
		}
		else {
			return true
		}
	}
}