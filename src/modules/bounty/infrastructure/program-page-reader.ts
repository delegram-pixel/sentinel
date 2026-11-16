import "server-only";

import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { z } from "zod";
import { MAX_BOUNTY_TEXT } from "../domain/bounty-import";
import { ResearchOperationError } from "@/modules/shared/domain/result";

const MAX_BYTES = 1024 * 1024;
const BLOCKED_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const n = address.split(".").reduce((v, p) => (v * 256 + Number(p)) >>> 0, 0);
    return !BLOCKED_V4.some((cidr) => {
      const [base, bits] = cidr.split("/");
      const b = base!.split(".").reduce((v, p) => (v * 256 + Number(p)) >>> 0, 0);
      const mask = (0xffffffff << (32 - Number(bits))) >>> 0;
      return (n & mask) >>> 0 === (b & mask) >>> 0;
    });
  }
  // Only ordinary global unicast IPv6. Reject mapped IPv4, NAT64, tunnels,
  // loopback, link-local, unique-local, multicast and documentation ranges.
  return (
    z.ipv6().safeParse(address).success &&
    /^[23][0-9a-f]{3}:/i.test(address) &&
    !/^2001:(?:0*:|db8:|[12][0-9a-f]:)/i.test(address) &&
    !/^2002:/i.test(address)
  );
}

export function publicProgramUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw blocked();
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port)) ||
    host === "localhost" ||
    (!host.includes(".") && !isIP(host)) ||
    (isIP(host) && !isPublicAddress(host))
  )
    throw blocked();
  url.hash = "";
  return url;
}
function blocked() {
  return new ResearchOperationError("BOUNTY_URL_BLOCKED", "Only public program pages can be read.");
}
function unavailable() {
  return new ResearchOperationError(
    "BOUNTY_PAGE_UNAVAILABLE",
    "Paste the program policy and scope instead.",
  );
}

export function readableProgramText(html: string): string {
  const chunks: string[] = [];
  function visit(node: DefaultTreeAdapterTypes.Node) {
    if (
      "tagName" in node &&
      (["script", "style", "noscript", "template", "svg"].includes(node.tagName) ||
        node.attrs.some(
          (attr) =>
            attr.name === "hidden" || (attr.name === "aria-hidden" && attr.value === "true"),
        ))
    )
      return;
    if (node.nodeName === "#text" && "value" in node) chunks.push(node.value);
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
    if (
      "tagName" in node &&
      ["p", "div", "li", "tr", "td", "th", "h1", "h2", "h3", "br"].includes(node.tagName)
    )
      chunks.push("\n");
  }
  visit(parse(html));
  return chunks
    .join(" ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type PageResponse = { status: number; location?: string; contentType: string; body: string };
export type PageReaderDependencies = {
  resolve(host: string): Promise<Array<{ address: string; family: number }>>;
  read(
    url: URL,
    address: { address: string; family: number },
    signal: AbortSignal,
  ): Promise<PageResponse>;
};

function readPinned(
  url: URL,
  address: { address: string; family: number },
  signal: AbortSignal,
): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        signal,
        agent: false,
        // Pin the validated address; preserve the hostname for Host and TLS.
        lookup: (_host, _options, callback) => callback(null, address.address, address.family),
        headers: {
          Accept: "text/html, text/plain;q=0.9",
          "Accept-Encoding": "identity",
          "User-Agent": "Sentinel-Program-Import/1.0",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        const contentType = res.headers["content-type"] ?? "";
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, location, contentType, body: "" });
          return;
        }
        if (
          status !== 200 ||
          !/^(text\/html|text\/plain|application\/xhtml\+xml)(;|$)/i.test(contentType) ||
          Number(res.headers["content-length"] ?? 0) > MAX_BYTES ||
          (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")
        ) {
          res.resume();
          reject(unavailable());
          return;
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) {
            req.destroy();
            reject(unavailable());
          } else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({ status, location, contentType, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

export async function readProgramPage(
  value: string,
  deps: PageReaderDependencies = {
    resolve: (host) => lookup(host, { all: true }),
    read: readPinned,
  },
): Promise<{ url: string; text: string }> {
  const signal = AbortSignal.timeout(15_000);
  let url = publicProgramUrl(value);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const host = url.hostname.replace(/^\[|\]$/g, "");
      const addresses = isIP(host)
        ? [{ address: host, family: isIP(host) }]
        : await deps.resolve(host);
      if (!addresses.length || addresses.some((address) => !isPublicAddress(address.address)))
        throw blocked();
      signal.throwIfAborted();
      const page = await deps.read(url, addresses[0]!, signal);
      if (page.status >= 300 && page.status < 400 && page.location) {
        url = publicProgramUrl(new URL(page.location, url).href);
        continue;
      }
      if (page.status !== 200) throw unavailable();
      const text = /text\/plain/i.test(page.contentType)
        ? page.body.trim()
        : readableProgramText(page.body);
      if (text.length < 80) throw unavailable();
      if (text.length > MAX_BOUNTY_TEXT)
        throw new ResearchOperationError(
          "AI_CONTEXT_TOO_LARGE",
          "The program page is too long. Paste its policy and scope instead.",
        );
      return { url: url.href, text };
    }
    throw unavailable();
  } catch (error) {
    if (error instanceof ResearchOperationError) throw error;
    throw unavailable();
  }
}
