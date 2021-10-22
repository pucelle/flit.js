import type {Component} from './component'


/** To cache callbacks after component initialized */
const ComponentCreationCallbackCache: WeakMap<HTMLElement, ((com: Component) => void)[]> = new WeakMap()

/** To cache all the connected components that element connected. */
const ConnectedComponents: Set<Component> = new Set()


/** Call callbacks after component instance created, and before triggering `created` event. */
export function onComponentCreatedAt(el: HTMLElement, callback: (com: Component) => void) {
	let callbacks = ComponentCreationCallbackCache.get(el)
	if (!callbacks) {
		ComponentCreationCallbackCache.set(el, (callbacks = []))
	}
	callbacks.push(callback)
}


/** 
 * Call after component created.
 * Used to assign properties from `.props`, or bind component events by `@com-event`.
 */
export function emitComponentCreatedCallbacks(el: HTMLElement, com: Component) {
	let callbacks = ComponentCreationCallbackCache.get(el)
	if (callbacks) {
		for (let callback of callbacks) {
			callback(com)
		}
		ComponentCreationCallbackCache.delete(el)
	}
}


/** On component element connected into document or fragment. */
export function onComponentConnected(com: Component) {
	ConnectedComponents.add(com)
}


/** On component element disconnected into document or fragment. */
export function onComponentDisconnected(com: Component) {
	ConnectedComponents.delete(com)
}


/** 
 * Updates all the components that elements are connected into document, and their watchers.
 * e.g., you may call this after language changes and not automatically detected.
 */
export function updateAllComponents() {
	for (let com of ConnectedComponents) {
		com.update()
		com.__updateWatcherGroup()
	}
}
