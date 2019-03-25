import {addDependency, notifyObjectSet} from './dependencies'
import {proxyMap, targetMap, observe} from './shared'


const arrayMethodsOverwrite = {

	push(this: unknown[], ...args: unknown[]) {
		let target = targetMap.get(this) as unknown[]
		let returns = target.push(...args)
		notifyObjectSet(target)
		return returns
	},

	pop(this: unknown[]) {
		let target = targetMap.get(this) as unknown[]
		let returns = target.pop()
		notifyObjectSet(target)
		return returns
	},

	unshift(this: unknown[], ...args: unknown[]) {
		let target = targetMap.get(this) as unknown[]
		let returns = target.unshift(...args)
		notifyObjectSet(target)
		return returns
	},

	splice(this: unknown[], number: number, deleteCount:number, ...args: unknown[]) {
		let target = targetMap.get(this) as unknown[]
		let returns = target.splice(number, deleteCount, ...args)
		notifyObjectSet(target)
		return returns
	},

	shift(this: unknown[]) {
		let target = targetMap.get(this) as unknown[]
		let returns = target.shift()
		notifyObjectSet(target)
		return returns
	},

	sort(this: unknown[], compareFn?: ((a: unknown, b: unknown) => number) | undefined) {
		let target = targetMap.get(this) as unknown[]
		let returns = target.sort(compareFn)
		notifyObjectSet(target)
		return returns
	}
}


export function observeArray(arr: unknown[]) {
	let proxy = new Proxy(arr, proxyHandler)
	proxyMap.set(arr, proxy)
	targetMap.set(proxy, arr)
	return proxy
}


const proxyHandler = {

	get(arr: unknown[], prop: string | number): unknown {
		if (arrayMethodsOverwrite.hasOwnProperty(prop)) {
			return arrayMethodsOverwrite[prop as keyof typeof arrayMethodsOverwrite]
		}

		addDependency(arr)

		let value = (arr as any)[prop]
		let type = typeof value

		if (value && type === 'object') {
			return observe(value)
		}

		return value
	},

	set(arr: unknown[], prop: keyof typeof arr, value: unknown): true {
		(arr as any)[prop] = value
		notifyObjectSet(arr)
		return true
	},

	has(arr: unknown[], prop: string) {
		addDependency(arr)
		return prop in arr
	},

	deleteProperty(arr: unknown[], prop: keyof typeof arr) {
		if (arr.hasOwnProperty(prop)) {
			addDependency(arr)
			return delete arr[prop]
		}
		else {
			return true
		}
	}
}
