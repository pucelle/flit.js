export class ResultReferences<R extends object, B extends object> {

	/** Caches reference binding callback. */
	private referenceMap: WeakMap<R, (binding: B) => void> = new WeakMap()

	/** Caches un-reference callback. */
	private unReferenceMap: WeakMap<R, (binding: B) => void> = new WeakMap()

	/** Caches un-reference callback. */
	private bindingUnReferenceMap: WeakMap<B, (binding: B) => void> = new WeakMap()

	/** Add a reference which will be called after instance created. */
	addReference(result: R, ref: (binding: B) => void) {
		this.referenceMap.set(result, ref)
	}

	/** Add a reference which will be called after instance removed. */
	addUnReference(result: R, unRef: (binding: B) => void) {
		this.unReferenceMap.set(result, unRef)
	}

	/** Create a reference after instance created. */
	createReference(result: R, binding: B) {
		if (this.referenceMap.has(result)) {
			this.referenceMap.get(result)!(binding)
		}

		if (this.unReferenceMap.has(result)) {
			let unRef = this.unReferenceMap.get(result)!
			this.bindingUnReferenceMap.set(binding, unRef)
		}
	}

	/** Calls after instance removed. */
	removeReference(binding: B) {
		if (this.bindingUnReferenceMap.has(binding)) {
			this.bindingUnReferenceMap.get(binding)!(binding)
		}
	}
}

