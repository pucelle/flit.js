import {notifyObjectSet, mayAddDependency} from './dependency'
import {proxyMap, targetMap} from './shared'


type MapOrSet = Map<any, any> | Set<any>

const MAP_SET_METHODS = ['add', 'set', 'delete', 'clear']


export function observeMapOrSetTarget(ms: MapOrSet) {
	let proxy = new Proxy(ms, proxyHandler)
	proxyMap.set(ms, proxy)
	proxyMap.set(proxy, proxy)
	targetMap.set(proxy, ms)
	return proxy
}


// A potential issue in map and set:
// We may add an item to a set, and then test if proxy of item in set,
// or add proxy of item and cause it has duplicate values in set.
// We will fix this when we indeed meet this.
const proxyHandler = {

	get(ms: MapOrSet, prop: PropertyKey): any {
		let value = (ms as any)[prop]
		let type = typeof value

		if (!ms.hasOwnProperty(prop) && type === 'function') {
			// Required, pass proxy as this to native Set or Map methods will cause error.
			value = value.bind(ms)
			mayAddDependency(ms)

			if (MAP_SET_METHODS.includes(prop as string)) {
				notifyObjectSet(ms)
			}
		}

		return value
	}
}
