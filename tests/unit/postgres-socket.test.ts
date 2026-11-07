// @vitest-environment node

import { getDefaultAutoSelectFamilyAttemptTimeout, Socket } from "node:net";
import { describe, expect, it, vi } from "vitest";

import { PostgresSocket } from "@/lib/postgres-socket";

describe("PostgreSQL socket connections", () => {
  it("gives each remote address time to connect without changing the process default", () => {
    const defaultTimeout = getDefaultAutoSelectFamilyAttemptTimeout();
    const connect = vi.spyOn(Socket.prototype, "connect").mockReturnThis();
    const socket = new PostgresSocket();
    const callback = vi.fn();

    expect(socket.connect(5432, "database.example.test", callback)).toBe(socket);
    expect(connect).toHaveBeenCalledWith(
      {
        port: 5432,
        host: "database.example.test",
        autoSelectFamilyAttemptTimeout: Math.max(defaultTimeout, 2_000),
      },
      callback,
    );
    expect(getDefaultAutoSelectFamilyAttemptTimeout()).toBe(defaultTimeout);
  });

  it("preserves explicit TCP options and connection callbacks", () => {
    const connect = vi.spyOn(Socket.prototype, "connect").mockReturnThis();
    const callback = vi.fn();
    const options = {
      port: 5432,
      host: "127.0.0.1",
      autoSelectFamily: false,
      autoSelectFamilyAttemptTimeout: 5_000,
    };

    new PostgresSocket().connect(options, callback);

    expect(connect).toHaveBeenCalledWith(options, callback);
  });

  it("supports local Unix sockets without TCP options", () => {
    const connect = vi.spyOn(Socket.prototype, "connect").mockReturnThis();
    const callback = vi.fn();

    new PostgresSocket().connect("/tmp/.s.PGSQL.5432", callback);

    expect(connect).toHaveBeenCalledWith({ path: "/tmp/.s.PGSQL.5432" }, callback);
  });
});
