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

export const buildBirthdateIsoString = (date: Date): string =>
  `${formatDateToYmd(date)}T00:00:00.000Z`;

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
