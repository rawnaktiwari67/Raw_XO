import { useEffect, useState } from 'react';
import { motion, useReducedMotion, useSpring } from 'framer-motion';
import { musicService } from '../../services/musicService';

// Covers we don't want setting the hero's tone. Desi/Bollywood artwork (Aashiqui
// 2 etc.) clashes with the cinematic charcoal look the landing is going for, so
// they're filtered out of the ambient wall by genre, mood bucket, and artist.
const DESI_GENRE = /(indian|bolly|punjabi|desi|world|hindi)/i;
const DESI_ARTIST = /(arijit|diljit|ap dhillon|dhillon|karan aujla|shubh|badshah|honey singh|sidhu|nucleya|prateek)/i;

// One horizontal marquee row. Content is duplicated and the track slides -50%,
// so the loop is seamless. Driven by a CSS animation (heroDrift) rather than
// framer/JS so it composites off the main thread and never fights the scroller.
function Row({ covers, dir, dur, size }: { covers: string[]; dir: number; dur: number; size: string }) {
    const doubled = [...covers, ...covers];
    return (
        <div
            className="flex w-max gap-4 md:gap-6"
            style={
                dir === 0
                    ? undefined
                    : {
                        animation: `heroDrift ${dur}s linear infinite`,
                        animationDirection: dir < 0 ? 'normal' : 'reverse',
                        willChange: 'transform',
                    }
            }
        >
            {doubled.map((src, i) => (
                <div key={i} className={`${size} shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10`}>
                    <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </div>
            ))}
        </div>
    );
}

// Per-row cadence, tile size, and depth grade. Varied sizes read as a
// depth-layered mosaic rather than a single sliding strip; alternating
// directions and mismatched durations keep the loop from ever lining up into
// an obvious repeat. `dim` + `blur` fake a depth of field: the big center row
// sits sharp and forward, the small rows recede dim and soft behind it, so
// the wall reads as a lit set piece instead of a flat sheet of thumbnails.
// Durations are deliberately long — the wall should read as a near-still tableau
// that only reveals its drift if you watch it, not a scrolling ticker.
const ROWS = [
    { dir: -1, dur: 128, size: 'h-40 w-40 lg:h-44 lg:w-44', dim: 0.72, blur: 0.8 },
    { dir: 1, dur: 162, size: 'h-32 w-32 lg:h-36 lg:w-36', dim: 0.55, blur: 1.8 },
    { dir: -1, dur: 106, size: 'h-48 w-48 lg:h-56 lg:w-56', dim: 1, blur: 0 },
    { dir: 1, dur: 174, size: 'h-36 w-36 lg:h-40 lg:w-40', dim: 0.6, blur: 1.4 },
    { dir: -1, dur: 142, size: 'h-44 w-44 lg:h-48 lg:w-48', dim: 0.85, blur: 0.4 },
];

// Full-bleed ambient album-art mosaic behind the hero. A masked, slowly breathing
// wall of covers — present enough to set the tone, feathered and scrimmed so the
// headline always sits on darkness. Mounted post-paint (see Game.tsx) so it never
// blocks LCP. Runs on all screen sizes: every animation here is compositor-only
// CSS, so phones handle it fine.
export default function HeroCoverWall() {
    const [covers, setCovers] = useState<string[]>([]);
    const reduced = useReducedMotion();

    // Cursor parallax: the whole mosaic leans a few pixels toward the pointer.
    // Springs on the raw pointer offset so it glides rather than snaps. Listener
    // lives on window (the wall itself is pointer-events-none); touch devices
    // simply never fire mousemove, so the wall stays still there.
    const px = useSpring(0, { stiffness: 60, damping: 20, mass: 0.6 });
    const py = useSpring(0, { stiffness: 60, damping: 20, mass: 0.6 });

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
            setCovers(art.slice(0, 24));
        });
        return () => {
            alive = false;
        };
    }, []);

    if (covers.length < 10) return null;

    const rows = ROWS.map((_, r) => covers.filter((_, i) => i % ROWS.length === r));

    return (
        <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] overflow-hidden lg:h-[36rem]"
            // Soft radial mask so the mosaic dissolves into the dark on every edge
            // instead of hard-cutting mid-tile — the main lever that turns a strip
            // of thumbnails into a cinematic backdrop.
            style={{
                maskImage: 'radial-gradient(125% 92% at 50% 24%, #000 44%, transparent 84%)',
                WebkitMaskImage: 'radial-gradient(125% 92% at 50% 24%, #000 44%, transparent 84%)',
            }}
        >
            {/* Parallax layer carries the cursor lean; nested inside is the static
                tilt, then the breathing scale — three separate transforms on three
                elements so none of them stomp another. */}
            <motion.div className="absolute inset-0" style={{ x: px, y: py }}>
                {/* Five depth-varied rows filling the full height, tilted (CSS
                    transform on the wrapper) and slowly breathing (framer scale on the
                    inner track) so the wall feels alive rather than a flat slide.
                    Rotate stays a plain CSS transform — composing it with the animated
                    scale on one element makes framer drop the scale keyframes. */}
                <div className="absolute inset-0 [transform:rotate(-8deg)]">
                    {/* Breathing scale is a CSS animation too (compositor, not JS).
                        The static saturate/contrast grade unifies two dozen clashing
                        album sleeves into one graded backdrop — cheap (one filter on
                        one layer) and the main thing separating "film still" from
                        "wall of thumbnails". */}
                    <div
                        className="absolute inset-0 flex flex-col justify-between gap-6 py-4 opacity-[0.55] [filter:saturate(0.84)_contrast(1.06)]"
                        style={
                            reduced
                                ? { transform: 'scale(1.34)' }
                                : { animation: 'heroBreathe 46s ease-in-out infinite', willChange: 'transform' }
                        }
                    >
                        {/* Each row settles in on its own beat — a staggered
                            blur-to-sharp focus pull rather than one flat fade — then
                            holds its depth grade (dim + residual blur). One-shot cost;
                            after the entrance nothing here animates on the CPU. */}
                        {rows.map((row, r) => (
                            <motion.div
                                key={r}
                                initial={
                                    reduced ? false : { opacity: 0, y: 26, scale: 0.97, filter: 'blur(10px)' }
                                }
                                animate={{ opacity: ROWS[r].dim, y: 0, scale: 1, filter: `blur(${ROWS[r].blur}px)` }}
                                transition={{ duration: 0.65, delay: 0.05 + r * 0.06, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <Row covers={row} dir={reduced ? 0 : ROWS[r].dir} dur={ROWS[r].dur} size={ROWS[r].size} />
                            </motion.div>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Scrims layered over the mask: a left bias keeps the headline on
                darkness, a bottom fade dissolves the wall into the content below,
                and a warm amber wash lifts the top. */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#0B0B0F_0%,rgba(11,11,15,0.28)_38%,transparent_72%)]" />
            {/* Strong lower fade to solid #0B0B0F (= --bg-0), so the wall is fully
                gone before the game setup below and never bleeds through its cards. */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent_0%,#0B0B0F_78%)]" />
            <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(65%_100%_at_18%_0%,rgba(244,162,97,0.14),transparent_72%)]" />
        </motion.div>
    );
}
