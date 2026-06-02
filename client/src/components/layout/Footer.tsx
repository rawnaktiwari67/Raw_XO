import { Link } from 'react-router-dom';

const GROUPS = [
    {
        title: 'Explore',
        links: [
            { to: '/', label: '5 Sec Game' },
            { to: '/archive', label: 'Culture Archive' },
            { to: '/tours', label: 'Tour Calendar' },
            { to: '/leaderboard', label: 'Top Listeners' },
        ],
    },
    {
        title: 'Account',
        links: [
            { to: '/register', label: 'Create Profile' },
            { to: '/login', label: 'Sign In' },
        ],
    },
];

export default function Footer() {
    return (
        <footer className="border-t border-white/[0.08] mt-20">
            <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-16">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                    <div className="md:col-span-5">
                        <Link to="/" aria-label="Raw XO home">
                            <span className="brand-mark text-[2.15rem] leading-none text-gradient-gold">
                                Raw XO
                            </span>
                        </Link>
                        <p className="text-text-3 text-sm max-w-sm mt-3 leading-relaxed">
                            Music instinct, album memory, and culture notes held in one late-night room.
                        </p>
                    </div>

                    {GROUPS.map((group) => (
                        <div key={group.title} className="md:col-span-3">
                            <p className="label-xs mb-4">{group.title}</p>
                            <div className="flex flex-col gap-2">
                                {group.links.map((item) => (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        className="text-sm text-text-2 hover:text-text-1 transition-colors"
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-white/[0.06] mt-12 pt-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <p className="text-xs text-text-4">(c) {new Date().getFullYear()} Raw XO</p>
                    <p className="text-xs text-text-4">Curated for people who care how songs feel in context.</p>
                </div>
            </div>
        </footer>
    );
}
