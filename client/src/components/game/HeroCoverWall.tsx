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

// Five size/depth tiers with a deliberate visual hierarchy — ONE primary that
// owns the eye, two secondaries at ~70%, and everything else receding into the
// background. Depth reads through three levers at once: SIZE (a 6× span from
// primary to tiny), OPACITY (100 → 24%), and a light BLUR that grows as tiles
// shrink. `depth` sorts each tier into one of three parallax planes so the
// collage moves like layered glass, not a flat sheet. Blur stays modest —
// heavy blur turned the back tiers into murky smudges against the charcoal.
const TIERS = [
    // 0 · PRIMARY — the single anchor. Largest, brightest, sharpest, oversized.
    { w: 'clamp(11rem, 16.5vw, 16.5rem)', dim: 1, blur: 0, depth: 'near' },
    // 1 · SECONDARY — two supporting stars at ~70%, still sharp.
    { w: 'clamp(8rem, 11.5vw, 12rem)', dim: 0.72, blur: 0.3, depth: 'near' },
    // 2 · SUPPORTING — mid plane, half weight, a touch soft.
    { w: 'clamp(5.25rem, 7.5vw, 8rem)', dim: 0.5, blur: 0.9, depth: 'mid' },
    // 3 · SMALL — far plane, dim and soft, recedes.
    { w: 'clamp(3.75rem, 5vw, 5.5rem)', dim: 0.34, blur: 1.6, depth: 'far' },
    // 4 · TINY — the blurred-tiny background floor; pure atmosphere.
    { w: 'clamp(2.75rem, 3.6vw, 4rem)', dim: 0.26, blur: 2.1, depth: 'far' },
] as const;

type Depth = (typeof TIERS)[number]['depth'];

interface Tile {
    x: number;    // left edge, % of hero width
    y: number;    // top edge, % of hero height
    tier: 0 | 1 | 2 | 3 | 4;
    rot: number;  // static tilt, deg — snapped to {-12,-8,-4,0} so the angles
                  // read as one intentional family, never random scatter
    float: number; // idle bob duration, s (7–12s, negative-delay staggered)
    mdUp?: boolean; // hidden on phones so the arrangement doesn't clog small screens
}

// Hand-placed composition. The headline owns a PROTECTED ZONE in the left-
// center (roughly x 12–56%, y 38–80%): nothing bright or large intrudes there,
// so the eye never fights the text — only dim far-left texture sits behind the
// scrim beside it. Visual weight leans up and right, the primary anchoring the
// top-center where the radial mask is brightest, secondaries framing it from
// the top-left and right, and the rest arranged to frame the text rather than
// compete with it. Lower tiles dissolve into the bottom fade on purpose.
const TILES: Tile[] = [
    // PRIMARY — the one anchor, top-center-right in the mask's brightest zone
    { x: 54, y: 6, tier: 0, rot: -4, float: 11 },

    // SECONDARY — two supporting stars, both above/right of the headline
    { x: 19, y: 5, tier: 1, rot: -8, float: 9 },
    { x: 78, y: 13, tier: 1, rot: -8, float: 12 },

    // TOP band — texture above the headline (density is welcome here)
    { x: 2, y: 9, tier: 3, rot: -12, float: 8, mdUp: true },
    { x: 10, y: 20, tier: 4, rot: -8, float: 10, mdUp: true },
    { x: 34, y: 4, tier: 2, rot: -4, float: 12 },
    { x: 42, y: 18, tier: 3, rot: 0, float: 9, mdUp: true },
    { x: 66, y: 3, tier: 2, rot: -8, float: 11 },
    { x: 89, y: 6, tier: 2, rot: -4, float: 10, mdUp: true },
    { x: 95, y: 19, tier: 3, rot: -8, float: 8, mdUp: true },
    { x: 29, y: 22, tier: 4, rot: -12, float: 11, mdUp: true },
    { x: 50, y: 21, tier: 4, rot: -8, float: 10, mdUp: true },

    // RIGHT column — frames the right of the headline
    { x: 62, y: 30, tier: 2, rot: -8, float: 10 },
    { x: 84, y: 31, tier: 3, rot: -4, float: 12, mdUp: true },
    { x: 93, y: 43, tier: 2, rot: -8, float: 9, mdUp: true },
    { x: 72, y: 47, tier: 2, rot: -12, float: 11 },
    { x: 88, y: 56, tier: 3, rot: -4, float: 8 },
    { x: 63, y: 61, tier: 3, rot: -8, float: 10, mdUp: true },
    { x: 79, y: 64, tier: 2, rot: -8, float: 12 },
    { x: 95, y: 65, tier: 4, rot: 0, float: 9, mdUp: true },
    { x: 74, y: 38, tier: 3, rot: -8, float: 11, mdUp: true },

    // LOWER center-right — below the headline, fading into the scrim
    { x: 58, y: 71, tier: 3, rot: -8, float: 11 },
    { x: 70, y: 74, tier: 2, rot: -4, float: 10 },

    // FAR-LEFT edge — dim texture behind the scrim; never competes with the text
    { x: 0, y: 34, tier: 4, rot: -8, float: 9, mdUp: true },
    { x: 1, y: 49, tier: 4, rot: -12, float: 12, mdUp: true },
    { x: 2, y: 63, tier: 4, rot: -4, float: 8, mdUp: true },
];

// Full-bleed ambient album-art collage behind the hero. A masked, gently
// breathing arrangement of covers — present enough to set the tone, feathered
// and scrimmed so the headline always sits on darkness. Mounted post-paint
// (see Game.tsx) so it never blocks LCP; everything animated here is
// compositor-only (CSS transforms) or one-shot (the entrance).
export default function HeroCoverWall() {
    const [covers, setCovers] = useState<string[]>([]);
    const reduced = useReducedMotion();

    // Cursor parallax across three planes: the near plane (primary + secondary)
    // leans fully toward the pointer, the mid plane at 0.58×, the far plane at
    // 0.3× — the different rates are what sell real depth, like layers of glass
    // sliding past each other. Springs glide rather than snap; touch devices
    // never fire mousemove, so the wall stays still there.
    const px = useSpring(0, { stiffness: 60, damping: 20, mass: 0.6 });
    const py = useSpring(0, { stiffness: 60, damping: 20, mass: 0.6 });
    const midX = useTransform(px, (v) => v * 0.58);
    const midY = useTransform(py, (v) => v * 0.58);
    const farX = useTransform(px, (v) => v * 0.3);
    const farY = useTransform(py, (v) => v * 0.3);

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
            // Dedupe by artwork URL: the catalog often has several tracks off the
            // same album, and a repeated sleeve in a hand-placed collage reads as
            // a bug. Only genuinely distinct covers make the wall.
            const seen = new Set<string>();
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
                .filter((src) => {
                    if (!src || seen.has(src)) return false;
                    seen.add(src);
                    return true;
                });
            setCovers(art.slice(0, TILES.length));
        });
        return () => {
            alive = false;
        };
    }, []);

    if (covers.length < 10) return null;

    const renderTiles = (depth: Depth) =>
        TILES.map((tile, i) => {
            const tier = TIERS[tile.tier];
            if (tier.depth !== depth) return null;
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
                            {/* Eager on purpose: every tile is above the fold and the
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
            // instead of hard-cutting mid-tile. The transparent stop ends at 78%
            // (not 84%) so the fade reaches TRUE zero before the container's
            // bottom edge — at 84% the graded layer was still ~2% visible there,
            // cutting off in a faint horizontal seam against the page background.
            style={{
                maskImage: 'radial-gradient(125% 92% at 50% 24%, #000 44%, transparent 78%)',
                WebkitMaskImage: 'radial-gradient(125% 92% at 50% 24%, #000 44%, transparent 78%)',
            }}
        >
            {/* The static saturate/contrast grade unifies two dozen clashing album
                sleeves into one graded backdrop, and the whole canvas breathes a
                hair (compositor-only) so the arrangement feels alive, not frozen. */}
            <div
                className="absolute inset-0 opacity-[0.9] [filter:saturate(1.18)_contrast(1.1)_brightness(1.1)]"
                style={reduced ? undefined : { animation: 'heroBreathe 46s ease-in-out infinite', willChange: 'transform' }}
            >
                {/* Three depth planes, painted back-to-front so the sharp primary
                    sits on top. Each moves at its own parallax rate (far slowest). */}
                <motion.div className="absolute inset-0" style={{ x: farX, y: farY }}>
                    {renderTiles('far')}
                </motion.div>
                <motion.div className="absolute inset-0" style={{ x: midX, y: midY }}>
                    {renderTiles('mid')}
                </motion.div>
                <motion.div className="absolute inset-0" style={{ x: px, y: py }}>
                    {renderTiles('near')}
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
