/** Part is a class to handle the expression inside slot `${...}`. */
interface Part {

	/** 
	 * Updates part value inside `${...}`.
	 * Doesn't be called automatically when initialization.
	 */
	update(value: unknown): void

	// If element was removed, it implies that the component was removed too.
	// So no need to remove part.
	// remove(): void
}