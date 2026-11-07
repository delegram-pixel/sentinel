import "server-only";

import { getDefaultAutoSelectFamilyAttemptTimeout, Socket, type SocketConnectOpts } from "node:net";

/** Give remote database addresses time to connect on higher-latency networks. */
export class PostgresSocket extends Socket {
  override connect(options: SocketConnectOpts, callback?: () => void): this;
  override connect(port: number, host: string, callback?: () => void): this;
  override connect(port: number, callback?: () => void): this;
  override connect(path: string, callback?: () => void): this;
  override connect(
    address: SocketConnectOpts | number | string,
    hostOrCallback?: string | (() => void),
    callback?: () => void,
  ): this {
    const listener = typeof hostOrCallback === "function" ? hostOrCallback : callback;
    const options: SocketConnectOpts =
      typeof address === "number"
        ? { port: address, ...(typeof hostOrCallback === "string" ? { host: hostOrCallback } : {}) }
        : typeof address === "string"
          ? { path: address }
          : address;

    if (!("port" in options)) {
      return super.connect(options, listener);
    }

    return super.connect(
      {
        ...options,
        // Node's 250 ms default can exhaust Neon's addresses before a TCP
        // handshake completes. Keep address fallback and any longer default.
        autoSelectFamilyAttemptTimeout:
          options.autoSelectFamilyAttemptTimeout ??
          Math.max(getDefaultAutoSelectFamilyAttemptTimeout(), 2_000),
      },
      listener,
    );
  }
}
