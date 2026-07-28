// One-off: query iTunes for a diverse, currently-valid set of tracks and emit
// a SongPreview[] baked into fallbackPool.ts. Mirrors musicProviders mapping.
const ARTISTS = [
  { q: 'the weeknd', take: 4 },
  { q: 'taylor swift', take: 4 },
  { q: 'drake', take: 4 },
  { q: 'billie eilish', take: 3 },
  { q: 'sza', take: 3 },
  { q: 'kendrick lamar', take: 3 },
  { q: 'dua lipa', take: 3 },
  { q: 'bad bunny', take: 4 },
  { q: 'karol g', take: 3 },
  { q: 'bts', take: 3 },
  { q: 'blackpink', take: 3 },
  { q: 'arijit singh', take: 4 },
  { q: 'shreya ghoshal', take: 3 },
  { q: 'diljit dosanjh', take: 3 },
  { q: 'ap dhillon', take: 3 },
  { q: 'karan aujla', take: 3 },
];

const artworkSized = (url = '') => url.replace(/100x100bb\.(jpg|png|webp)$/i, '300x300bb.$1');

const seen = new Set();
const out = [];

for (const { q, take } of ARTISTS) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=40`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    let added = 0;
    for (const item of json.results ?? []) {
      if (added >= take) break;
      if (!item.trackId || !item.trackName || !item.artistName || !item.previewUrl) continue;
      const title = String(item.trackName).trim();
      const artist = String(item.artistName).trim();
      const key = `${title.toLowerCase()}::${artist.toLowerCase()}`;
      if (seen.has(key)) continue;
      // skip obvious alternate/live/remix noise for a clean demo pool
      if (/\b(live|remix|instrumental|sped up|slowed|karaoke|cover)\b/i.test(title)) continue;
      seen.add(key);
      out.push({
        id: String(item.trackId),
        title,
        artist,
        album: (item.collectionName ?? '').trim(),
        releaseYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : 0,
        durationMs: item.trackTimeMillis ?? 0,
        snippetUrl: item.previewUrl,
        artworkUrl: artworkSized(item.artworkUrl100),
        trackUrl: item.trackViewUrl ?? '',
        popularity: 80,
      });
      added += 1;
    }
    process.stderr.write(`${q}: +${added}\n`);
  } catch (e) {
    process.stderr.write(`${q}: FAILED ${e.message}\n`);
  }
}

process.stderr.write(`TOTAL: ${out.length}\n`);
console.log(JSON.stringify(out, null, 4));
