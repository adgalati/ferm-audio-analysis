export function buildGenreExplainPrompt(genre, subgenre) {
  const title = subgenre || genre;
  const system = 'You are a music analysis expert for a live stream. Be concise, practical, and specific.';
  const user = `Explain the musical characteristics typically associated with ${title}.
Include textures, instruments, rhythm/harmony patterns, production traits, and notable artist or band examples associated with ${title}.
Return strict JSON with: {"title":"${title}","bullets":["..."],"summary":"..."}. Max 7 bullets.`;
  return { system, user };
}




