type WorkerLoopOptions = {
  processNext: () => Promise<boolean>;
  shouldStop: () => boolean;
  once?: boolean;
  onError?: (error: unknown) => void;
  wait?: (milliseconds: number) => Promise<void>;
};

export async function runWorkerLoop(options: WorkerLoopOptions): Promise<void> {
  const wait =
    options.wait ??
    ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let failures = 0;

  while (!options.shouldStop()) {
    let processed = false;
    try {
      processed = await options.processNext();
      failures = 0;
    } catch (error) {
      failures += 1;
      options.onError?.(error);
      if (options.once) throw error;
    }

    if (options.once || options.shouldStop()) return;
    if (!processed) {
      await wait(failures ? Math.min(5000, 1000 * 2 ** Math.min(failures - 1, 3)) : 1000);
    }
  }
}
