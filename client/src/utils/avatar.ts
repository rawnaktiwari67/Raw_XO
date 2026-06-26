// Safe avatar helpers — never crash on missing/empty names. A single malformed
// record (deleted user, blank username) should not take down a whole list view.
export const avatarInitial = (name?: string | null): string =>
    name?.trim()?.[0]?.toUpperCase() ?? '?';

export const avatarHue = (name?: string | null): number => {
    const code = name?.trim()?.charCodeAt(0);
    return typeof code === 'number' && Number.isFinite(code) ? (code * 7) % 360 : 210;
};
