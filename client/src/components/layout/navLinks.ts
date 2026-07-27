// Primary destinations, shared by the desktop top bar (Navbar) and the phone
// bottom tab bar (MobileTabBar) so routes stay single-sourced. Kept in its own
// module — not exported from Navbar — so the component files export only
// components (keeps React Fast Refresh working).
export const LINKS = [
    { to: '/', label: 'Play' },
    { to: '/archive', label: 'Culture' },
    { to: '/tours', label: 'Live' },
    { to: '/leaderboard', label: 'Rank' },
];
