export const DEVELOPER_ACCOUNT_EMAIL = "dev@dev.dev";

export const isDeveloperAccountEmail = (email?: string | null) =>
  email?.trim().toLowerCase() === DEVELOPER_ACCOUNT_EMAIL;
