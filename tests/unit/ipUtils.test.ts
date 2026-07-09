import { describe, it, expect } from "vitest";
import { getClientIp } from "../../util/ipUtils.js";
import type { Request } from "express";

function mockRequest(headers: Record<string, string | string[] | undefined>, remoteAddress?: string): Request {
  return {
    headers,
    socket: { remoteAddress } as any,
  } as Request;
}

describe("getClientIp", () => {
  it("should return the first IP from x-forwarded-for string header", () => {
    const req = mockRequest({ "x-forwarded-for": "192.168.1.1, 10.0.0.1" });
    expect(getClientIp(req)).toBe("192.168.1.1");
  });

  it("should return the first IP from x-forwarded-for array header", () => {
    const req = mockRequest({ "x-forwarded-for": ["203.0.113.5", "198.51.100.2"] });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("should return IP from x-real-ip when x-forwarded-for is absent", () => {
    const req = mockRequest({ "x-real-ip": "10.0.0.5" });
    expect(getClientIp(req)).toBe("10.0.0.5");
  });

  it("should return socket.remoteAddress when no forward headers exist", () => {
    const req = mockRequest({}, "172.16.0.1");
    expect(getClientIp(req)).toBe("172.16.0.1");
  });

  it("should return 'unknown' when no IP information is available", () => {
    const req = mockRequest({});
    expect(getClientIp(req)).toBe("unknown");
  });

  it("should prefer x-forwarded-for over x-real-ip and remoteAddress", () => {
    const req = mockRequest({
      "x-forwarded-for": "192.168.1.100",
      "x-real-ip": "10.0.0.99",
    }, "172.16.0.99");
    expect(getClientIp(req)).toBe("192.168.1.100");
  });

  it("should trim whitespace from forwarded IP", () => {
    const req = mockRequest({ "x-forwarded-for": "  192.168.1.1  " });
    expect(getClientIp(req)).toBe("192.168.1.1");
  });
});