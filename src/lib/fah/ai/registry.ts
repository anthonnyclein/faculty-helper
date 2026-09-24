import type { AiTaskRegistry } from "./types";
import { syllabusTasks } from "./tasks/syllabus";
import { examTasks } from "./tasks/exam";
import { tosTasks } from "./tasks/tos";

export const AI_TASKS: AiTaskRegistry = { ...syllabusTasks, ...examTasks, ...tosTasks };
