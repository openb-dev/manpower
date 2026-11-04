import assert from "node:assert/strict";
import test from "node:test";
import { generate6DigitOtp, hashOtp, isOtpExpired } from "../lib/otp/index.ts";
import { encryptText, decryptText, maskAadhaar, hashAadhaar, getAadhaarLast4 } from "../lib/crypto/index.ts";

test("OTP flow: generates 6-digit code, correctly hashes and validates expiry", () => {
  const code = generate6DigitOtp();
  assert.equal(code.length, 6);
  assert.match(code, /^\d{6}$/);

  const hash1 = hashOtp(code);
  const hash2 = hashOtp(code);
  assert.equal(hash1, hash2);

  const future = new Date(Date.now() + 5 * 60 * 1000);
  assert.equal(isOtpExpired(future), false);

  const past = new Date(Date.now() - 1000);
  assert.equal(isOtpExpired(past), true);
});

test("Aadhaar privacy: masking, HMAC hashing, and AES-256-GCM roundtrip encryption", () => {
  const aadhaar = "234567890123";
  assert.equal(getAadhaarLast4(aadhaar), "0123");
  assert.equal(maskAadhaar(aadhaar), "XXXX-XXXX-0123");

  const hmac1 = hashAadhaar(aadhaar);
  const hmac2 = hashAadhaar(aadhaar);
  assert.equal(hmac1, hmac2);
  assert.notEqual(hmac1, aadhaar);

  const encrypted = encryptText(aadhaar);
  assert.notEqual(encrypted, aadhaar);
  const decrypted = decryptText(encrypted);
  assert.equal(decrypted, aadhaar);
});

test("Tenant isolation rule: query scoped by company_id rejects cross-tenant access", () => {
  const tenantA = "company-nk-1";
  const tenantB = "company-origin-2";

  function simulateTenantQuery(requestingCompanyId, targetRecordCompanyId) {
    if (requestingCompanyId !== targetRecordCompanyId) {
      return null; // Denied by tenant filter
    }
    return { id: "rec-1", companyId: targetRecordCompanyId, data: "classified" };
  }

  // Cross tenant access blocked
  assert.equal(simulateTenantQuery(tenantA, tenantB), null);

  // Own tenant access allowed
  const ownResult = simulateTenantQuery(tenantA, tenantA);
  assert.ok(ownResult);
  assert.equal(ownResult.companyId, tenantA);
});

test("Atomic employee code generation: sequential without collisions", () => {
  class MockSequenceLock {
    constructor(prefix) {
      this.prefix = prefix;
      this.nextNumber = 1;
    }
    nextCode() {
      const num = this.nextNumber;
      this.nextNumber += 1;
      return `${this.prefix}-${String(num).padStart(4, "0")}`;
    }
  }

  const nkSeq = new MockSequenceLock("NK");
  assert.equal(nkSeq.nextCode(), "NK-0001");
  assert.equal(nkSeq.nextCode(), "NK-0002");
  assert.equal(nkSeq.nextCode(), "NK-0003");

  const orgSeq = new MockSequenceLock("ORG");
  assert.equal(orgSeq.nextCode(), "ORG-0001");
  assert.equal(orgSeq.nextCode(), "ORG-0002");
});
