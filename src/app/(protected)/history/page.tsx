import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const PAGE_SIZE = 20;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const { type, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) throw new Error('User not authenticated');

  let query = supabase
    .from('messages')
    .select('id, input_type, original_content, corrected_content, explanation, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (type && ['text', 'audio', 'image'].includes(type)) {
    query = query.eq('input_type', type);
  }

  const { data: messages, count, error } = await query;

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const typeColors: Record<string, string> = {
    text: 'bg-blue-500/20 text-blue-400',
    audio: 'bg-purple-500/20 text-purple-400',
    image: 'bg-amber-500/20 text-amber-400',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Correction History</h1>
        <p className="text-slate-400 mt-1">All your past AI corrections in one place.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[undefined, 'text', 'audio', 'image'].map((t) => (
          <Link
            key={t ?? 'all'}
            href={t ? `/history?type=${t}` : '/history'}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
              type === t || (!type && !t)
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {t ? t.charAt(0).toUpperCase() + t.slice(1) : 'All'}
          </Link>
        ))}
        {count != null && (
          <span className="ml-auto text-slate-500 text-sm self-center">{count} correction{count !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* List */}
      {messages && messages.length > 0 ? (
        <div className="space-y-3">
          {messages.map((msg) => {
            const inputType = String(msg.input_type ?? 'text');
            const original = String(msg.original_content ?? '');
            const corrected = String(msg.corrected_content ?? '');
            const explanation = String(msg.explanation ?? '');
            const date = new Date(msg.created_at).toLocaleString('en-US', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });

            return (
              <details key={msg.id} className="bg-white/5 border border-white/10 rounded-xl group">
                <summary className="flex items-center gap-3 p-4 cursor-pointer list-none">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${typeColors[inputType] ?? 'bg-slate-500/20 text-slate-400'}`}>
                    {inputType}
                  </span>
                  <p className="text-slate-300 text-sm truncate flex-1">{original.substring(0, 120)}</p>
                  <span className="text-slate-600 text-xs shrink-0">{date}</span>
                  <svg className="w-4 h-4 text-slate-500 shrink-0 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-4">
                  {original && (
                    <div>
                      <span className="text-slate-500 text-xs uppercase tracking-wide">Original</span>
                      <p className="text-slate-300 text-sm mt-1 whitespace-pre-wrap">{original}</p>
                    </div>
                  )}
                  {corrected && (
                    <div>
                      <span className="text-slate-500 text-xs uppercase tracking-wide">Corrected</span>
                      <p className="text-emerald-400 text-sm mt-1 whitespace-pre-wrap">{corrected}</p>
                    </div>
                  )}
                  {explanation && (
                    <div>
                      <span className="text-slate-500 text-xs uppercase tracking-wide">Explanation</span>
                      <p className="text-slate-400 text-sm mt-1 whitespace-pre-wrap">{explanation}</p>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500 text-sm">
          No corrections found.{' '}
          <Link href="/tutor" className="text-blue-400 hover:underline">Try the AI Tutor</Link>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/history?${type ? `type=${type}&` : ''}page=${page - 1}`}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white text-sm transition-colors"
            >
              ← Previous
            </Link>
          )}
          <span className="text-slate-500 text-sm px-2">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/history?${type ? `type=${type}&` : ''}page=${page + 1}`}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white text-sm transition-colors"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
