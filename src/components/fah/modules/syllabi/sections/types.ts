import type { AppData, Syllabus } from "@/lib/fah/types";

/** Props every syllabus editor section receives. `update` edits the unsaved draft only. */
export interface SectionProps {
  syllabus: Syllabus;
  update: (fn: (s: Syllabus) => Syllabus) => void;
  data: AppData;
}
