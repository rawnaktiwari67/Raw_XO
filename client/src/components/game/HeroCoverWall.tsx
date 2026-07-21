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
// Option A — cinematic, right-weighted composition. The headline is a heavy
// mass on the LEFT, so the collage's weight is deliberately pushed RIGHT to
// counterbalance it: one oversized anchor and its overlapping cluster form a
// focal mass upper-right, a diagonal ridge ties that mass back to the headline,
// and covers overlap ACROSS depth planes (occlusion, not just size) so the wall
// reads as layered glass. Several tiles run off the top/right/bottom-left edges
// so the frame feels like a window, not a poster. The protected headline zone
// (x 8–56%, y 36–82%) stays clear of everything but dim far-left texture.
const TILES: Tile[] = [
    // ── PRIMARY FOCAL CLUSTER (upper-right) — the counterweight to the headline.
    // One oversized sharp anchor with secondaries and mids overlapping it, so the
    // right reads as a single deliberate mass rather than a scatter of covers.
    // The tier-0 anchor is oversized on a phone's narrow band — it would dip into
    // the full-width mobile headline — so it and the mid beneath it are desktop-
    // only; on mobile the tier-1 secondary below carries the top-right cluster.
    { x: 71, y: 12, tier: 0, rot: -4, float: 11, mdUp: true },  // the one anchor (desktop)
    { x: 61, y: 5, tier: 1, rot: -8, float: 9 },                // overlaps anchor, top-left
    { x: 86, y: 33, tier: 1, rot: -4, float: 12, mdUp: true },  // overlaps anchor, bleeds off right
    { x: 76, y: 30, tier: 2, rot: -8, float: 10, mdUp: true },  // packs the cluster core
    { x: 67, y: 43, tier: 2, rot: -8, float: 11, mdUp: true },  // under the anchor (desktop)
    { x: 84, y: 51, tier: 2, rot: -4, float: 9, mdUp: true },   // lower-right of cluster

    // ── CONNECTIVE RIDGE — a diagonal of mids arcing from above the headline into
    // the cluster, so the left and right masses read as one composition, not two.
    { x: 40, y: 4, tier: 2, rot: -4, float: 12 },
    { x: 48, y: 11, tier: 2, rot: -12, float: 10 },
    { x: 56, y: 24, tier: 2, rot: -8, float: 11, mdUp: true },
    { x: 62, y: 31, tier: 3, rot: -4, float: 9, mdUp: true },

    // ── TOP BAND — texture above the headline; density welcome, and a couple of
    // covers bleed off the top edge so the collage feels windowed, not framed.
    { x: 20, y: 6, tier: 3, rot: -8, float: 10 },
    { x: 30, y: 16, tier: 3, rot: -12, float: 8 },
    { x: 10, y: 18, tier: 4, rot: -8, float: 11 },              // top-left texture (also mobile)
    { x: 36, y: -6, tier: 3, rot: -8, float: 12, mdUp: true },  // bleeds off top
    { x: 50, y: 1, tier: 4, rot: -4, float: 10 },               // top texture (also mobile)
    { x: 44, y: 27, tier: 4, rot: -8, float: 9, mdUp: true },   // dim atmosphere above headline
    { x: 86, y: 7, tier: 3, rot: -4, float: 11 },               // top-right corner (mobile anchor)

    // ── BACKGROUND — far plane, blurred and small; right edge + lower-right, some
    // running off frame and dissolving into the bottom fade.
    { x: 94, y: 15, tier: 4, rot: -8, float: 9, mdUp: true },   // bleeds off right
    { x: 96, y: 47, tier: 4, rot: -4, float: 12, mdUp: true },  // bleeds off right
    { x: 90, y: 65, tier: 3, rot: -4, float: 8 },               // lower-right anchor
    { x: 78, y: 70, tier: 4, rot: 0, float: 11, mdUp: true },   // fades into bottom scrim
    { x: 70, y: 57, tier: 3, rot: -8, float: 10, mdUp: true },
    { x: 60, y: 66, tier: 3, rot: -8, float: 11 },              // lower center-right (right of zone)
    { x: 66, y: 78, tier: 4, rot: -4, float: 9, mdUp: true },

    // ── FAR-LEFT COLUMN — dim texture behind the headline scrim; gives the left
    // atmospheric depth without ever competing with the type, and clips the edge.
    { x: -3, y: 10, tier: 4, rot: -8, float: 10, mdUp: true },  // bleeds off left
    { x: 0, y: 24, tier: 4, rot: -12, float: 12 },
    { x: 1, y: 42, tier: 4, rot: -4, float: 8, mdUp: true },
    { x: 2, y: 58, tier: 4, rot: -8, float: 9 },
    { x: -2, y: 76, tier: 4, rot: -4, float: 11, mdUp: true },  // bleeds off bottom-left
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

            // Fisher-Yates shuffle, unseeded — so the collage draws a different
            // set of covers into different tiles on every mount, for every
            // visitor. The composition itself (tiers, positions, hierarchy) is
            // fixed; only WHICH sleeve lands in each slot re-rolls, so the wall
            // feels freshly arranged every visit without ever looking scattered.
            for (let i = art.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [art[i], art[j]] = [art[j], art[i]];
            }
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
                {/* Volumetric key light — a warm radial anchored on the focal
                    cluster, painted BEHIND every plane so the covers sit in front
                    of it and catch the glow. Depth, not brightness: low alpha, wide
                    falloff, no hard core (that would read as bloom). */}
                <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{ background: 'radial-gradient(42% 40% at 73% 22%, rgba(244,162,97,0.16), transparent 72%)' }}
                />
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
            {/* Cinematic vignette — deepens the far corners to push the focal
                cluster forward. Its clear centre is offset to the cluster (62% 26%)
                so the glow stays open there while the edges fall into shadow;
                the left side darkening also reinforces the headline safe zone. */}
            <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: 'radial-gradient(130% 118% at 62% 26%, transparent 54%, rgba(11,11,15,0.55) 100%)' }}
            />
            {/* Strong lower fade to solid #0B0B0F (= --bg-0), so the wall is fully
                gone before the game setup below and never bleeds through its cards. */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent_0%,#0B0B0F_78%)]" />
            {/* Top warm wash, re-anchored over the focal cluster (was top-left) so
                the collage's brightest light and its focal mass agree. */}
            <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(60%_100%_at_68%_0%,rgba(244,162,97,0.13),transparent_70%)]" />
        </motion.div>
    );
}
