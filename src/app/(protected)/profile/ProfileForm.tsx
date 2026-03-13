'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

interface Props {
  userId: string;
  initialName: string;
  initialLevel: string;
  initialGoal: string;
}

export default function ProfileForm({ userId, initialName, initialLevel, initialGoal }: Props) {
  const [name, setName] = useState(initialName);
  const [level, setLevel] = useState(initialLevel);
  const [goal, setGoal] = useState(initialGoal);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim(),
        german_level: level || null,
        learning_goal: goal.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    setSaving(false);
    if (updateError) {
      setError('Failed to save. Please try again.');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-5">
      <h2 className="text-white font-semibold">Learning Preferences</h2>

      {/* Name */}
      <div>
        <label className="block text-slate-400 text-sm mb-1.5" htmlFor="full_name">
          Display name
        </label>
        <input
          id="full_name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="Your name"
        />
      </div>

      {/* German level */}
      <div>
        <label className="block text-slate-400 text-sm mb-1.5">German level</label>
        <div className="flex gap-2 flex-wrap">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(level === l ? '' : l)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
                level === l
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Learning goal */}
      <div>
        <label className="block text-slate-400 text-sm mb-1.5" htmlFor="learning_goal">
          Learning goal
        </label>
        <textarea
          id="learning_goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
          placeholder="e.g. Pass the B2 exam, travel to Germany, communicate at work…"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="text-emerald-400 text-sm">Saved!</span>}
      </div>
    </form>
  );
}
