declare function requestIdleCallback(callback: (deadline: IdleDeadline) => void, options?: IdleOptions): void

declare class IdleDeadline {
	readonly didTimeout: boolean
	timeRemaining(): number
}

declare interface IdleOptions {
	timeout?: boolean
}