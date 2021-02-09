
type Target = any
type Proxy = any


/** Caches `target -> proxy` and `proxy -> proxy` */
export const ToProxyMap: WeakMap<Target, Proxy> = new WeakMap()


/** Returns observed object from target, or returns itself if is an observed object already. */
export function getObservedOf<T>(target: T): T | undefined {
	return ToProxyMap.get(target)
}


/** Add one target-proxy map. */
export function addTargetAndProxy<T>(target: T, proxy: T) {
	ToProxyMap.set(target, proxy)
	ToProxyMap.set(proxy, proxy)
}

