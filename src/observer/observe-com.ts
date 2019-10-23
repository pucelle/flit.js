import {mayAddComDependency, notifyComPropertySet, isUpdating} from './dependency'
import {proxyMap, ComTarget, targetMap, observeTarget} from './shared'


export function observeComTarget<T extends ComTarget>(com: T): T {
	let proxy = new Proxy(com, proxyHandler)
	proxyMap.set(com, proxy)
	proxyMap.set(proxy, proxy)
	targetMap.set(proxy, com)
	return proxy as T
}


const proxyHandler = {

	get(com: ComTarget, prop: keyof ComTarget & PropertyKey): any {
		let value: any = com[prop]

		// It doesn't check if own property exists here.
		// It's common that to declare `property!: Type` in Typescript,
		// Which has no initialize value but still need to be observed.
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

		return value
	},

	set(com: ComTarget, prop: keyof ComTarget & string, value: unknown): true {
		com[prop] = value
		notifyComPropertySet(com, prop)
		return true
	},

	has(com: ComTarget, prop: string) {
		mayAddComDependency(com, prop)
		return prop in com
	},

	deleteProperty(com: ComTarget, prop: string): boolean {
		if (com.hasOwnProperty(prop)) {
			mayAddComDependency(com, prop)
			return delete com[prop]
		}
		else {
			return true
		}
	}
}