import type { AiTaskRegistry } from "../types";
import { syllabusOutcomeTasks } from "./syllabus-outcomes";
import { syllabusPlanTasks } from "./syllabus-plan";

// Syllabus AI tasks (PEO/PO/CLO alignment, learning plan generation, SILO suggestions).
// Outcome-alignment tasks ("suggest-peos", "suggest-clo-pos") live in ./syllabus-outcomes.ts.
export const syllabusTasks: AiTaskRegistry = {
  ...syllabusOutcomeTasks,
  ...syllabusPlanTasks,
};
