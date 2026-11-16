// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  isPublicAddress,
  publicProgramUrl,
  readableProgramText,
  readProgramPage,
} from "@/modules/bounty/infrastructure/program-page-reader";

describe("program URL reader", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "2002:7f00:1::1",
  ])("rejects non-public address %s", (address) => expect(isPublicAddress(address)).toBe(false));
  it.each([
    "file:///etc/passwd",
    "http://localhost/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "https://user:password@example.com/",
    "https://example.com:8080/",
  ])("blocks URL %s", (value) => expect(() => publicProgramUrl(value)).toThrow());
  it("allows public IPv4/IPv6 and strips fragments", () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    expect(publicProgramUrl("https://example.com/bounty#scope").href).toBe(
      "https://example.com/bounty",
    );
  });
  it("extracts readable table content and decodes entities without hidden scripts", () => {
    const text = readableProgramText(
      '<h1>Example &amp; Bounty</h1><table><tr><td>*.example.com</td><td>In scope</td></tr></table><script>steal secrets</script><p hidden>secret</p><p aria-hidden="true">hidden</p>',
    );
    expect(text).toContain("Example & Bounty");
    expect(text).toContain("*.example.com");
    expect(text).not.toMatch(/steal|secret|hidden/);
  });
  it("checks every DNS answer and never connects to a mixed public/private host", async () => {
    const read = vi.fn();
    await expect(
      readProgramPage("https://example.com/bounty", {
        resolve: async () => [
          { address: "8.8.8.8", family: 4 },
          { address: "10.0.0.1", family: 4 },
        ],
        read,
      }),
    ).rejects.toMatchObject({ code: "BOUNTY_URL_BLOCKED" });
    expect(read).not.toHaveBeenCalled();
  });
  it("pins a resolved address and blocks a redirect to metadata services", async () => {
    const read = vi.fn().mockResolvedValue({
      status: 302,
      location: "http://169.254.169.254/latest/meta-data/",
      contentType: "text/html",
      body: "",
    });
    await expect(
      readProgramPage("https://example.com/bounty", {
        resolve: async () => [{ address: "8.8.8.8", family: 4 }],
        read,
      }),
    ).rejects.toMatchObject({ code: "BOUNTY_URL_BLOCKED" });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0]?.[1]).toEqual({ address: "8.8.8.8", family: 4 });
  });
  it("stops redirect loops and rejects empty, oversized, and inaccessible pages", async () => {
    for (const response of [
      { status: 302, location: "/again", body: "" },
      { status: 403, body: "private" },
      { status: 200, body: "login" },
      { status: 200, body: "x".repeat(30001) },
    ]) {
      const read = vi.fn().mockResolvedValue({ ...response, contentType: "text/plain" });
      await expect(
        readProgramPage("https://example.com/bounty", {
          resolve: async () => [{ address: "8.8.8.8", family: 4 }],
          read,
        }),
      ).rejects.toThrow();
      expect(read.mock.calls.length).toBeLessThanOrEqual(4);
    }
  });
});
