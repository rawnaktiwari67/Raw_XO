/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                /* Charcoal base system */
                'ch': {
                    0: '#0B0B0F',
                    1: '#111218',
                    2: '#16171D',
                    3: '#1C1D24',
                },
                /* Muted amber — the one accent */
                'amber': '#F4A261',
                'amber-dim': 'rgba(244,162,97,0.10)',
                'peach-glow': '#F6B07A',
                'highlight-gold': '#F6C56B',
                'dusk-purple': '#141523',

                /* Text scale */
                'tx': {
                    1: '#F5F5F5',
                    2: '#B3B3B8',
                    3: '#7A7A80',
                    4: '#4A4A52',
                },
                'text-1': '#F5F5F5',
                'text-2': '#B3B3B8',
                'text-3': '#7A7A80',
                'text-4': '#4A4A52',

                /* Legacy aliases for components not yet migrated */
                'dusk-navy': '#0B0B0F',
                'sunset-orange': '#F4A261',  /* remapped to amber */
                'text-warm': '#F5F5F5',
                'text-muted': '#B3B3B8',
                'text-subtle': '#7A7A80',
                'accent': '#F4A261',
            },
            fontFamily: {
                heading: ['"Barlow Condensed"', '-apple-system', 'sans-serif'],
                body: ['"Inter"', '-apple-system', 'sans-serif'],
                brand: ['"Barlow Condensed"', '-apple-system', 'sans-serif'],
            },
            letterSpacing: {
                tightest: '-0.045em',
                tighter: '-0.03em',
                tight: '-0.02em',
                label: '0.10em',
            },
            fontSize: {
                'display-xl': ['clamp(3rem, 7vw, 5.5rem)', { lineHeight: '0.97', letterSpacing: '-0.045em' }],
                'display-lg': ['clamp(2.25rem, 5vw, 4rem)', { lineHeight: '1.0', letterSpacing: '-0.04em' }],
                'section': ['clamp(1.75rem, 3.5vw, 2.5rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
            },
            spacing: {
                'section': '120px',
                '18': '4.5rem',
                '22': '5.5rem',
            },
            borderRadius: {
                'xl': '0.95rem',
                '2xl': '1.2rem',
                '3xl': '1.6rem',
            },
            backdropBlur: {
                nav: '20px',
                glass: '12px',
            },
            boxShadow: {
                'card': '0 2px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
                'lift': '0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)',
                'amber': '0 8px 28px rgba(244,162,97,0.22)',
            },
            transitionTimingFunction: {
                'apple': 'cubic-bezier(0.25, 0.10, 0.25, 1.00)',
                'entrance': 'cubic-bezier(0.22, 1.00, 0.36, 1.00)',
                'out': 'cubic-bezier(0.00, 0.00, 0.20, 1.00)',
            },
            animation: {
                'enter-up': 'slideUpFade 0.8s cubic-bezier(0.22,1,0.36,1) both',
                'enter-fade': 'fadeIn 0.8s cubic-bezier(0.22,1,0.36,1) both',
                'float': 'subtleFloat 6s ease-in-out infinite',
                'bar-drain': 'barDrain linear forwards',
            },
            keyframes: {
                slideUpFade: { from: { opacity: '0', transform: 'translateY(32px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
                fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
                subtleFloat: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
                barDrain: { from: { width: '100%' }, to: { width: '0%' } },
            },
        },
    },
    plugins: [],
};
