import type {Component} from './component'
import type {ComponentConstructor} from './define'
import {onComponentCreatedAt} from './life-cycle'


/** To cache `el -> com` map and find component from element. */
const elementComponentMap: WeakMap<HTMLElement, Component> = new WeakMap()


/** Set element -> component instance map. */
export function setElementComponentMap(el: HTMLElement, com: Component) {
	elementComponentMap.set(el, com)
}


/**
 * Get component instance from custom element.
 * @param el The element to get component instance at.
 * @return The found component or `null` if no component registered on the element.
 */
export function getComponent(el: HTMLElement): Component | null {
	return elementComponentMap.get(el) || null
}


/**
 * Get component instance from element as soon as component created,
 * Before properties applied and before trigging `created` event.
 * Only for inner usage.
 * @param el The element to get component instance at.
 */
 export function getComponentInCallback(el: HTMLElement, callback: (com: Component | null) => void) {
	if (el.localName.includes('-')) {
		let com = elementComponentMap.get(el)
		if (com) {
			callback(com)
		}
		else {
			onComponentCreatedAt(el, callback)
		}
	}
	else {
		callback(null)
	}
}


/**
 * Get component instance from root element asynchronously.
 * Returns a promise which will be resolved after component created and triggers `created` event.
 * @param el The element to get component instance at.
 * @return The found component or `null` if is not a custom element.
 */
export function getComponentAsync(el: HTMLElement): Promise<Component | null> {
	if (el.localName.includes('-')) {
		let com = elementComponentMap.get(el)
		if (com) {
			return Promise.resolve(com)
		}
		else {
			return new Promise(resolve => {
				onComponentCreatedAt(el, resolve)
			})
		}
	}
	else {
		return Promise.resolve(null)
	}
}


/**
 * Get closest component matches constructor from the closest ancestor custom element.
 * It's very common that you extend a component and define a new custom element,
 * So you will can't find the parent component from the tag name.
 * But you can still match super class by this method.
 * @param el The element to search from it and it's ancestors for component instance.
 * @param Com The component constructor to search.
 * @returns The found component or `null` if no component found.
 */
export function getClosestComponentOfType<C extends ComponentConstructor>(el: Element, Com: C): InstanceType<C> | null {
	let parent: Element | null = el

	while (parent && parent instanceof HTMLElement) {
		if (parent.localName.includes('-')) {
			let com = getComponent(parent) as Component
			if (com instanceof Com) {
				return com as InstanceType<C>
			}
		}
		
		parent = parent.parentElement
	}

	return null
}


/**
 * Get closest component from the closest ancestor custom element.
 * Only for inner usage.
 * @param el The element to search from it and it's ancestors.
 */
export function getClosestComponentInCallback(el: Element, callback: (com: Component | null) => void) {
	let parent: Element | null = el

	while (parent && parent instanceof HTMLElement) {
		if (parent.localName.includes('-')) {
			getComponentInCallback(parent, callback)
			return
		}
		
		parent = parent.parentElement
	}

	callback(null)
}