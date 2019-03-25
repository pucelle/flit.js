import {addDependency, notifyObjectSet} from './dependencies'
import {proxyMap, targetMap} from './shared'


type MapOrSet = Map<unknown, unknown> | Set<unknown>

const mapOrSetGetTypeMethodsOverwrite = {

	keys(this: MapOrSet) {
		let target = targetMap.get(this) as MapOrSet
		let returns = target.keys()
		addDependency(target)
		return returns
	},

	values(this: MapOrSet) {
		let target = targetMap.get(this) as MapOrSet
		let returns = target.values()
		addDependency(target)
		return returns
	},

	entries(this: MapOrSet) {
		let target = targetMap.get(this) as MapOrSet
		let returns = target.entries()
		addDependency(target)
		return returns
	},

	forEach(this: MapOrSet, callbackFn: () => void, thisArgs?: any) {
		let target = targetMap.get(this) as MapOrSet
		let returns = target.forEach(callbackFn, thisArgs)
		addDependency(target)
		return returns
	},

	has(this: MapOrSet, value: unknown) {
		let target = targetMap.get(this) as MapOrSet
		let returns = target.has(value)
		addDependency(target)
		return returns
	}
}


const mapOrSetSetTypeMethodsOverwrite = {

	add(this: Set<unknown>, value: unknown) {
		let target = targetMap.get(this) as Set<unknown>
		let returns = target.add(value)
		notifyObjectSet(target)
		return returns
	},

	set(this: Map<unknown, unknown>, prop: unknown, value: unknown) {
		let target = targetMap.get(this) as Map<unknown, unknown>
		let returns = target.set(prop, value)
		notifyObjectSet(target)
		return returns
	},

	delete(this: MapOrSet, value: unknown) {
		let target = targetMap.get(this) as MapOrSet
		let returns = target.delete(value)
		notifyObjectSet(target)
		return returns
	},

	clear(this: MapOrSet) {
		let target = targetMap.get(this) as MapOrSet
		let returns = target.clear()
		notifyObjectSet(target)
		return returns
	}
}


export function observeMapOrSet(ms: MapOrSet) {
	let proxy = new Proxy(ms, proxyHandler)
	proxyMap.set(ms, proxy)
	targetMap.set(proxy, ms)
	return proxy
}


const proxyHandler = {

	get(ms: MapOrSet, prop: PropertyKey): unknown {
		if (mapOrSetGetTypeMethodsOverwrite.hasOwnProperty(prop)) {
			return mapOrSetGetTypeMethodsOverwrite[prop as keyof typeof mapOrSetGetTypeMethodsOverwrite]
		}

		if (mapOrSetSetTypeMethodsOverwrite.hasOwnProperty(prop)) {
			return mapOrSetSetTypeMethodsOverwrite[prop as keyof typeof mapOrSetSetTypeMethodsOverwrite]
		}

		return ms[prop as keyof typeof ms]
	}
}
