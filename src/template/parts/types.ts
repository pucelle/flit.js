/** Part is a class to handle the expression inside slot `${...}`. */
export interface Part {

	/** 
	 * Updates part value inside `${...}`.
	 * Doesn't be called automatically when initialization, so you may call it from constructor function manually.
	 */
	update(value: unknown): void
}