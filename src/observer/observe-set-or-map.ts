import {notifyObjectSet, addDependency} from './dependency'
import {addTargetAndProxy} from './target-proxy'


/** Methods that will be observed. */
const WillObserveMapSetMethods = ['add', 'set', 'delete', 'clear']


/** Observe a map or a set. */
export function observeMapOrSetTarget(ms: any) {
	let proxy = new Proxy(ms, proxyHandler)
	addTargetAndProxy(ms, proxy)

	return proxy
}


// A potential issue in observing map and set:
// We may add an target item to a set, and then test if it's mapped proxy in set,
// not exist so add proxy of item, this cause duplicate values exist in a set.
// We will fix this when we indeed meet.
const proxyHandler = {

	get(ms: any, prop: string): any {
		let value = ms[prop]
		let type = typeof value

		if (!ms.hasOwnProperty(prop) && type === 'function') {
			// `bind` is required, directly passs a proxy as this to native Set or Map methods will cause an error.
			value = value.bind(ms)

			addDependency(ms)

			if (WillObserveMapSetMethods.includes(prop)) {
				notifyObjectSet(ms)
			}
		}

		return value
	}
}
