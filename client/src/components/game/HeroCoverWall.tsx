import { useEffect, useState } from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { musicService } from '../../services/musicService';

// Covers we don't want setting the hero's tone. Desi/Bollywood artwork (Aashiqui
// 2 etc.) clashes with the cinematic charcoal look the landing is going for, so
// they're filtered out of the ambient wall by genre, mood bucket, and artist.
const DESI_GENRE = /(indian|bolly|punjabi|desi|world|hindi)/i;
const DESI_ARTIST = /(arijit|diljit|ap dhillon|dhillon|karan aujla|shubh|badshah|honey singh|sidhu|nucleya|prateek)/i;

// ── Art-directed composition ─────────────────────────────────────────────────
// The wall is a fixed arrangement, not a scrolling strip: every tile has a
// hand-placed position in % of the hero band and a size in clamped vw, so the
// whole collage scales as ONE composition across viewport widths instead of
// being cropped differently at each size. Focal covers stay inside the mask's
// safe zone (x 10–82%, y < 62%) so they are never clipped; only small filler
// tiles reach into the feathered edges, where dissolving into the dark is the
// intended look.

// Size/depth tiers. Front tiers sit sharp and bright and carry the cursor
// parallax fully; back tiers recede dim, soft, and half-speed — the same faked
// depth of field the old wall had, now stable.
const TIERS = [
    { w: 'clamp(8.5rem, 13vw, 13rem)', dim: 1, blur: 0, front: true },     // XL focal
    { w: 'clamp(7rem, 10.5vw, 11rem)', dim: 0.94, blur: 0.4, front: true }, // L
    { w: 'clamp(5.5rem, 8vw, 9rem)', dim: 0.84, blur: 1.1, front: false },  // M
    { w: 'clamp(4.25rem, 6vw, 7rem)', dim: 0.72, blur: 1.8, front: false }, // S filler
] as const;

interface Tile {
    x: number;    // left edge, % of hero width
    y: number;    // top edge, % of hero height
    tier: 0 | 1 | 2 | 3;
    rot: number;  // static tilt, deg — replaces the old global -8° wrapper so
                  // percent positions map 1:1 onto the visible rectangle
    float: number; // idle bob duration, s (negative delay staggers phase)
    mdUp?: boolean; // filler hidden on phones so the small band doesn't clog
}

// Laid out against the page: the headline owns the left-center block, so the
// visual weight leans right and up, with dimmed texture continuing behind the
// scrim on the left. Bottom-row tiles sit in the lower fade on purpose — they
// dissolve into the content below rather than hard-stopping.
const TILES: Tile[] = [
    // top band — full-width texture strip
    { x: 1, y: 6, tier: 2, rot: -7, float: 17, mdUp: true },
    { x: 14, y: 2, tier: 3, rot: -9, float: 21, mdUp: true },
    { x: 24, y: 8, tier: 1, rot: -6, float: 19 },
    { x: 41, y: 3, tier: 2, rot: -10, float: 16 },
    { x: 55, y: 9, tier: 0, rot: -7, float: 22 },
    { x: 74, y: 2, tier: 2, rot: -5, float: 18 },
    { x: 88, y: 7, tier: 3, rot: -9, float: 20, mdUp: true },
    // mid band — right-weighted, framing the headline
    { x: 6, y: 34, tier: 3, rot: -6, float: 18, mdUp: true },
    { x: 30, y: 36, tier: 2, rot: -8, float: 23, mdUp: true },
    { x: 48, y: 40, tier: 3, rot: -5, float: 17 },
    { x: 62, y: 38, tier: 1, rot: -8, float: 21 },
    { x: 80, y: 32, tier: 2, rot: -6, float: 19 },
    { x: 92, y: 40, tier: 1, rot: -9, float: 16, mdUp: true },
    // lower band — dissolves into the bottom scrim
    { x: 12, y: 62, tier: 2, rot: -9, float: 20, mdUp: true },
    { x: 36, y: 66, tier: 3, rot: -7, float: 18, mdUp: true },
    { x: 52, y: 68, tier: 2, rot: -10, float: 22 },
    { x: 68, y: 58, tier: 0, rot: -6, float: 19 },
    { x: 87, y: 64, tier: 2, rot: -8, float: 17 },
];

// Full-bleed ambient album-art collage behind the hero. A masked, gently
// breathing arrangement of covers — present enough to set the tone, feathered
// and scrimmed so the headline always sits on darkness. Mounted post-paint
// (see Game.tsx) so it never blocks LCP; everything animated here is
// compositor-only (CSS transforms) or one-shot (the entrance).
export default function HeroCoverWall() {
    const [covers, setCovers] = useState<string[]>([]);
    const reduced = useReducedMotion();

    // Cursor parallax: the collage leans a few pixels toward the pointer,
    // front tiles at full strength, back tiles at half — a depth cue the flat
    // marquee never had. Springs glide rather than snap; touch devices never
    // fire mousemove, so the wall stays still there.
    const px = useSpring(0, { stiffness: 60, damping: 20, mass: 0.6 });
    const py = useSpring(0, { stiffness: 60, damping: 20, mass: 0.6 });
    const bx = useTransform(px, (v) => v * 0.45);
    const by = useTransform(py, (v) => v * 0.45);

    useEffect(() => {
        if (reduced) return;
        const onMove = (e: MouseEvent) => {
            px.set((e.clientX / window.innerWidth - 0.5) * 26);
            py.set((e.clientY / window.innerHeight - 0.5) * 20);
        };
        window.addEventListener('mousemove', onMove, { passive: true });
        return () => window.removeEventListener('mousemove', onMove);
    }, [reduced, px, py]);

    useEffect(() => {
        let alive = true;
        musicService.getHeroArtwork().then((tracks) => {
            if (!alive) return;
            const art = tracks
                .filter(
                    (track) =>
                        !DESI_GENRE.test(track.genre || '') &&
                        track.mood !== 'devotion' &&
                        !DESI_ARTIST.test(track.artist || '')
                )
                // Ambient texture only — downscale the artwork to 300px so the wall
                // costs a quarter of the bandwidth and pops in fast. (musicService
                // hands back 600x600; anything sharper is wasted behind the scrim.)
                .map((track) => track.albumArt.replace('600x600bb', '300x300bb'))
                .filter(Boolean);
            setCovers(art.slice(0, TILES.length));
        });
        return () => {
            alive = false;
        };
    }, []);

    if (covers.length < 10) return null;

    const renderTiles = (front: boolean) =>
        TILES.map((tile, i) => {
            if (TIERS[tile.tier].front !== front) return null;
            const tier = TIERS[tile.tier];
            return (
                <div
                    key={i}
                    className={`absolute ${tile.mdUp ? 'hidden md:block' : ''}`}
                    style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: tier.w }}
                >
                    {/* Entrance: staggered rise-and-settle, one-shot. Framer owns
                        this wrapper's transform, the inner element owns the idle
                        drift. NO filter here: blurring the wrapper smears the
                        cover's edges into a dark halo that hard-stops at the
                        element's layer boundary — the depth blur lives on the img
                        below instead, cropped by the rounded frame. */}
                    <motion.div
                        initial={reduced ? false : { opacity: 0, y: 24, scale: 0.95 }}
                        animate={{ opacity: tier.dim, y: 0, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.05 + i * 0.045, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {/* Idle life: an ultra-slow bob sharing one transform with the
                            static tilt via --tile-rot (see heroFloat keyframes). Phase
                            is staggered with a negative delay so tiles never sync. */}
                        <div
                            className="aspect-square overflow-hidden rounded-2xl ring-1 ring-white/10"
                            style={{
                                '--tile-rot': `${tile.rot}deg`,
                                transform: `rotate(${tile.rot}deg)`,
                                ...(reduced
                                    ? {}
                                    : {
                                        animation: `heroFloat ${tile.float}s ease-in-out ${-i * 1.7}s infinite alternate`,
                                        willChange: 'transform',
                                    }),
                            } as React.CSSProperties}
                        >
                            {/* Eager on purpose: all 18 tiles are above the fold and the
                                whole wall already mounts post-paint (Game.tsx), so lazy
                                would only delay the reveal, not save bandwidth.
                                Depth-of-field blur sits on the img itself, over-scaled a
                                touch so the smeared edge pixels fall outside the frame
                                and get cropped — soft interior, crisp tile border. */}
                            <img
                                src={covers[i % covers.length]}
                                alt=""
                                decoding="async"
                                className="h-full w-full object-cover"
                                style={
                                    tier.blur > 0
                                        ? { filter: `blur(${tier.blur}px)`, transform: 'scale(1.08)' }
                                        : undefined
                                }
                            />
                        </div>
                    </motion.div>
                </div>
            );
        });

    return (
        <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] overflow-hidden lg:h-[36rem]"
            // Soft radial mask so the collage dissolves into the dark on every edge
            // instead of hard-cutting mid-tile — the main lever that turns a set of
            // thumbnails into a cinematic backdrop.
            style={{
                maskImage: 'radial-gradient(125% 92% at 50% 24%, #000 44%, transparent 84%)',
                WebkitMaskImage: 'radial-gradient(125% 92% at 50% 24%, #000 44%, transparent 84%)',
            }}
        >
            {/* The static saturate/contrast grade unifies two dozen clashing album
                sleeves into one graded backdrop, and the whole canvas breathes a
                hair (compositor-only) so the arrangement feels alive, not frozen. */}
            <div
                className="absolute inset-0 opacity-[0.9] [filter:saturate(1.18)_contrast(1.1)_brightness(1.1)]"
                style={reduced ? undefined : { animation: 'heroBreathe 46s ease-in-out infinite', willChange: 'transform' }}
            >
                {/* Back depth layer: dim, soft, half-speed parallax. */}
                <motion.div className="absolute inset-0" style={{ x: bx, y: by }}>
                    {renderTiles(false)}
                </motion.div>
                {/* Front depth layer: focal covers, sharp, full parallax. */}
                <motion.div className="absolute inset-0" style={{ x: px, y: py }}>
                    {renderTiles(true)}
                </motion.div>
            </div>

            {/* Scrims layered over the mask: a left bias keeps the headline on
                darkness, a bottom fade dissolves the wall into the content below,
                and a warm amber wash lifts the top. */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#0B0B0F_0%,rgba(11,11,15,0.16)_34%,transparent_60%)]" />
            {/* Strong lower fade to solid #0B0B0F (= --bg-0), so the wall is fully
                gone before the game setup below and never bleeds through its cards. */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent_0%,#0B0B0F_78%)]" />
            <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(65%_100%_at_18%_0%,rgba(244,162,97,0.14),transparent_72%)]" />
        </motion.div>
    );
}
