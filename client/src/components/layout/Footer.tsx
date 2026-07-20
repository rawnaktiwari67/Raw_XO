import { Link } from 'react-router-dom';
import Marquee from '../motion/Marquee';
import RollText from '../motion/RollText';

const MARQUEE_ITEMS = ['Music instinct', 'Album memory', 'Culture notes', 'Live shows'];

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
        <footer className="pb-safe border-t border-white/[0.08] mt-20">
            <Marquee duration={34} className="border-b border-white/[0.06] py-7">
                {MARQUEE_ITEMS.map((item) => (
                    <span key={item} className="flex items-center whitespace-nowrap">
                        <span className="brand-mark mx-7 text-[2.2rem] leading-none text-white/[0.14] md:text-[2.8rem]">
                            {item}
                        </span>
                        <span className="text-[1.1rem] text-accent/40">✦</span>
                    </span>
                ))}
            </Marquee>
            <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-16">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                    <div className="md:col-span-5">
                        <Link to="/" aria-label="Raw XO home" className="tap-target inline-flex items-center">
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
                                        className="roll-trigger tap-target inline-flex items-center self-start text-sm text-text-2 hover:text-text-1 transition-colors"
                                    >
                                        <RollText>{item.label}</RollText>
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
