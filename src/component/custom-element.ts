
import {ComponentConstructor, createComponent} from './define'
import {getComponent} from './from-element'


// When `connectedCallback` called on a element, it's child nodes are not ready yet.
// So we can't leave an element into document firstly, and wait it to be connected,
// but must render all the html codes with javascript, and insert into document in bundle.

// Otherwise If we include bundled js behind all other custom element tags in a document, or with `defer` property,
// since elements were prepared already, then they will be connected in component registration order, not in element order.
// We fix this by connect connect elements later, and sort them before connect each.

// Both `connectedCallback` and `disconnectedCallback` may triggered multiple times when element moving or removing.
// So we must delay the component connect and disconnect operation by a queue.


/** Using queue to delay the connect and disconnect operations for elements. */
let toConnectSoonCache: Map<HTMLElement, ComponentConstructor> = new Map()
let toDisconnectSoonCache: Map<HTMLElement, ComponentConstructor> = new Map()

/** Whether having things in queue to update. */
let needsUpdate = false


/** Defines custom element to connect and create component automatically. */
export function defineCustomElement(name: string, Com: ComponentConstructor) {
	customElements.define(name, class FlitElement extends HTMLElement {

		// Although spec says connect callback will not be called when inserting element to a document fragment,
		// but I still find it may be triggrred in a rate.
		connectedCallback() {
			if (!(this.ownerDocument instanceof DocumentFragment)) {
				enqueueConnect(this, Com)
			}
		}

		// Moving or removing element will trigger disconnected callback each time.
		disconnectedCallback() {
			enqueueDisconnect(this, Com)
		}
	})

}


/** Enqueue connection for an element. */
function enqueueConnect(el: HTMLElement, Com: ComponentConstructor) {
	// Can avoid appending elements triggers disconnect and connect soon.
	if (toDisconnectSoonCache.has(el)) {
		toDisconnectSoonCache.delete(el)
	}
	else {
		toConnectSoonCache.set(el, Com)

		if (!needsUpdate) {
			enqueueUpdate()
		}
	}
}


/** Enqueue disconnection for an element. */
function enqueueDisconnect(el: HTMLElement, Com: ComponentConstructor) {
	// Can avoid inserting elements into a fragment and then removed triggers connect.
	if (toConnectSoonCache.has(el)) {
		toConnectSoonCache.delete(el)
	}
	else {
		toDisconnectSoonCache.set(el, Com)

		if (!needsUpdate) {
			enqueueUpdate()
		}
	}
}


/** Enqueue a updating task if no task yet. */
function enqueueUpdate() {
	Promise.resolve().then(update)
	needsUpdate = true
}


/** Update, handle all connect and disconnect requests. */
function update() {
	if (toConnectSoonCache.size > 0) {
		updateConnectRequests()
	}

	// Disconnect elements later may avoid it slows followed rendering.
	if (toDisconnectSoonCache.size > 0) {
		updateDisconnectRequests()
	}

	needsUpdate = false
}


/** Handle all connect requests. */
function updateConnectRequests() {
	let toConnectImmediately = toConnectSoonCache

	// More connect requests will come, must delay them.
	toConnectSoonCache = new Map()

	// Important: elements were sorted as map keys.
	for (let [el, Com] of toConnectImmediately.entries()) {
		
		// `el` may not in document,
		// e.g., inserted into a fragment.
		// No need to worry about forgetting to instantiate it,
		// it will trigger `connectedCallback` again after insert into document.

		// Here also have a small rate document not contains el.
		connectElement(el, Com)
	}
}


/** Handle all disconnect requests. */
function updateDisconnectRequests() {
	// More connect requests will be added, must delay them.
	let toDisconnectImmediately = toDisconnectSoonCache
	toDisconnectSoonCache = new Map()

	for (let el of toDisconnectImmediately.keys()) {
		disconnectElement(el)
	}
}


/** Connect element and create component. */
function connectElement(el: HTMLElement, Com: ComponentConstructor) {
	let com = getComponent(el)
	let isFirstTimeCreated = false

	if (!com) {
		com = createComponent(el, Com)
		isFirstTimeCreated = true
	}
	
	com.__emitConnected(isFirstTimeCreated)
}


/** Disconnect element and emit disconnect event for component. */
function disconnectElement(el: HTMLElement) {
	let com = getComponent(el)
	if (com) {
		com.__emitDisconnected()
	}
}
