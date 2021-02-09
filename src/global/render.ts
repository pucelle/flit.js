import {TemplateResult, Template, html} from '../template'
import {Component, Context, createComponent} from '../component'
import {DirectiveResult} from '../directives'
import {GlobalWatcherGroup} from './watcher'


/**
 * Render html codes or a template result like html`...` within a `context`.
 * Returns the rendered template, you may append it to another element,
 * or extract to a fragment and insert into any place.
 * Otherwise you can also patch it with another template result.
 * 
 * @param codes The html code piece or html`...` template result, or a directive result.
 * @param context The context to use when rendering.
 */
export function render(codes: TemplateResult | DirectiveResult, context: Context = null): Template {
	if (codes instanceof DirectiveResult) {
		codes = html`${codes}`
	}

	let template = new Template(codes, context)

	return template
}


/**
 * Render template result like html`...` that returned from `renderFn`.
 * Returns the rendered template, you may append it to another element,
 * or extract to a fragment and insert into any place.
 * Otherwise returns a `unwatch` function, call which will stop watching `renderFn`.
 * 
 * Will watch `renderFn`, If it's dependent datas changed, will automaticaly updated and call `onUpdate`.
 * 
 * @param renderFn Returns template like html`...`
 * @param context The context you used when rendering.
 * @param onUpdate Called when update after referenced data changed. if new result can't merge with old, will pass a new fragment as parameter.
 */
export function renderUpdatable(renderFn: () => TemplateResult | DirectiveResult, context: Context = null, onUpdate?: () => void): {template: Template, unwatch: () => void} {
	let template: Template

	let unwatch = (context || GlobalWatcherGroup).watchImmediately(renderFn, (result: TemplateResult | DirectiveResult) => {
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
		template: template!,
		unwatch,
	}
}


/**
 * Get a component immediately from a just rendered template.
 * @param template The just rendered template from `render` or `renderUpdatable`.
 */
export function getRenderedAsComponent(template: Template): Component | null {
	let firstElement = template.getFirstElement()
	if (firstElement && firstElement.localName.includes('-')) {
		return createComponent(firstElement as HTMLElement)
	}

	return null
}
