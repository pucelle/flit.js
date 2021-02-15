/** A component, watcher, or anything else that can be updated. */
export interface Updatable {
	__updateImmediately(): void
}
