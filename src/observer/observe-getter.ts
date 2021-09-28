/**
 * After consider much about getter, we decided to drop supports for observing getters automatically.
 * The main reason is after we observed the `get propertyName` calls in a proxy,
 * We can't know whether this is a getter calls,
 * and we must follow prototype chains to find the descriptor,
 * then we can assert it's a getter or normal property.
 * This will slow the whole observing system.
 *
 * You can still observe a getter manually according to this method:
 * 
 * `o = {get p(){...}}`
 * Uses `observeGetting(o, 'p')` instead of `o.p`.
 * 
 * @param object The source object to get property at.
 * @param key The property key in object.
 * @returns Value of `object[key]`.
 */
export function observeGetting<T>(object: T, key: keyof T) {
	let descriptor = getPropertyDescriptor(object, key)
	if (descriptor && descriptor.get) {
		return descriptor.get.call(object)
	}
	else {
		return object[key]
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