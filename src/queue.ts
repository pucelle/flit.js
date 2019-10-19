import {Component} from './component'
import {Watcher} from './watcher'


let componentSet: Set<Component> = new Set()
let watcherSet: Set<Watcher> = new Set()
let renderCompleteCallbacks: (() => void)[] = []
let willUpdate = false
let updatingComponents = false
let watchersToUpdate: Watcher[] = []
let componentsToUpdate: Component[] = []
let updatedTimesMap: Map<Watcher | Component, number> = new Map()


/** @hidden */
export function enqueueComponentToUpdate(com: Component) {
	// If updating component trigger another watcher or component, we should update it in the same update function.
	if (!componentSet.has(com)) {
		if (updatingComponents) {
			let updatedTimes = updatedTimesMap.get(com) || 0
			updatedTimesMap.set(com, updatedTimes + 1)
			
			if (updatedTimes > 3) {
				let html = com.el.outerHTML
				let shortHTML = html.length > 100 ? html.slice(0, 100) + '...' : html
				console.warn(`Component with element "${shortHTML}" may change values in the render function and cause infinite updating!`)
			}
		}

		componentSet.add(com)
		componentsToUpdate.push(com)
	}

	if (!willUpdate) {
		enqueueUpdate()
	}
}

/** @hidden */
export function enqueueWatcherToUpdate(watcher: Watcher) {
	if (updatingComponents) {
		watcher.__updateImmediately()
	}
	else {
		// If updating watcher trigger another watcher or component, we should update it in the same update function.
		if (!watcherSet.has(watcher)) {
			watcherSet.add(watcher)
			watchersToUpdate.push(watcher)
		}

		if (!willUpdate) {
			enqueueUpdate()
		}
	}
}

/** 
 * Call `callback` after rendered all the components in followed micro task queues.
 * Note that it was called before `renderComplete`.
 */
export function onRenderComplete(callback: () => void) {
	renderCompleteCallbacks.push(callback)
	
	if (!willUpdate) {
		enqueueUpdate()
	}
}

/** 
 * Returns a promise which will be resolved after rendered all the components in micro task queues.
 * Note that it was called after `onRenderComplete`.
 * So if you are implementing a common component, using `onRenderComplete` would be better.
 * Please don't call `await renderComplete()` for two times,
 * The second one will be called in a new `requestAnimationFrame` and browser will render before it.
 */
export function renderComplete(): Promise<void> {
	return new Promise(resolve => {
		onRenderComplete(resolve)
	})
}

function enqueueUpdate() {
	// Why not using `Promise.resolve().then` to start a micro stask:
	// When initialize a component from `connectedCallback`, it's child nodes is not ready,
	// even in the following micro task queue.
	// But we need `<slot>` elemnts to be prepared before updating.

	// Otherwise it's very frequently to trigger updating from data changing ,
	// but then more data changes in micro tasks and trigger new updating.
	requestAnimationFrame(update)
	willUpdate = true
}

async function update() {

	do {
		// At beginning, we update watchers firstly and then components,
		// because we want to reduce the sencories that data changing in watchers cause components to updated.
		
		// But later we relaized the watchers were updated most possible because the components updated and applied `:prop` or `:props`,
		// And updating watchers later can ensure components which requires the watched properties are rendered.

		// So finally we decided to update watchers before components,
		// And if components is updating, we update watchers immediately.
		
		for (let i = 0; i < watchersToUpdate.length; i++) {
			let watcher = watchersToUpdate[i]

			// Delete it so it can be added again.
			watcherSet.delete(watcher)

			let updatedTimes = updatedTimesMap.get(watcher) || 0
			updatedTimesMap.set(watcher, updatedTimes + 1)
		
			if (updatedTimes > 3) {
				console.warn(`Watcher "${watcher.toString()}" may change values in the watcher callback and cause infinite updating!`)
			}
			else {
				try {
					watcher.__updateImmediately()
				}
				catch (err) {
					console.error(err)
				}
			}
		}
		
		watchersToUpdate = []


		updatingComponents = true

		for (let i = 0; i < componentsToUpdate.length; i++) {
			let com = componentsToUpdate[i]
			componentSet.delete(com)

			try {
				com.__updateImmediately()
			}
			catch (err) {
				console.error(err)
			}
		}

		componentsToUpdate = []
		updatingComponents = false

		// If elements were added when updating, they will be connected in micro task queue.
		// Here we must wait them to be instantiated.
		await Promise.resolve()
	}
	while (componentsToUpdate.length > 0 || watchersToUpdate.length > 0)

	willUpdate = false
	updatedTimesMap = new Map()

	// Normally `onRenderComplete` should not enqueue more watchers and components.
	// But if it enqueued, run them in next updating.
	let callbacks = renderCompleteCallbacks
	renderCompleteCallbacks = []

	for (let callback of callbacks) {
		callback()
	}
}
