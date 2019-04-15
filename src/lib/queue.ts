import {Component} from "./component"
import {Watcher} from "./watcher"


let componentSet: Set<Component> = new Set()
let watchSet: Set<Watcher> = new Set()
let afterRenderCallbacks: (() => void)[] = []
let updateEnqueued = false
let updatingWatchers: Watcher[] = []
let updatingComponents: Component[] = []


export function enqueueComponentUpdate(com: Component) {
	// If updating component trigger another watcher or component, we should update it in the same update function.
	if (!componentSet.has(com)) {
		componentSet.add(com)
		updatingComponents.push(com)
	}

	if (!updateEnqueued) {
		enqueueUpdate()
	}
}

export function enqueueWatcherUpdate(watcher: Watcher) {
	// If updating watcher trigger another watcher or component, we should update it in the same update function.
	if (!watchSet.has(watcher)) {
		watchSet.add(watcher)
		updatingWatchers.push(watcher)
	}

	if (!updateEnqueued) {
		enqueueUpdate()
	}
}

/** 
 * Call callback after next rendered all the components in next micro task.
 * Note that it will call callback immediately if no updating tasks enqueued.
 */
export function onRenderComplete(callback: () => void) {
	afterRenderCallbacks.push(callback)
	
	if (!updateEnqueued) {
		enqueueUpdate()
	}
}

/** 
 * Returns a promise which will be resolved after rendered all the components in next micro task.
 * Note that it will call callback in the next micro task if no updating tasks enqueued.
 */
export function renderComplete(): Promise<void> {
	return new Promise(resolve => {
		onRenderComplete(resolve)
	})
}

function enqueueUpdate() {
	updateEnqueued = true

	// Why not using `Promise.resolve().then` to start a micro stask:
	// When initialize a component from `connectCallback`, it's child nodes is not ready,
	// even in the following micro task queue.
	// But we need `<slot>` elemnts to be prepared before updating.

	// Otherwise it's very frequently to trigger updating from data changing ,
	// but then more data changes in micro tasks and trigger new updating.
	requestAnimationFrame(update)
}

function update() {
	let updatedTimesMap: Map<Watcher | Component, number> = new Map()

	do {
		// When updating watch or component, data may changed and enqueu more watcher and component.
		// if enqueued more watch, we will run it in the same update function.

		// The only problems at ignore watch orders when updating is that:
		// We may update inside firstly, and then outside, then data may flow back into inside. 
		// So inner watcher may update for 1 more time.
		for (let i = 0; i < updatingWatchers.length; i++) {
			let watcher = updatingWatchers[i]

			// Delete it so it can be added again for at most once.
			watchSet.delete(watcher)

			let updatedTimes = updatedTimesMap!.get(watcher) || 0
			updatedTimesMap.set(watcher, updatedTimes + 1)
		
			if (updatedTimes > 3) {
				console.warn(`Watcher "${watcher.toString()}" may have infinite updating`)
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
		updatingWatchers = []
		
		// We update components afte watchers because we want to reduce the sencories that
		// data changing cause components needs to be updated.
		// In fact component updating will also trigger watcher updating from `:prop`.
		for (let i = 0; i < updatingComponents.length; i++) {
			let com = updatingComponents[i]
			componentSet.delete(com)

			let updatedTimes = updatedTimesMap!.get(com) || 0
			updatedTimesMap.set(com, updatedTimes + 1)
			
			if (updatedTimes > 3) {
				console.warn(`Component with element "${com.el.outerHTML}" may have infinite updating`)
			}
			else {
				try {
					com.__updateImmediately()
				}
				catch (err) {
					console.error(err)
				}
			}
		}
		updatingComponents = []
	}
	while (updatingWatchers.length > 0)

	updateEnqueued = false

	// Normally `onRenderComplete` should not enqueue updating for more watchers and components here.
	// But if enqueued, enqueue in a new updating.
	let callbacks = afterRenderCallbacks
	afterRenderCallbacks = []

	for (let callback of callbacks) {
		callback()
	}
}
