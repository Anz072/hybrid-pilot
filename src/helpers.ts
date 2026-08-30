export const getAgeToday = (birthDate: Date): number => {
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
};

export const formatDateToYmd = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * A birthdate is a calendar date, not an instant.
 *
 * This used to append `T00:00:00.000Z`, which broke every profile write: the
 * API's `birthdate` is `^\d{4}-\d{2}-\d{2}$`, so onboarding and profile edits
 * both failed with 400 and the calorie target was silently never saved. The
 * timestamp was also never wanted — every consumer already sliced it back off
 * to ten characters.
 *
 * The `Z` was actively misleading too: the date is built from the device's
 * local calendar fields, so labelling it UTC could shift the day by one either
 * side of midnight.
 */
export const buildBirthdateValue = (date: Date): string => formatDateToYmd(date);

export const parseBirthdateValue = (
  value: string | null | undefined,
): Date | null => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const ymd = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return null;
  }

  const [year, month, day] = ymd.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

export const getAgeFromBirthdateValue = (
  value: string | null | undefined,
): number | null => {
  const birthdate = parseBirthdateValue(value);
  if (!birthdate) {
    return null;
  }

  const age = getAgeToday(birthdate);
  return Number.isFinite(age) ? age : null;
};
