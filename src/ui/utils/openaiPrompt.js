export function buildGenreExplainPrompt(genre, subgenre) {
  const title = subgenre || genre;
  const system = 'You are a concise music analysis expert. Respond only with the requested JSON. No preamble, no markdown fences.';
  const user = `Write exactly 3 short paragraphs about the musical style "${title}".

Paragraph 1: Describe the characteristic sounds, textures, and instruments used in this style.
Paragraph 2: Describe the production and audio-engineering techniques that define this style.
Paragraph 3: Give a brief history of the style and list the most prominent artists or bands associated with it.

Each paragraph must be 2-4 sentences. No bullet points, no headers.
Return ONLY strict JSON with fields: {"title":"${title}","paragraphs":["...","...","..."],"summary":"one-sentence summary"}.`;
  return { system, user };
}




