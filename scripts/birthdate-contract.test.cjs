require("./register-ts.cjs");

const assert = require("node:assert/strict");
const test = require("node:test");

const { buildBirthdateValue, parseBirthdateValue } = require("../src/helpers.ts");

/**
 * The birthdate wire contract.
 *
 * This is a regression test for a bug that only the running app exposed: the
 * client appended `T00:00:00.000Z`, the API's `birthdate` is
 * `^\d{4}-\d{2}-\d{2}$`, and so every onboarding and every profile edit failed
 * with 400. The visible symptom was a diary that said "Set a calorie target"
 * after onboarding had just computed one — the write never landed.
 *
 * The pattern below is copied from the API schema deliberately. If the two ever
 * disagree again, this fails instead of a user losing their targets.
 */
const API_BIRTHDATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

test("a birthdate serialises to exactly what the API accepts", () => {
  assert.match(buildBirthdateValue(new Date(1998, 0, 1)), API_BIRTHDATE_PATTERN);
  assert.equal(buildBirthdateValue(new Date(1998, 0, 1)), "1998-01-01");
});

test("single-digit months and days are zero-padded", () => {
  assert.equal(buildBirthdateValue(new Date(2003, 8, 7)), "2003-09-07");
  assert.match(buildBirthdateValue(new Date(2003, 8, 7)), API_BIRTHDATE_PATTERN);
});

test("it carries no time component", () => {
  // The old value was `1998-01-01T00:00:00.000Z`, which the API rejected.
  assert.ok(!buildBirthdateValue(new Date(1998, 0, 1)).includes("T"));
  assert.ok(!buildBirthdateValue(new Date(1998, 0, 1)).includes("Z"));
});

test("it uses local calendar fields, so the day cannot shift", () => {
  // 23:30 local on the 1st must stay the 1st. Appending Z to a local date
  // could report the 2nd for anyone east of UTC.
  const lateEvening = new Date(1998, 0, 1, 23, 30);
  assert.equal(buildBirthdateValue(lateEvening), "1998-01-01");
  const earlyMorning = new Date(1998, 0, 1, 0, 30);
  assert.equal(buildBirthdateValue(earlyMorning), "1998-01-01");
});

test("it round-trips through the parser", () => {
  const original = new Date(1990, 5, 15);
  const parsed = parseBirthdateValue(buildBirthdateValue(original));
  assert.ok(parsed);
  assert.equal(parsed.getFullYear(), 1990);
  assert.equal(parsed.getMonth(), 5);
  assert.equal(parsed.getDate(), 15);
});

test("the parser still accepts the legacy timestamp form", () => {
  // Any birthdate already written to a device's SQLite in the old format must
  // keep working.
  const parsed = parseBirthdateValue("1998-01-01T00:00:00.000Z");
  assert.ok(parsed);
  assert.equal(parsed.getFullYear(), 1998);
});
