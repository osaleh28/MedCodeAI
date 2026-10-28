import test from "node:test";
import assert from "node:assert/strict";
import { hash, compare } from "bcryptjs";
import { loginSchema, registrationSchema, passwordSchema } from "../src/lib/validation";

test("emails are normalized before persistence and login", () => {
  const result = loginSchema.parse({ email: "  Person@Example.com ", password: "a-long-password" });
  assert.equal(result.email, "person@example.com");
});

test("invalid credentials are rejected", () => {
  for (const value of [{ email: "invalid", password: "a-long-password" }, { email: "a@b.com", password: "short" }, {}]) {
    assert.equal(loginSchema.safeParse(value).success, false);
  }
});

test("registration requires explicit documentation privacy acknowledgement", () => {
  const input = { name: "Alex", email: "a@b.com", password: "a-long-password", confirmPassword: "a-long-password" };
  assert.equal(registrationSchema.safeParse(input).success, false);
  assert.equal(registrationSchema.safeParse({ ...input, syntheticOnly: "on" }).success, true);
});

test("registration rejects missing or mismatched password confirmation", () => {
  const input = { name: "Alex", email: "a@b.com", password: "a-long-password", syntheticOnly: "on" };
  assert.equal(registrationSchema.safeParse(input).success, false);
  assert.equal(registrationSchema.safeParse({ ...input, confirmPassword: "" }).success, false);
  const mismatch = registrationSchema.safeParse({ ...input, confirmPassword: "another-password" });
  assert.equal(mismatch.success, false);
  if (!mismatch.success) assert.deepEqual(mismatch.error.issues[0].path, ["confirmPassword"]);
  assert.equal(registrationSchema.safeParse({ ...input, confirmPassword: input.password }).success, true);
});

test("bcrypt byte limit prevents silent password truncation", () => {
  assert.equal(passwordSchema.safeParse("a".repeat(72)).success, true);
  assert.equal(passwordSchema.safeParse("a".repeat(73)).success, false);
  assert.equal(passwordSchema.safeParse("é".repeat(37)).success, false);
});

test("stored password hashes verify the password and reject a different one", async () => {
  const password = "a-long-test-password";
  const passwordHash = await hash(password, 12);
  assert.notEqual(passwordHash, password);
  assert.equal(await compare(password, passwordHash), true);
  assert.equal(await compare("wrong-password", passwordHash), false);
});
