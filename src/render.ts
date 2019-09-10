import {TemplateResult, Template, html} from './parts'
import {Component, Context} from './component/component'
import {getComponentConstructorByName} from './component/define'
import {globalWatcherGroup} from './watcher'
import {createComponent} from './element'
import {DirectiveResult} from './directives'


/**
 * Render html codes or a template like html`...` in context or null, returns the rendered result as an document fragment.
 * @param codes The html code piece or html`...` template.
 * @param context The context you used when rendering.
 */
export function render(codes: TemplateResult | DirectiveResult, context?: Context): DocumentFragment

/**
 * Render template like html`...` returned from `renderFn`, returns the rendered result as an document fragment and the watcher.
 * Will watch `renderFn`, If it's dependent datas changed, will automaticaly updated and call `onUpdate` if it was specified.
 * If `context` was specified, The connected state of the watcher that used to watch `renderFn` will synchronize with the `context`.
 * It doesn't connect with returned watcher with context, 
 * @param renderFn Returns template like html`...`
 * @param context The context you used when rendering.
 * @param onUpdate Called when update after referenced data changed. if new result can't merge with old, will pass a new fragment as argument.
 */
export function render(renderFn: () => TemplateResult | DirectiveResult, context?: Context, onUpdate?: () => void): {fragment: DocumentFragment, unwatch: () => void}

export function render(
	codesOrRenderFn: TemplateResult | DirectiveResult | (() => TemplateResult | DirectiveResult),
	context: Context = null,
	onUpdate?: () => void
) {
	if (typeof codesOrRenderFn === 'function') {
		return renderAndWatch(codesOrRenderFn, context, onUpdate)
	}
	else {
		return renderCodes(codesOrRenderFn, context)
	}
}

function renderCodes(codes: TemplateResult | DirectiveResult, context: Context = null): DocumentFragment {
	if (codes instanceof DirectiveResult) {
		codes = html`${codes}`
	}

	let template = new Template(codes, context)
	let fragment = template.range.getFragment()

	return fragment
}

function renderAndWatch(renderFn: () => TemplateResult | DirectiveResult, context: Context = null, onUpdate?: () => void) {
	let template: Template

	let unwatch = (context || globalWatcherGroup).watchImmediately(renderFn, (result: TemplateResult | DirectiveResult) => {
		if (result instanceof DirectiveResult) {
			result = html`${result}`
		}

		if (template) {
			template.merge(result)

			if (onUpdate) {
				onUpdate()
			}
		}
		else {
			template = new Template(result, context)
		}
	})

	return {
		fragment: template!.range.getFragment(),
		unwatch,
	}
}


/**
 * You can't get a component instance immediately by `render` before they were appended into document, but you can do this by `renderComponent`.
 * Be careful that it's element is not in document when rendering for the first time.
 * You should append `component.el` to document manually.
 * After `el` of returned element removed, it will be disconnected.
 * @param codes The html code piece or html`...` template.
 * @param context The context you used when rendering.
 */
export function renderComponent(codes: TemplateResult | string | DirectiveResult, context?: Context): Component | null

/**
 * Render template like html`...` returned from `renderFn` in context or null, returns the first component from the rendering result.
 * Be careful the returned component was just created yet, not ready or been connected into document.
 * You should append `component.el` to document manually, Then it will be connected later.
 * If `context` was specified, The connected state of the watcher that used to watch `renderFn` will synchronize with the `context`.
 * Caution: The returned template from `renderFn` must can merge with the last returned.
 * @param renderFn Returns template like html`...`
 * @param context The context you used when rendering.
 * @param onUpdate Called when update after referenced data changed. if new result can't merge with old, will pass a new fragment as argument.
 */
export function renderComponent(renderFn: () => TemplateResult | DirectiveResult, context?: Context, onUpdate?: () => void): {component: Component, unwatch: () => void} | null

export function renderComponent(codesOrFn: any, context: Context = null, onUpdate?: () => void) {
	let fragment: DocumentFragment
	let unwatch: (() => void) | null = null

	if (typeof codesOrFn === 'function') {
		({fragment, unwatch} = renderAndWatch(codesOrFn, context, onUpdate))
	}
	else {
		fragment = render(codesOrFn, context)
	}

	let firstElement = fragment.firstElementChild as HTMLElement | null
	if (firstElement) {
		let Com = getComponentConstructorByName(firstElement.localName)
		if (Com) {
			let component = createComponent(firstElement, Com)
			if (unwatch) {
				return {component, unwatch}
			}
			else {
				return component
			}
		}
	}

	if (unwatch) {
		unwatch()
	}

	return null
}


/**
 * Append fragment or element into target element or selector. Returns the first element of fragment.
 * It's a helper function to use like `appendTo(render(...), document.body)`.
 * @param fragment The fragment to append.
 * @param target The target element to append to.
 */
export function appendTo(el: DocumentFragment | Element, target: Element | string): Element | null {
	let firstElement = el.firstElementChild as Element

	if (typeof target === 'string') {
		let targetEl = document.querySelector(target)
		if (targetEl && targetEl.lastElementChild !== el) {
			targetEl.append(el)
		}
	}
	else if (target && target.lastElementChild !== el) {
		target.append(el)
	}

	return firstElement
}
