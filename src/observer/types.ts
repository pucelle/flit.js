/** Unproxied object or array target, after which changed, it's associated UpdatableProxied should be updated. */
export type Dependency = object

/** Unproxied component target instance, their property changes will trigger UpdatableProxied to be updated. */
export type UpdatableTarget = Record<string, any> & Dependency

/** 
 * Proxied Component instances, or a watcher.
 * Their property changes of their associated dependencies will trigger them to update.
 */
export interface UpdatableProxied {
	update(): void
}
