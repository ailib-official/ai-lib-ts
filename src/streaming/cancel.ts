/**
 * Cancel handle for streaming operations.
 * Aligned with Python CancellableStream.
 */

/**
 * Handle to cancel an in-progress stream
 */
export class CancelHandle {
  private readonly controller = new AbortController();
  private _cancelled = false;

  /** AbortSignal to pass to fetch or other cancellable operations */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /** Whether cancel() has been called */
  get cancelled(): boolean {
    return this._cancelled;
  }

  /** Cancel the operation */
  cancel(): void {
    if (!this._cancelled) {
      this._cancelled = true;
      this.controller.abort();
    }
  }
}
