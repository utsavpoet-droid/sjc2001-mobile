/**
 * Versionless paths only — join with:
 * - v1 base ending in `/api/v1`
 * - content base ending in `/api`
 */

export const API_AUTH_MOBILE_LOGIN = '/auth/mobile/login' as const;
export const API_AUTH_MOBILE_REFRESH = '/auth/mobile/refresh' as const;
export const API_AUTH_MOBILE_LOGOUT = '/auth/mobile/logout' as const;
export const API_AUTH_MOBILE_ME = '/auth/mobile/me' as const;

export const API_PUSH_REGISTER = '/push/register' as const;
export const API_PUSH_UNREGISTER = '/push/unregister' as const;

export const API_STORIES = '/stories' as const;
export const API_GALLERY = '/gallery' as const;
export const API_MEMBERS = '/members' as const;
export const API_MEMBERS_SEARCH = '/members/search' as const;
export const API_COMMENTS = '/comments' as const;
export const API_REACTIONS = '/reactions' as const;
export const API_UPLOAD = '/upload' as const;
export const API_GIPHY = '/giphy' as const;
export const API_POLLS = '/polls' as const;
export const API_SILVER_JUBILEE = '/silver-jubilee' as const;
export const API_MEMBER_PROFILE = '/member-profile' as const;
export const API_MEMBER_PROFILES = '/member-profiles' as const;
export const API_MEMBER_ACTIVITY = '/member/activity' as const;
export const API_MEMBER_ACTIVITY_SEEN = '/member/activity/seen' as const;
export const API_MEMBER_CHANGE_PASSWORD = '/member/change-password' as const;
export const API_MEMBER_TOTP_SETUP = '/member/totp/setup' as const;
export const API_MEMBER_TOTP_VERIFY = '/member/totp/verify' as const;
export const API_MEMBER_TOTP_DISABLE = '/member/totp/disable' as const;
export const API_BIRTHDAYS = '/birthdays' as const;
