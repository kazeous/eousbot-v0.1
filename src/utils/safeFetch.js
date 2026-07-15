import dns from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function ipv4IsPrivate(address) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(Number.isNaN)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19));
}

function ipv6IsPrivate(address) {
  const normalized = address.toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return ipv4IsPrivate(mappedIpv4[1]);
  return normalized === "::" || normalized === "::1" ||
    normalized.startsWith("fc") || normalized.startsWith("fd") ||
    normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
    normalized.startsWith("fea") || normalized.startsWith("feb") ||
    normalized.startsWith("ff") || normalized.startsWith("2001:db8:") ||
    normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.") ||
    normalized.startsWith("::ffff:172.16.");
}

function isPrivateAddress(address) {
  return net.isIP(address) === 4 ? ipv4IsPrivate(address) : ipv6IsPrivate(address);
}

async function validatePublicUrl(input) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Only credential-free HTTP(S) feed URLs are allowed.");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".internal") || hostname.endsWith(".local")) {
    throw new Error("Private and local feed hosts are not allowed.");
  }
  if (net.isIP(hostname) && isPrivateAddress(hostname)) {
    throw new Error("Private feed IP addresses are not allowed.");
  }
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Feed host resolves to a private or reserved address.");
  }
  return url;
}

export async function fetchPublicText(input, { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = MAX_RESPONSE_BYTES } = {}) {
  let url = await validatePublicUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/plain" }
    });
    if (response.status >= 300 && response.status < 400) {
      if (redirect === MAX_REDIRECTS) throw new Error("Too many feed redirects.");
      const location = response.headers.get("location");
      if (!location) throw new Error("Feed redirect did not include a location.");
      url = await validatePublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Feed endpoint returned ${response.status}.`);
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error("Feed response is too large.");
    }
    if (!response.body) return "";
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) throw new Error("Feed response is too large.");
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
  }
  throw new Error("Feed redirect validation failed.");
}
