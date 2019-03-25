import {addDependency, notifyObjectSet} from './dependencies'
import {proxyMap, targetMap, observe} from './shared'


export function observeObject(obj: object) {
	let proxy = new Proxy(obj, proxyHandler)
	proxyMap.set(obj, proxy)
	targetMap.set(proxy, obj)
	return proxy
}


const proxyHandler = {

	get(obj: object, prop: keyof typeof obj): unknown {
		let value: any = obj[prop]
		let type = typeof value

		if (type === 'function') {
			return value
		}

		addDependency(obj)

		if (value && type === 'object') {
			return observe(value)
		}

		return value
	},

	set(obj: object, prop: keyof typeof obj, value: unknown): true {
		(obj as any)[prop] = value
		notifyObjectSet(obj)
		return true
	},

	has(obj: object, prop: string) {
		addDependency(obj)
		return prop in obj
	},

	deleteProperty(obj: object, prop: keyof typeof obj) {
		if (obj.hasOwnProperty(prop)) {
			addDependency(obj)
			return delete obj[prop]
		}
		else {
			return true
		}
	}
}
