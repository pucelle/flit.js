/**
 * After consider much about getter, we decided to drop supports for observing getters automatically.
 * The main reason is after we observed getter calls in a proxy,
 * We can't determine this is a getter calls,
 * and we must follow prototype chains to find the descriptor,
 * then we can know it's a getter or normal property.
 * This will slow the whole observing system.
 *
 * You can still observe a getter manually according to this method:
 * 
 * `o = {get p(){...}}`
 * Uses `observeGetting(o, 'p')` instead of `o.p`.
 */
export function observeGetting<T>(object: T, getterProperty: keyof T) {
	let descriptor = getPropertyDescriptor(object, getterProperty)
	if (descriptor && descriptor.get) {
		return descriptor.get.call(object)
	}
	else {
		return object[getterProperty]
	}
}

		
function getPropertyDescriptor<T>(object: T, property: keyof T) {
	let proto = object

	do {
		let descriptor = Object.getOwnPropertyDescriptor(proto, property)
		if (descriptor) {
			return descriptor
		}
		else {
			proto = Object.getPrototypeOf(proto)
		}
	}
	while (proto)

	return null
}