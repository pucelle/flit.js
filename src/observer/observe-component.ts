import {addComDependency, notifyComPropertySet, isUpdating} from './dependency'
import {observeTarget} from './observe'
import {addTargetAndProxy, getObservedOf} from './target-proxy'
import {UpdatableTarget} from './types'


export function observeComponentTarget<T extends UpdatableTarget>(com: T): T {
	let proxy = new Proxy(com, proxyHandler)
	addTargetAndProxy(com, proxy)

	return proxy
}


const proxyHandler = {

	get(com: any, prop: any): any {
		let value = com[prop]

		// Not check whether own property exist here.
		// It's common that to declare `property!: Type` in Typescript,
		// Which has no initialize value but still need to be observed.
		addComDependency(com, prop)

		if (value && typeof value === 'object') {
			let observed = getObservedOf(value)
			if (observed) {
				return observed
			}
			
			// Only observe more properties when updating.
			// If we choose to always observe every value, too many proxies will be generated.
			else if (isUpdating()) {
				return observeTarget(value)
			}
		}

		return value
	},

	set(com: any, prop: any, value: any): true {
		com[prop] = value
		notifyComPropertySet(com, prop)
		return true
	},

	has(com: any, prop: any) {
		addComDependency(com, prop)
		return prop in com
	},

	deleteProperty(com: any, prop: any): boolean {
		if (com.hasOwnProperty(prop)) {
			addComDependency(com, prop)
			return delete com[prop]
		}
		else {
			return true
		}
	}
}