import { describe, expect, it } from "vitest";
import { buildStringToSign, computeSign, verifySign } from "../supabase/functions/_shared/sign";

const TOKEN = "test_token_123";
// Known-answer vector. Expected MD5 was computed independently:
//   md5("amount=500.00&currency=INR&gatewayOrderNo=GW20240101000001&isPaid=true&merchantOrderNo=PD-TEST-0001&payinState=2&utr=412345678901&key=test_token_123")
const KNOWN_SIGN = "83c49ee8f9f4dcb801a81e47d0c366cb";
const payload = {
  merchantOrderNo: "PD-TEST-0001",
  gatewayOrderNo: "GW20240101000001",
  amount: "500.00",
  currency: "INR",
  payinState: 2,
  isPaid: true,
  utr: "412345678901",
};

describe("SilkPay signature", () => {
  it("builds the sorted string-to-sign without the key", () => {
    expect(buildStringToSign(payload)).toBe(
      "amount=500.00&currency=INR&gatewayOrderNo=GW20240101000001&isPaid=true&merchantOrderNo=PD-TEST-0001&payinState=2&utr=412345678901",
    );
  });

  it("matches the known MD5 vector", () => {
    expect(computeSign(payload, TOKEN)).toBe(KNOWN_SIGN);
  });

  it("ignores sign, null, undefined and empty-string values", () => {
    const noisy = { ...payload, sign: "whatever", remark: "", extra: null, other: undefined };
    expect(computeSign(noisy, TOKEN)).toBe(KNOWN_SIGN);
  });

  it("does not depend on key order", () => {
    const reversed = Object.fromEntries(Object.entries(payload).reverse());
    expect(computeSign(reversed, TOKEN)).toBe(KNOWN_SIGN);
  });

  it("verifies case-insensitively", () => {
    expect(verifySign({ ...payload, sign: KNOWN_SIGN.toUpperCase() }, TOKEN).valid).toBe(true);
    expect(verifySign({ ...payload, sign: KNOWN_SIGN }, TOKEN).valid).toBe(true);
  });

  it("rejects a tampered payload, wrong key and missing sign", () => {
    expect(verifySign({ ...payload, amount: "1.00", sign: KNOWN_SIGN }, TOKEN).valid).toBe(false);
    expect(verifySign({ ...payload, sign: KNOWN_SIGN }, "other_token").valid).toBe(false);
    expect(verifySign(payload, TOKEN).valid).toBe(false);
  });
});
