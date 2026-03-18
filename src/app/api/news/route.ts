// ─── German News Reader API ───────────────────────────────────────────────────
// GET ?cefr=A2 → fetch recent German news from Deutsche Welle RSS +
//               simplify to user's CEFR level via Azure OpenAI
// Returns: { articles: [{ title, original, simplified, vocabulary[], source, url }] }

import { NextRequest, NextResponse } from 'next/server';
import { withApiGuard } from '@/lib/api-guard';
import { fetchStudentContext } from '@/lib/student-model';

type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

interface NewsArticle {
  title: string;
  original: string;
  simplified: string;
  vocabulary: Array<{ word: string; translation: string; cefr: string }>;
  source: string;
  url: string;
  publishedAt: string;
}

// ─── DW RSS feeds by topic ────────────────────────────────────────────────────
const DW_FEEDS = [
  'https://rss.dw.com/rdf/rss-de-all',
  'https://rss.dw.com/rdf/rss-de-ger',
];

async function fetchRssArticles(limit = 5): Promise<Array<{ title: string; text: string; url: string; publishedAt: string }>> {
  const articles: Array<{ title: string; text: string; url: string; publishedAt: string }> = [];

  for (const feedUrl of DW_FEEDS) {
    try {
      const res = await fetch(feedUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Morodeutsch-NewsReader/1.0' },
      });
      if (!res.ok) continue;

      const xml = await res.text();

      // Simple XML parsing — extract <item> blocks
      const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
      for (const match of itemMatches) {
        const item = match[1];
        const title = extractXmlTag(item, 'title');
        const description = extractXmlTag(item, 'description');
        const link = extractXmlTag(item, 'link');
        const pubDate = extractXmlTag(item, 'pubDate');

        if (title && description) {
          // Strip HTML from description
          const text = description.replace(/<[^>]+>/g, '').trim();
          articles.push({ title, text, url: link ?? '', publishedAt: pubDate ?? '' });
        }

        if (articles.length >= limit) break;
      }
    } catch {
      // Skip failed feeds
    }
    if (articles.length >= limit) break;
  }

  return articles.slice(0, limit);
}

function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`));
  return match?.[1]?.trim() ?? null;
}

// ─── CEFR simplification via Azure OpenAI ─────────────────────────────────────

async function simplifyToCefr(
  title: string,
  text: string,
  targetCefr: DifficultyLevel
): Promise<{ simplified: string; vocabulary: NewsArticle['vocabulary'] }> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_GPT_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  if (!endpoint || !apiKey || !deployment || !apiVersion) {
    return { simplified: text, vocabulary: [] };
  }

  const prompt = `Rewrite this German news article at ${targetCefr} level for a German learner.

Title: ${title}
Text: ${text}

Rules:
- Keep the core meaning intact
- Use vocabulary appropriate for ${targetCefr} (${cefrDescription(targetCefr)})
- Shorten complex sentences to max 15 words each
- Replace advanced vocabulary with simpler alternatives
- Extract 3-5 key vocabulary items the student should know

Respond with valid JSON only:
{
  "simplified": "simplified German text here",
  "vocabulary": [
    { "word": "German word", "translation": "English meaning", "cefr": "${targetCefr}" }
  ]
}`;

  try {
    const res = await fetch(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: 600,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!res.ok) return { simplified: text, vocabulary: [] };

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { simplified: text, vocabulary: [] };

    const parsed = JSON.parse(content) as { simplified?: string; vocabulary?: NewsArticle['vocabulary'] };
    return {
      simplified: parsed.simplified ?? text,
      vocabulary: parsed.vocabulary ?? [],
    };
  } catch {
    return { simplified: text, vocabulary: [] };
  }
}

function cefrDescription(level: DifficultyLevel): string {
  const descriptions: Record<DifficultyLevel, string> = {
    A1: 'absolute beginner, basic phrases only',
    A2: 'elementary, simple present and past tense',
    B1: 'intermediate, can discuss familiar topics',
    B2: 'upper intermediate, can understand complex ideas',
    C1: 'advanced, fluent and flexible',
    C2: 'near native, full complexity',
  };
  return descriptions[level];
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const GET = withApiGuard(
  async (req: NextRequest, ctx) => {
    const searchParams = req.nextUrl.searchParams;
    const requestedCefr = (searchParams.get('cefr') as DifficultyLevel | null);

    // Use student's actual CEFR if not specified
    let targetCefr: DifficultyLevel = requestedCefr ?? 'B1';
    if (!requestedCefr && ctx.user) {
      try {
        const studentCtx = await fetchStudentContext(ctx.user.id);
        targetCefr = studentCtx.cefr_estimate as DifficultyLevel;
      } catch {
        targetCefr = 'B1';
      }
    }

    const rawArticles = await fetchRssArticles(4);

    if (rawArticles.length === 0) {
      return NextResponse.json({ articles: [], error: 'No articles available' });
    }

    // Simplify all articles in parallel (with concurrency limit = 2)
    const simplified: NewsArticle[] = [];
    for (let i = 0; i < rawArticles.length; i += 2) {
      const batch = rawArticles.slice(i, i + 2);
      const results = await Promise.all(
        batch.map(async article => {
          const { simplified: simplifiedText, vocabulary } = await simplifyToCefr(
            article.title,
            article.text,
            targetCefr
          );
          return {
            title: article.title,
            original: article.text,
            simplified: simplifiedText,
            vocabulary,
            source: 'Deutsche Welle',
            url: article.url,
            publishedAt: article.publishedAt,
          };
        })
      );
      simplified.push(...results);
    }

    return NextResponse.json({
      articles: simplified,
      targetCefr,
    });
  },
  {
    requireAuth: true,
    rateLimit: { requests: 10, window: 60 },
  }
);
