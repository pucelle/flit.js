import {TemplateResult, Template, html} from './parts'
import {Component, Context, getComponentConstructorByName, getComponent} from './component'
import {Watcher} from './watcher'
import {connectElement} from './element'
import {DirectiveResult} from './directives';


/**
 * Render html codes or a template like html`...` in context or null, returns the rendered result as an document fragment.
 * @param codes The html code piece or html`...` template.
 * @param context The context you used when rendering.
 */
export function render(codes: TemplateResult | string | DirectiveResult, context: Context = null): DocumentFragment {
	let fragment: DocumentFragment

	if (codes instanceof DirectiveResult) {
		codes = html`${codes}`
	}

	if (codes instanceof TemplateResult) {
		let template = new Template(codes, context)
		fragment = template.getFragment()
	}
	else {
		let template = document.createElement('template')
		template.innerHTML = clearWhiteSpaces(codes)
		fragment = template.content
	}

	return fragment
}

function clearWhiteSpaces(htmlCodes: string): string {
	return htmlCodes.trim().replace(/>\s+/g, '>')
}


/**
 * Render template like html`...` returned from `renderFn`, returns the rendered result as an document fragment and the watcher.
 * Will watch `renderFn`, If it's dependent datas changed, will automaticaly updated and call `onUpdate` if it was specified.
 * If `context` was specified, The connected state of the watcher that used to watch `renderFn` will synchronize with the `context`.
 * It doesn't connect with returned watcher with context, 
 * @param renderFn Returns template like html`...`
 * @param context The context you used when rendering.
 * @param onUpdate Called when update after referenced data changed. if new result can't merge with old, will pass a new fragment as argument.
 */
export function renderAndWatch(renderFn: () => TemplateResult | DirectiveResult, context: Context = null, onUpdate?: () => void) {
	let {fragment, watcher} = watchRenderFn(renderFn, context, onUpdate)

	if (context) {
		context.__addWatcher(watcher)
	}

	return {
		fragment,
		unwatch: watcher.disconnect.bind(watcher)
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
 * Be careful that it's element is not in document when rendering for the first time.
 * You should append `component.el` to document manually.
 * If `context` was specified, The connected state of the watcher that used to watch `renderFn` will synchronize with the `context`.
 * Caution: The returned template from `renderFn` must can merge with the last returned.
 * @param renderFn Returns template like html`...`
 * @param context The context you used when rendering.
 * @param onUpdate Called when update after referenced data changed. if new result can't merge with old, will pass a new fragment as argument.
 */
export function renderComponent(renderFn: () => TemplateResult | DirectiveResult, context?: Context, onUpdate?: () => void): Component | null

export function renderComponent(codesOrFn: any, context: Context = null, onUpdate?: () => void): Component | null {
	let fragment: DocumentFragment
	let watcher: Watcher | undefined

	if (typeof codesOrFn === 'function') {
		({fragment, watcher} = watchRenderFn(codesOrFn, context, onUpdate))
	}
	else {
		fragment = render(codesOrFn, context)
	}

	let firstElement = fragment.firstElementChild as HTMLElement | null
	if (firstElement) {
		let Com = getComponentConstructorByName(firstElement.localName)
		if (Com) {
			connectElement(firstElement, Com)
			let com = getComponent(firstElement)!

			if (watcher) {
				com.__addWatcher(watcher)
			}

			return com
		}
	}

	if (watcher) {
		watcher.disconnect()
	}

	return null
}

function watchRenderFn(renderFn: () => TemplateResult | DirectiveResult, context: Context, onUpdate?: () => void) {
	let template: Template

	let watcher = new Watcher(renderFn, (result) => {
		if (result instanceof DirectiveResult) {
			result = html`${result}`
		}

		template.merge(result)

		if (onUpdate) {
			onUpdate()
		}
	})

	let result = watcher.value
	if (result instanceof DirectiveResult) {
		result = html`${result}`
	}

	template = new Template(result, context)

	return {
		fragment: template.getFragment(),
		watcher
	}
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
		if (targetEl) {
			targetEl.append(el)
		}
	}
	else if (target) {
		target.append(el)
	}

	return firstElement
}
