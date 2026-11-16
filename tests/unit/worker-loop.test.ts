// @vitest-environment node
import { expect, it, vi } from "vitest";
import { runWorkerLoop } from "@/modules/tasks/application/worker-loop";

it("recovers from a failed database poll and processes the next job", async () => {
  let stopping = false;
  const failure = Object.assign(new Error("Temporary transaction failure"), { code: "P2028" });
  const processNext = vi
    .fn<() => Promise<boolean>>()
    .mockRejectedValueOnce(failure)
    .mockImplementationOnce(async () => {
      stopping = true;
      return true;
    });
  const wait = vi.fn(async () => {});
  const onError = vi.fn();

  await runWorkerLoop({ processNext, shouldStop: () => stopping, wait, onError });

  expect(processNext).toHaveBeenCalledTimes(2);
  expect(onError).toHaveBeenCalledWith(failure);
  expect(wait).toHaveBeenCalledOnce();
});

it("continues polling an empty queue until work becomes available", async () => {
  let stopping = false;
  const processNext = vi
    .fn<() => Promise<boolean>>()
    .mockResolvedValueOnce(false)
    .mockImplementationOnce(async () => {
      stopping = true;
      return true;
    });
  const wait = vi.fn(async () => {});

  await runWorkerLoop({ processNext, shouldStop: () => stopping, wait });

  expect(processNext).toHaveBeenCalledTimes(2);
  expect(wait).toHaveBeenCalledOnce();
});

it("processes only one job when invoked with once", async () => {
  const processNext = vi.fn(async () => true);
  const wait = vi.fn(async () => {});

  await runWorkerLoop({ processNext, shouldStop: () => false, once: true, wait });

  expect(processNext).toHaveBeenCalledOnce();
  expect(wait).not.toHaveBeenCalled();
});

it("reports a failed single-run invocation without retrying", async () => {
  const failure = new Error("Temporary transaction failure");
  const processNext = vi.fn<() => Promise<boolean>>().mockRejectedValue(failure);
  const wait = vi.fn(async () => {});

  await expect(
    runWorkerLoop({ processNext, shouldStop: () => false, once: true, wait }),
  ).rejects.toBe(failure);

  expect(processNext).toHaveBeenCalledOnce();
  expect(wait).not.toHaveBeenCalled();
});

it("does not claim work after shutdown has been requested", async () => {
  const processNext = vi.fn(async () => true);

  await runWorkerLoop({ processNext, shouldStop: () => true });

  expect(processNext).not.toHaveBeenCalled();
});
