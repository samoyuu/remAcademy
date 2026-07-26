import { usePlugin, renderWidget } from '@remnote/plugin-sdk';
import { useEffect, useState } from 'react';
import { LP_POWERUP } from '../lib/powerups';
import { loadPrereqIndex } from '../lib/subjects';
import { recomputeAll } from '../commands/recomputeAll';

const prereqsBySubjectAndId = loadPrereqIndex();

interface Row {
  id: string;
  subject: string;
  chapter: string;
  section: string;
  description: string;
  stageStatus: string;
  masteryPct: string;
}

export const Dashboard = () => {
  const plugin = usePlugin();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('');
  const [subject, setSubject] = useState('All');
  const [loading, setLoading] = useState(false);
  const [notImported, setNotImported] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setNotImported(false);
    setLoadError(null);
    try {
      // getPowerupByCode throws rather than resolving to undefined when the
      // powerup code has never been registered in this graph (i.e. before
      // the user has run "LS: Import Learning Points" at least once).
      let lpPowerupRem;
      try {
        lpPowerupRem = await plugin.powerup.getPowerupByCode(LP_POWERUP.code);
      } catch (err: any) {
        console.error('qm-lp-tracker dashboard: getPowerupByCode threw', err);
        setLoadError(String(err?.message ?? err));
        lpPowerupRem = undefined;
      }
      if (!lpPowerupRem) {
        setRows([]);
        setNotImported(true);
        return;
      }
      console.log('qm-lp-tracker dashboard: resolved powerup rem', lpPowerupRem._id);
      const lpRems = await lpPowerupRem.taggedRem();
      console.log('qm-lp-tracker dashboard: taggedRem() returned', lpRems.length, 'rem');
      const next: Row[] = [];
      for (const rem of lpRems) {
        const id = String((await rem.getPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.id)) ?? '').trim();
        const subject = String((await rem.getPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.subject)) ?? '').trim();
        const chapter = String((await rem.getPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.chapter)) ?? '');
        const section = String((await rem.getPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.section)) ?? '');
        const stageStatus = String(
          (await rem.getPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.stageStatus)) ?? 'Not Started'
        );
        const masteryPct = String((await rem.getPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.masteryPct)) ?? '0');
        const description = (await plugin.richText.toString((rem.text as any) ?? [])) ?? '';
        next.push({ id, subject, chapter, section, description, stageStatus, masteryPct });
      }
      next.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      const counts: Record<string, number> = {};
      for (const r of next) counts[JSON.stringify(r.subject)] = (counts[JSON.stringify(r.subject)] ?? 0) + 1;
      console.log('qm-lp-tracker dashboard: rows per subject value', counts);
      setRows(next);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      // load() only re-reads whatever's already stored - it never
      // recalculates stageStatus/masteryPct itself. Recompute first so
      // "Refresh" actually reflects grading that happened since last load,
      // not just whatever the (possibly stale) automatic queue-completion
      // hook already wrote.
      await recomputeAll(plugin);
    } finally {
      await load();
    }
  };

  useEffect(() => {
    load();
  }, []);

  const subjects = ['All', ...Array.from(new Set(rows.map((r) => r.subject).filter(Boolean))).sort()];

  const visible = rows.filter(
    (r) =>
      (subject === 'All' || r.subject === subject) &&
      (filter.trim() === '' ||
        r.id.includes(filter) ||
        r.description.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="p-2 m-2 text-sm">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold">LS Learning Points</h1>
        <button className="text-xs underline" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <select
        className="w-full mb-2 p-1 border rounded"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      >
        {subjects.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <input
        className="w-full mb-2 p-1 border rounded"
        placeholder="Filter by ID or text…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {notImported ? (
        <div className="text-xs opacity-70">
          No learning points found. Run the "LS: Import Learning Points" command first.
          {loadError ? <div className="mt-1 text-red-600">Error: {loadError}</div> : null}
        </div>
      ) : (
      <>
      <div className="text-xs opacity-70 mb-1">{visible.length} of {rows.length} learning points</div>
      <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="pr-2">ID</th>
              <th className="pr-2">Subject</th>
              <th className="pr-2">Status</th>
              <th className="pr-2">%</th>
              <th className="pr-2">Prereqs</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="pr-2 whitespace-nowrap">{r.id}</td>
                <td className="pr-2 whitespace-nowrap">{r.subject}</td>
                <td className="pr-2 whitespace-nowrap">{r.stageStatus}</td>
                <td className="pr-2">{r.masteryPct}</td>
                <td className="pr-2 whitespace-nowrap">{(prereqsBySubjectAndId[`${r.subject}::${r.id}`] ?? []).join(', ')}</td>
                <td className="truncate" title={r.description}>{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
};

renderWidget(Dashboard);
