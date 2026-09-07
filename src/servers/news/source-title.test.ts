import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.hoisted(() => vi.fn());
const httpRequest = vi.hoisted(() => vi.fn());
const httpsRequest = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup }));
vi.mock("node:http", () => ({ request: httpRequest }));
vi.mock("node:https", () => ({ request: httpsRequest }));

import { fetchPageTitle } from "./source-title";

type MockResponse = EventEmitter & {
  statusCode: number;
  headers: Record<string, string>;
};

type MockClient = EventEmitter & {
  end: () => void;
  destroy: () => void;
};

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | { address: string; family: number }[],
  family?: number,
) => void;

type RequestOptions = {
  lookup?: (
    hostname: string,
    options: { all?: boolean },
    callback: LookupCallback,
  ) => void;
};

function mockHttpsPage(input: {
  body: string;
  status?: number;
  headers?: Record<string, string>;
}) {
  const response = new EventEmitter() as MockResponse;
  response.statusCode = input.status ?? 200;
  response.headers = {
    "content-type": "text/html",
    ...(input.headers ?? {}),
  };
  httpsRequest.mockImplementationOnce((_url, options, callback) => {
    const client = new EventEmitter() as MockClient;
    client.end = () => {
      queueMicrotask(() => {
        callback(response);
        response.emit("data", Buffer.from(input.body));
        response.emit("end");
      });
    };
    client.destroy = () => undefined;
    return client;
  });
}

describe("fetchPageTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("reads a title from an HTML page", async () => {
    mockHttpsPage({ body: "<html><title> Example &amp; News </title></html>" });
    await expect(fetchPageTitle("https://example.com/news")).resolves.toBe("Example & News");
  });

  it("rejects private destinations", async () => {
    await expect(fetchPageTitle("http://127.0.0.1:3000")).rejects.toThrow("ภายในเครือข่าย");
  });

  it("rejects non-HTML pages and pages without a title", async () => {
    mockHttpsPage({
      body: "{}",
      headers: { "content-type": "application/json" },
    });
    await expect(fetchPageTitle("https://example.com/data")).rejects.toThrow("ไม่ใช่หน้าเว็บ HTML");
    mockHttpsPage({ body: "<html><body>ไม่มี title</body></html>" });
    await expect(fetchPageTitle("https://example.com/no-title")).rejects.toThrow("ไม่พบชื่อหน้าเว็บ");
  });

  it("uses the address validated by DNS for the request", async () => {
    mockHttpsPage({ body: "<title>Example</title>" });

    await expect(fetchPageTitle("https://example.com/news")).resolves.toBe(
      "Example",
    );

    const options = httpsRequest.mock.calls[0]?.[1] as RequestOptions;
    const callback = vi.fn();
    options.lookup?.("example.com", { all: false }, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});
