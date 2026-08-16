let readyResolve: (() => void) | null = null;
const readyPromise: Promise<void> = new Promise((resolve) => {
  readyResolve = resolve;
});

let fired = false;

/** Called by the landing preloader once the boot sequence finishes. */
export function signalBootReady(): void {
  if (fired) return;
  fired = true;
  readyResolve?.();
}

/** Resolves once the boot sequence has finished (immediate if already done). */
export function whenBootReady(): Promise<void> {
  return readyPromise;
}
