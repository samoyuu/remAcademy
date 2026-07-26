export type LPType = 'Concept' | 'Definition' | 'Derivation' | 'Example' | 'Problem-skill';

export interface LearningPoint {
  id: string;
  chapter: number;
  chapterTitle: string;
  section: string;
  sectionTitle: string;
  type: LPType;
  description: string;
}

export interface PrerequisiteEdge {
  prereq: string;
  requiresFor: string;
}

/**
 * The import format for one subject's knowledge graph: a single JSON file
 * dropped in src/data/subjects/<Subject>.json. Picked up automatically by
 * "LS: Import Learning Points" - no code changes needed to add a subject.
 *
 * - subject: short label (e.g. "QM"), used as the root document name in
 *   RemNote and prefixed onto each LP's bullet text for tag-picker
 *   disambiguation. Keep it short.
 * - learningPoints: every LP's id must be either "<chapter>.<section>.<n>"
 *   (e.g. "6.5.3") or, for a chapter-level multi-part problem, "<chapter>.P<n>"
 *   (e.g. "6.P3") - these shapes are parsed to auto-derive chapter/section
 *   elsewhere in the plugin. chapter/chapterTitle/section/sectionTitle are
 *   still given explicitly here (bulk import doesn't derive them) but MUST
 *   be consistent for every LP sharing the same chapter/section.
 * - prerequisites: prereq/requiresFor reference LP ids from the SAME
 *   subject's learningPoints array only - ids are not unique across subjects.
 */
export interface SubjectData {
  subject: string;
  learningPoints: LearningPoint[];
  prerequisites: PrerequisiteEdge[];
}

export type StageStatus = 'Not Started' | 'In Progress' | 'Mastered';

export type MasteryLevel = 'New' | 'Acquiring' | 'Growing' | 'Solidifying' | 'Retaining' | 'Stale';
