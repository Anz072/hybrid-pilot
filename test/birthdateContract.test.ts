import { describe, expect, it } from "vitest";
import { buildBirthdateValue, parseBirthdateValue } from "../src/helpers";

/**
 * The birthdate wire contract.
 *
 * A regression test for a bug only the running app exposed: the client appended
 * `T00:00:00.000Z`, the API's `birthdate` is `^\d{4}-\d{2}-\d{2}$`, and so every
 * onboarding and every profile edit failed with 400. The visible symptom was a
 * diary saying "Set a calorie target" right after onboarding had computed one —
 * the write never landed.
 *
 * The pattern below is copied from the API schema deliberately. If the two ever
 * disagree again, this fails instead of a user losing their targets.
 */
const API_BIRTHDATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

describe("birthdate contract", () => {
  it("serialises to exactly what the API accepts", () => {
    expect(buildBirthdateValue(new Date(1998, 0, 1))).toMatch(API_BIRTHDATE_PATTERN);
    expect(buildBirthdateValue(new Date(1998, 0, 1))).toBe("1998-01-01");
  });

  it("zero-pads single-digit months and days", () => {
    expect(buildBirthdateValue(new Date(2003, 8, 7))).toBe("2003-09-07");
    expect(buildBirthdateValue(new Date(2003, 8, 7))).toMatch(API_BIRTHDATE_PATTERN);
  });

  it("carries no time component", () => {
    // The old value was `1998-01-01T00:00:00.000Z`, which the API rejected.
    expect(buildBirthdateValue(new Date(1998, 0, 1))).not.toContain("T");
    expect(buildBirthdateValue(new Date(1998, 0, 1))).not.toContain("Z");
  });

  it("uses local calendar fields, so the day cannot shift", () => {
    // 23:30 local on the 1st must stay the 1st. Appending Z to a local date
    // could report the 2nd for anyone east of UTC.
    expect(buildBirthdateValue(new Date(1998, 0, 1, 23, 30))).toBe("1998-01-01");
    expect(buildBirthdateValue(new Date(1998, 0, 1, 0, 30))).toBe("1998-01-01");
  });

  it("round-trips through the parser", () => {
    const parsed = parseBirthdateValue(buildBirthdateValue(new Date(1990, 5, 15)));
    expect(parsed).toBeTruthy();
    expect(parsed?.getFullYear()).toBe(1990);
    expect(parsed?.getMonth()).toBe(5);
    expect(parsed?.getDate()).toBe(15);
  });

  it("still accepts the legacy timestamp form", () => {
    // Any birthdate written in the old format must keep parsing.
    const parsed = parseBirthdateValue("1998-01-01T00:00:00.000Z");
    expect(parsed).toBeTruthy();
    expect(parsed?.getFullYear()).toBe(1998);
  });
});
