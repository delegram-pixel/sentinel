import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no layout-driven resize notifications. Radix still needs the
// observer lifecycle when rendering tooltip arrows and positioning content.
if (typeof window !== "undefined" && typeof globalThis.ResizeObserver === "undefined") {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
}

afterEach(() => {
  cleanup();
});
