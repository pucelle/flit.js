declare function requestIdleCallback(callback: (deadline: IdleDeadline) => void, options?: IdleOptions): void

declare interface IdleOptions {
	timeout?: boolean
}