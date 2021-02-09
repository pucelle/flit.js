/** Unproxied object or array target, after which changed, it's associated Updatable should be updated. */
type Dependency = object

/** Unproxied component target instance, their property changes will trigger Updatable to be updated. */
type UpdatableTarget = Record<string, any> & Dependency

/** 
 * Proxied Component instances, or a watcher.
 * Their property changes of their associated dependencies will trigger Updatable to update.
 */
interface UpdatableProxied {
	update(): void
}
