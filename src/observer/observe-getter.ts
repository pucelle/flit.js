/**
 * After think more about getter, we decided to drop supports for observing getters automatically.
 * The main reason is when we observe get callings in proxy, we can't distinguish if it's a normal property
 * or a getter calling immediately, but we must to follow prototype chains to find the getter descriptor,
 * and call the getter function manually by: `descriptor.get.call(objectProxy)`.

 * You can still check getter descriptor and call it with proxied object manually.
 */
export function observeGetter<T extends object>(obj: T, getterProperty: keyof T) {
	let descriptor = getPropertyDescriptor(obj, getterProperty)
	if (descriptor && descriptor.get) {
		return descriptor.get.call(obj)
	}
	else {
		return obj[getterProperty]
	}
}

		
function getPropertyDescriptor<T extends object>(obj: T, property: keyof T) {
	let proto = obj

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