import { test } from "node:test";
import assert from "node:assert/strict";
import { vitalMaxLength, validateVitalAnswer } from "./vitalValidation.mjs";

const spec = (inputType, extra = {}) => ({ inputType, required: true, ...extra });

test("TEXT is capped without a configured regex", () => {
  assert.equal(vitalMaxLength(spec("text")), 255);
  assert.equal(validateVitalAnswer(spec("text"), "a".repeat(256)), "Maximum 255 characters");
  assert.equal(validateVitalAnswer(spec("text"), "a".repeat(255)), null);
});

test("typed fields receive their default maximum lengths", () => {
  const limits = { name: 100, address: 255, phone: 20, whatsapp_number: 20, email: 254, nic: 12 };
  for (const [type, limit] of Object.entries(limits)) {
    assert.equal(vitalMaxLength(spec(type)), limit);
    assert.equal(validateVitalAnswer(spec(type), "a".repeat(limit + 1)), `Maximum ${limit} characters`);
  }
});

test("required, optional, and configured regex", () => {
  assert.equal(validateVitalAnswer(spec("name"), "  "), "Required");
  assert.equal(validateVitalAnswer(spec("name", { required: false }), "  "), "Please enter a value or choose Skip");
  assert.equal(validateVitalAnswer(spec("name", { validationRegex: "^[A-Z]+$", validationMessage: "Capital letters only" }), "Alice"), "Capital letters only");
  assert.equal(validateVitalAnswer(spec("name"), "ආයුබෝවන්"), null);
  assert.equal(validateVitalAnswer(spec("address"), "First line\nSecond line"), null);
  assert.equal(validateVitalAnswer(spec("name"), "A\nB"), "Control characters are not allowed");
});

test("date, phone, email, and Sri Lankan NIC formats", () => {
  assert.equal(validateVitalAnswer(spec("date"), "29/02/2024"), null);
  assert.notEqual(validateVitalAnswer(spec("date"), "29/02/2025"), null);
  assert.equal(validateVitalAnswer(spec("phone"), "077 123 4567"), null);
  assert.equal(validateVitalAnswer(spec("whatsapp_number"), "+94 (77) 123-4567"), null);
  assert.notEqual(validateVitalAnswer(spec("phone"), "+94abc7777777"), null);
  assert.equal(validateVitalAnswer(spec("email"), "a@example.com"), null);
  assert.notEqual(validateVitalAnswer(spec("email"), "not-an-email"), null);
  assert.equal(validateVitalAnswer(spec("nic"), "123456789v"), null);
  assert.equal(validateVitalAnswer(spec("nic"), "200012345678"), null);
  assert.notEqual(validateVitalAnswer(spec("nic"), "12345678V"), null);
});
