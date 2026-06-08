interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Jisho.org Japanese-English dictionary MCP (keyless).
 *
 * Wraps the public Jisho.org API. Look up Japanese words by kanji, kana, or
 * romaji, or translate English -> Japanese. Returns readings, English meanings,
 * parts of speech, JLPT level, and whether a word is "common".
 */


const BASE = 'https://jisho.org/api/v1';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

interface JishoJapanese {
  word?: string;
  reading?: string;
}

interface JishoSense {
  english_definitions?: string[];
  parts_of_speech?: string[];
  tags?: string[];
  info?: string[];
}

interface JishoEntry {
  slug?: string;
  is_common?: boolean;
  jlpt?: string[];
  tags?: string[];
  japanese?: JishoJapanese[];
  senses?: JishoSense[];
}

interface JishoResponse {
  meta?: { status?: number };
  data?: JishoEntry[];
}

const tools: McpToolExport['tools'] = [
  {
    name: 'search_words',
    description:
      'Search the Jisho.org Japanese<->English dictionary. The keyword can be English (translate to Japanese), Japanese kanji/kana, or romaji. Returns up to `limit` matching dictionary entries, each with the headword (slug), whether it is a common word, JLPT level, all readings/spellings, and English meanings grouped into senses with parts of speech. Use this to translate, look up a kanji/kana word, or find Japanese words for an English concept.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Search term: English word/phrase, Japanese kanji or kana, or romaji (e.g. "house", "家", "いえ", "ie").',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of entries to return (default 10).',
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'lookup',
    description:
      'Look up a single Japanese or English word in the Jisho.org dictionary and return only the single best/first matching entry in a compact form: headword (slug), common-ness, JLPT level, all readings, a flat list of English meanings, and the unique parts of speech. Best for quick "what does this word mean / how is it read" questions. Accepts kanji, kana, romaji, or English.',
    inputSchema: {
      type: 'object',
      properties: {
        word: {
          type: 'string',
          description: 'The word to look up: Japanese kanji/kana, romaji, or English (e.g. "食べる", "taberu", "to eat").',
        },
      },
      required: ['word'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_words':
        return await searchWords(args);
      case 'lookup':
        return await lookup(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function searchWords(args: Record<string, unknown>): Promise<unknown> {
  const keyword = reqStr(args, 'keyword');
  if (!keyword) return { error: 'Required argument "keyword" is missing. Pass a string like "house" or "家".' };

  const limit = clampLimit(args.limit, 10);
  const resp = await jishoSearch(keyword);

  if (!resp || resp.meta?.status !== 200 || !Array.isArray(resp.data) || resp.data.length === 0) {
    return { count: 0, results: [] };
  }

  const results = resp.data.slice(0, limit).map((entry) => ({
    slug: entry.slug ?? '',
    is_common: entry.is_common ?? false,
    jlpt: Array.isArray(entry.jlpt) ? entry.jlpt : [],
    japanese: (Array.isArray(entry.japanese) ? entry.japanese : []).map((j) => ({
      word: j.word ?? '',
      reading: j.reading ?? '',
    })),
    senses: (Array.isArray(entry.senses) ? entry.senses : []).map((s) => ({
      english_definitions: Array.isArray(s.english_definitions) ? s.english_definitions : [],
      parts_of_speech: Array.isArray(s.parts_of_speech) ? s.parts_of_speech : [],
      tags: Array.isArray(s.tags) ? s.tags : [],
    })),
  }));

  return { count: results.length, results };
}

async function lookup(args: Record<string, unknown>): Promise<unknown> {
  const word = reqStr(args, 'word');
  if (!word) return { error: 'Required argument "word" is missing. Pass a string like "食べる" or "to eat".' };

  const resp = await jishoSearch(word);

  if (!resp || resp.meta?.status !== 200 || !Array.isArray(resp.data) || resp.data.length === 0) {
    return { error: 'no entry found', word };
  }

  const entry = resp.data[0];
  const senses = Array.isArray(entry.senses) ? entry.senses : [];

  const readings = Array.from(
    new Set(
      (Array.isArray(entry.japanese) ? entry.japanese : [])
        .map((j) => j.reading ?? '')
        .filter((r) => r.length > 0),
    ),
  );

  const meanings: string[] = [];
  for (const s of senses) {
    if (Array.isArray(s.english_definitions)) meanings.push(...s.english_definitions);
  }

  const parts_of_speech = Array.from(
    new Set(senses.flatMap((s) => (Array.isArray(s.parts_of_speech) ? s.parts_of_speech : []))),
  );

  return {
    slug: entry.slug ?? '',
    is_common: entry.is_common ?? false,
    jlpt: Array.isArray(entry.jlpt) ? entry.jlpt : [],
    readings,
    meanings,
    parts_of_speech,
  };
}

async function jishoSearch(keyword: string): Promise<JishoResponse | null> {
  const url = `${BASE}/search/words?keyword=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Jisho: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  return (await res.json()) as JishoResponse;
}

function reqStr(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  return typeof v === 'string' ? v.trim() : '';
}

function clampLimit(v: unknown, def: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), 100);
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
