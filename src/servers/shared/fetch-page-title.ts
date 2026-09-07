import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { ClientRequest, IncomingHttpHeaders, IncomingMessage } from "node:http";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";

const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8_000;

type SafeAddress = { address: string; family: 4 | 6 };
type SafeUrl = { url: URL; addresses: SafeAddress[] };
type PageResponse = {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
};

function isPrivateIpv4(ip: string) {
  const octets = ip.split(".").map(Number);
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] === 0
  );
}

function isPrivateIp(ip: string) {
  if (isIP(ip) === 4) return isPrivateIpv4(ip);
  const normalized = ip.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isPrivateIp(normalized.slice(7));
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

async function assertSafeUrl(input: string): Promise<SafeUrl> {
  const url = new URL(input);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port === "0") {
    throw new Error("URL ต้องเป็น HTTP หรือ HTTPS ที่ปลอดภัย");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const ipFamily = isIP(hostname);
  if (ipFamily === 4 || ipFamily === 6) {
    if (isPrivateIp(hostname)) throw new Error("ไม่อนุญาตให้เรียก URL ภายในเครือข่าย");
    return { url, addresses: [{ address: hostname, family: ipFamily }] };
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) {
    throw new Error("ไม่อนุญาตให้เรียก URL ภายในเครือข่าย");
  }
  const addresses = records
    .filter((record) => record.family === 4 || record.family === 6)
    .map((record) => ({
      address: record.address,
      family: record.family as 4 | 6,
    }));
  if (addresses.length === 0) {
    throw new Error("ไม่สามารถตรวจสอบที่อยู่ของ URL ได้");
  }
  return { url, addresses };
}

function getHeader(headers: IncomingHttpHeaders, name: string) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function createPinnedLookup(addresses: SafeAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    const address = addresses[0];
    if (!address) {
      callback(new Error("ไม่สามารถตรวจสอบที่อยู่ของ URL ได้"), "", 0);
      return;
    }
    if (options.all) {
      callback(null, addresses);
      return;
    }
    callback(null, address.address, address.family);
  };
}

function requestPage(input: SafeUrl): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let clientRequest: ClientRequest | undefined;
    let response: IncomingMessage | undefined;
    const timeout = setTimeout(() => {
      fail(new Error("หมดเวลาการเรียกหน้าเว็บ"));
    }, TIMEOUT_MS);

    const finish = () => {
      clearTimeout(timeout);
      settled = true;
    };
    const fail = (error: unknown) => {
      if (settled) return;
      finish();
      clientRequest?.destroy();
      response?.destroy();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const handleResponse = (nextResponse: IncomingMessage) => {
      response = nextResponse;
      nextResponse.on("error", fail);
      const contentLength = Number(getHeader(nextResponse.headers, "content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
        fail(new Error("หน้าเว็บมีขนาดใหญ่เกินไป"));
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      nextResponse.on("data", (chunk: Buffer | string) => {
        if (settled) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.byteLength;
        if (total > MAX_BYTES) {
          fail(new Error("หน้าเว็บมีขนาดใหญ่เกินไป"));
          return;
        }
        chunks.push(buffer);
      });
      nextResponse.on("end", () => {
        if (settled) return;
        finish();
        resolve({
          status: nextResponse.statusCode ?? 0,
          headers: nextResponse.headers,
          body: Buffer.concat(chunks),
        });
      });
    };

    try {
      const options = {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-encoding": "identity",
        },
        lookup: createPinnedLookup(input.addresses),
      };
      clientRequest =
        input.url.protocol === "https:"
          ? httpsRequest(input.url, options, handleResponse)
          : httpRequest(input.url, options, handleResponse);
      clientRequest.on("error", fail);
      clientRequest.end();
    } catch (error) {
      fail(error);
    }
  });
}

export async function fetchPageTitle(input: string) {
  let target = await assertSafeUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await requestPage(target);
    if (response.status >= 300 && response.status < 400) {
      const location = getHeader(response.headers, "location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("ไม่สามารถติดตามการเปลี่ยนเส้นทางได้");
      target = await assertSafeUrl(new URL(location, target.url).toString());
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new Error("เว็บต้นทางตอบกลับไม่สำเร็จ");
    const contentType = getHeader(response.headers, "content-type");
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error("URL นี้ไม่ใช่หน้าเว็บ HTML");
    const html = new TextDecoder().decode(response.body);
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = match?.[1]?.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
    if (!title) throw new Error("ไม่พบชื่อหน้าเว็บ");
    return title.slice(0, 300);
  }
  throw new Error("ไม่สามารถอ่านชื่อหน้าเว็บได้");
}
