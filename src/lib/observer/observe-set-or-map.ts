import {notifyObjectSet, mayAddDependency} from './dependency'
import {proxyMap, targetMap} from './shared'


type MapOrSet = Map<unknown, unknown> | Set<unknown>

const MAP_SET_SET_METHODS = ['add', 'set', 'delete', 'clear']


export function observeMapOrSetTarget(ms: MapOrSet) {
	let proxy = new Proxy(ms, proxyHandler)
	proxyMap.set(ms, proxy)
	proxyMap.set(proxy, proxy)
	targetMap.set(proxy, ms)
	return proxy
}


const proxyHandler = {

	get(ms: MapOrSet, prop: PropertyKey): unknown {
		let value = (ms as any)[prop]
		let type = typeof value

		if (!ms.hasOwnProperty(prop) && type === 'function') {
			// Required, pass proxy to native Set or Map methods will cause error.
			value = value.bind(ms)
			mayAddDependency(ms)

			if (MAP_SET_SET_METHODS.includes(prop as string)) {
				notifyObjectSet(ms)
			}
		}

		return value
	}
}
