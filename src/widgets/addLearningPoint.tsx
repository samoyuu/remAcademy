import { usePlugin, renderWidget } from '@remnote/plugin-sdk';
import { useState } from 'react';
import { upsertLearningPoint } from '../commands/importLearningPoints';
import { deriveChapterSection } from '../lib/slowSchedule';
import type { LearningPoint, LPType } from '../lib/types';

const LP_TYPES: LPType[] = ['Concept', 'Definition', 'Derivation', 'Example', 'Problem-skill'];

export const AddLearningPoint = () => {
  const plugin = usePlugin();
  const [subject, setSubject] = useState('QM');
  const [id, setId] = useState('');
  const [type, setType] = useState<LPType>('Concept');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!id.trim() || !description.trim()) {
      setError('ID and Description are required.');
      return;
    }
    const parsed = deriveChapterSection(id.trim());
    if (!parsed) {
      setError('ID must look like "6.5.3" or, for a chapter problem, "6.P3".');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const lp: LearningPoint = {
        id: id.trim(),
        chapter: parsed.chapter,
        chapterTitle: '',
        section: parsed.section,
        sectionTitle: '',
        type,
        description: description.trim(),
      };
      await upsertLearningPoint(plugin, lp, subject.trim() || 'QM');
      await plugin.app.toast(`Learning point ${lp.id} created.`);
      await plugin.widget.closePopup();
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder?: string) => (
    <div className="mb-2">
      <label className="block text-xs opacity-70 mb-0.5">{label}</label>
      <input
        className="w-full p-1 border rounded text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );

  return (
    <div className="p-3 text-sm" style={{ width: 360 }}>
      <h1 className="text-lg font-semibold mb-2">Add Learning Point</h1>
      {field('Subject', subject, setSubject, 'QM')}
      {field('ID', id, setId, '1.1.1 (or 6.P3 for a chapter problem)')}
      <div className="text-xs opacity-70 mb-2">
        New chapter/section containers are created untitled - rename them directly in RemNote if you want a title.
      </div>
      <div className="mb-2">
        <label className="block text-xs opacity-70 mb-0.5">Type</label>
        <select
          className="w-full p-1 border rounded text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as LPType)}
        >
          {LP_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="mb-2">
        <label className="block text-xs opacity-70 mb-0.5">Description</label>
        <textarea
          className="w-full p-1 border rounded text-sm"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {error ? <div className="text-red-600 text-xs mb-2">{error}</div> : null}
      <div className="flex justify-end gap-2">
        <button className="text-xs underline" onClick={() => plugin.widget.closePopup()} disabled={saving}>
          Cancel
        </button>
        <button
          className="text-xs px-2 py-1 border rounded"
          onClick={submit}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Create'}
        </button>
      </div>
    </div>
  );
};

renderWidget(AddLearningPoint);
