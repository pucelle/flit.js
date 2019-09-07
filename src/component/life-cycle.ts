import {Component} from './component'
import {globalWatcherSet} from '../watcher'


/** To cache callbacks after component initialized */
const componentCreatedMap: WeakMap<HTMLElement, ((com: Component) => void)[]> = new WeakMap()

/** Call callbacks after component instance created. */
export function onComponentCreatedAt(el: HTMLElement, callback: (com: Component) => void) {
	let callbacks = componentCreatedMap.get(el)
	if (!callbacks) {
		componentCreatedMap.set(el, (callbacks = []))
	}
	callbacks.push(callback)
}

/** may assign properties from `:props`, or bind component events from `@com-event` */
export function emitComponentCreatedCallbacks(el: HTMLElement, com: Component) {
	let callbacks = componentCreatedMap.get(el)
	if (callbacks) {
		for (let callback of callbacks) {
			callback(com)
		}
		componentCreatedMap.delete(el)
	}
}


/** To mark all the connected components */
const connectedComponentSet: Set<Component> = new Set()

export function onComponentConnected(com: Component) {
	connectedComponentSet.add(com)
}

export function onComponentDisconnected(com: Component) {
	connectedComponentSet.delete(com)
}

/** Update all components, e.g., when current language changed. */
export function update() {
	for (let watcher of globalWatcherSet) {
		watcher.update()
	}

	for (let com of connectedComponentSet) {
		com.update()
		com.__updateWatchers()
	}
}
