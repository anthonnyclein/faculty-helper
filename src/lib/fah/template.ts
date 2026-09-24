// Institutional template content transcribed from the uploaded reference files:
//   • "Syllabus Template.docx.pdf"  (9 pages, 14 × 8.5 in landscape)
//   • "Horizontal TOS Template.pdf" / "Vertical TOS Template.pdf" (Letter portrait)
// Wording is copied verbatim (including original spacing/punctuation). Do not edit here
// casually — faculty can change it through Templates & Settings → Institutional configuration.

import type { InstitutionalConfig, POCategory } from "./types";

export const TEMPLATE_SOURCE = {
  syllabus: {
    file: "Syllabus Template.docx.pdf",
    pageSize: { widthIn: 14, heightIn: 8.5, label: "Legal landscape (14 × 8.5 in)" },
    fonts: {
      body: "Book Antiqua 10 pt",
      courseInfo: "Book Antiqua Bold 11 pt",
      collegeName: "Monotype Corsiva 16 pt",
      syllabusCode: "Arial Italic 6 pt",
    },
  },
  tos: {
    files: ["Horizontal TOS Template.pdf", "Vertical TOS Template.pdf"],
    pageSize: { widthIn: 8.5, heightIn: 11, label: "US Letter portrait (8.5 × 11 in)" },
    fonts: { body: "Calibri 9–10 pt", title: "Arial Bold 15 pt", code: "Arial Italic 6.6 pt (red)" },
  },
};

export const PO_CATEGORY_TITLES: Record<POCategory, string> = {
  1: "Common to all Programs in all types of schools",
  2: "Common to the discipline",
  3: "Specific to the Information Technology Program",
  4: "Common to Horizontal Types (CMO 46 s. 2012)",
  5: "University Defined Program Outcomes",
};

export const DEFAULT_INSTITUTIONAL: InstitutionalConfig = {
  universityName: "Mindanao State University at Naawan",
  vision:
    "A forward-thinking university fostering innovations in research and education in aquatic and allied sciences.",
  mission:
    "To provide a culturally-sensitive, digitally-driven, and globally-engaged academic community committed to transformative research, education, innovation, and entrepreneurship programs for sustainable development",
  goals: [
    "To transform MSU at Naawan as a hub for inclusive and dynamic research, extension, and entrepreneurial initiatives, addressing local and global challenges through interdisciplinary collaborations toward sustainable development.",
    "To provide education programs that produce holistic leaders-professionals laden with future-ready skills; and",
    "To sustain a culture of transparency, accountability, participatory, and predictability in governing the institution and its constituents.",
  ],
  coreValues: ["Mission-driven", "Sustainable", "United", "Nurturing"],
  peoIntro: "Graduates of the Mindanao State University at Naawan are expected to:",
  peos: [
    {
      code: "PEO 1",
      description:
        "demonstrate competence, ethical practice, and leadership in education, business, technology, fisheries, environmental, and life science-related fields;",
    },
    {
      code: "PEO 2",
      description:
        "engage in interdisciplinary research, innovation, and entrepreneurial initiatives that address societal, environmental, and economic challenges, particularly in aquatic and allied sciences;",
    },
    {
      code: "PEO 3",
      description:
        "adapt to the rapid growth of digitalization in pursuit of continuous professional development, while upholding social responsibility, environmental stewardship, transparency, and accountability in the workplace and community; and",
    },
    {
      code: "PEO 4",
      description: "collaborate across sectors and cultures to respond to local and global development needs.",
    },
  ],
  poCategoryTitles: PO_CATEGORY_TITLES,
  poCategoryIntros: {
    2: "A graduate of BS in Information Technology degree should be able to:",
    3: "A graduate of Information Technology degree should be able to:",
    4: "A graduate of BS in Information Technology degree should be able to:",
  },
  category1: [
    { id: "tpl-po-1", description: "Articulate and discuss the latest developments in the specific field of practice.", peos: ["PEO 1", "PEO 3"] },
    { id: "tpl-po-2", description: "Effectively communicate orally and in writing using both Filipino and English.", peos: ["PEO 1", "PEO 4"] },
    { id: "tpl-po-3", description: "Work effectively and independently in multi-disciplinary and multi-cultural teams.", peos: ["PEO 1", "PEO 4"] },
    { id: "tpl-po-4", description: "Act in recognition of professional, social, and ethical responsibility.", peos: ["PEO 1", "PEO 3"] },
    { id: "tpl-po-5", description: "Preserve and promote Filipino historical and cultural heritage.", peos: ["PEO 3", "PEO 4"] },
  ],
  category4: [
    {
      id: "tpl-po-17",
      description: "Graduates of universities participate in the generation of new knowledge in research and development projects.",
      peos: ["PEO 2"],
    },
    {
      id: "tpl-po-18",
      description:
        "Apply ethical principles, legal standards, and social responsibility in the practice of Information Technology, contributing to national development and global competitiveness.",
      peos: ["PEO 3"],
    },
  ],
  category5: [
    {
      id: "tpl-po-19",
      description:
        "Demonstrate competence in the analysis, design, development, implementation, and management of IT solutions that meet industry standards and organizational needs.",
      peos: ["PEO 1", "PEO 2"],
    },
    {
      id: "tpl-po-20",
      description:
        "Apply ethical principles, legal standards, and social responsibility in the practice of Information Technology, contributing to industry, national development and global competitiveness.",
      peos: ["PEO 3", "PEO 4"],
    },
  ],
  defaultRequirements: ["Exams", "Class Policies"],
  defaultClassPolicies: [
    "A student with 3 consecutive unexcused absences will be reported to the Department Chairperson and College Dean.",
    "Students are required to take all the major exams on the scheduled day, time, and room.  Arrangements will be made with the instructor/s concerned if the student would take the exam before the scheduled date, but not after the scheduled exam except for special cases (to be evaluated by the Department). It is the student’s responsibility to notify his/her instructors if he/she misses the exam. The instructor concerned will evaluate the validity of his/her reasons and will determine if the student is eligible to take a special exam.",
    "There will be no make-up exams (major exams) for unexcused absences and a grade of zero recorded. Make-up exams will be allowed only for excused absences. If the absences are due to sickness, appropriate medical certificate will be submitted (for further validation). If the absences are due to school activities, proper documentation must be presented.",
    "Students are required to submit all the set requirements to the agreed deadlines. Failure to submit the agreed deadlines will incur some point deductions (depends on the instructor/s concerned). Tardiness is greatly discouraged in this course. Students are required to come to the class on time.",
    "Students are encouraged to observe proper etiquette in the class. Likewise, bullying is strictly prohibited in this course. Any student caught on the act of bullying will be reported to the Office of Students Affair for further disciplinary action.",
    "Academic dishonesty will not be tolerated. Any student found to have participated in any acts of academic dishonesty will receive a grade of “5.0” in the course, and maybe subject to further disciplinary action. The University Code prohibits students from committing the following acts of dishonesty: academic fraud, copying or allowing one’s work to be copied, fabrication/falsification, sabotage of other’s work, substitution (e.g. taking an exam for someone else), among others.",
    "The use of electronic gadgets during exams is strictly not allowed. Students caught using electronic gadgets during exams are required to surrender his/her gadgets to the instructor and these can be claimed after the exam.\n\nElectronic gadgets cannot be used in lieu of the calculator during the exam.",
    "Students are encouraged to utilize the instructor’s consultation time (see instructor’s schedule).",
  ],
  defaultGrading: [
    { component: "Major Tasks", weight: 40 },
    { component: "Minor Tasks", weight: 20 },
    { component: "Examinations", weight: 40 },
  ],
  defaultPassingRate: "Passing rate is 60%.",
  dimensionEvaluationSubtitle: "Example",
  defaultDimensionEvaluation: [
    { level: "Remembering", prelim: 20, midterm: 20, finals: 10 },
    { level: "Understanding", prelim: 30, midterm: 10, finals: 10 },
    { level: "Applying", prelim: 30, midterm: 30, finals: 30 },
    { level: "Analyzing", prelim: 10, midterm: 30, finals: 30 },
    { level: "Evaluating", prelim: 10, midterm: 10, finals: 10 },
    { level: "Creating", prelim: null, midterm: null, finals: 10 },
  ],
  finalGradeStatement:
    "The final grade corresponding to the student’s general average is given on the table below. Any deviation from this grading system must be approved by the Dean.",
  criteriaForGrading: [
    "1) Refer to MSUN code for approved criteria)",
    "2) Credit (CRDT) will be given as remarks for students passing class standing on an enrolled course but lack necessary requirements; nonetheless, this does not prevent student from enrolling subsequent course that requires the course as pre- requisite.",
    "(A memo from the OVCAA for the mechanics of giving CRDT will follow.)",
  ],
  transmutation: [
    { id: "tr-1", grade: "1.0", range: "95. 64 – 100.00" },
    { id: "tr-2", grade: "1.25", range: "91. 18 - 95. 63" },
    { id: "tr-3", grade: "1.50", range: "86. 73 - 91. 17" },
    { id: "tr-4", grade: "1.75", range: "82. 27 - 86. 72" },
    { id: "tr-5", grade: "2.00", range: "77. 82 - 82. 26" },
    { id: "tr-6", grade: "2.25", range: "73. 36 - 77. 81" },
    { id: "tr-7", grade: "2.50", range: "68. 91 - 73. 35" },
    { id: "tr-8", grade: "2.75", range: "64. 45 - 68. 90" },
    { id: "tr-9", grade: "3.00", range: "60.00 - 64. 44" },
    { id: "tr-10", grade: "5.00", range: "59.99 and below" },
  ],
  circulatingMaterials:
    "All the uploaded lecture materials (PDF, PowerPoint) are copyrighted. Students are allowed to photocopy or reproduce subject to the approval of the instructor.",
  swdStatement:
    "Students with disabilities: Your access to this course is important. Please submit your SWD/PWD certificate early in the semester so that we have adequate time to arrange your approved accommodation. If you need immediate accommodation for equal access, please coordinate with the Department Chairperson.",
  attendanceStatement:
    "Complete attendance from the students is required on this course. Students who have 3 consecutive absences will be reported to the Department Chairperson and College Dean for further evaluation.",
  gadThemes: [
    "Gender-fair language in the discussion.",
    "Gender identity",
    "Gender roles",
    "Gender representation in media, art, and literature",
    "Gender equality across disciplines",
    "Diversity of learners",
  ],
  scheduleNote: "This schedule is subject to change as the need arises to accommodate school-related activities/local holidays.",
  learningCommitmentAgreement:
    "I have read the course syllabus, and I understand that I have to comply with the requirements of the course and the expectations from me as a student of {courseCode} during the {semester}, AY {academicYear}. I am fully aware of the consequences of non-compliance with the above-mentioned requirements and expectations.",
  tosCognitiveLevels: ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"],
  tosLowerOrderCount: 3,
};

/**
 * Category 2 and 3 outcomes printed in the reference syllabus. They seed the IT Program
 * Outcomes library; their printed PEO mappings are kept only as reference hints.
 */
export const TEMPLATE_LIBRARY_POS: {
  code: string;
  description: string;
  category: "discipline" | "it-specific";
  referencePeos: string[];
  referenceNote?: string;
}[] = [
  {
    code: "PO 6",
    category: "discipline",
    description: "Analyze complex problems and identify and define the computing requirements needed to design an appropriate solution.",
    referencePeos: ["PEO 1", "PEO 3"],
    referenceNote: "Template prints “PEO1, PEO 3, PO4”. “PO4” is not a PEO code — verify the intended mapping.",
  },
  { code: "PO 7", category: "discipline", description: "Apply computing and other knowledge domains to address real-world problem.", referencePeos: ["PEO 1", "PEO 2"] },
  { code: "PO 8", category: "discipline", description: "Design and develop computing solutions using a system-level perspective.", referencePeos: ["PEO 1", "PEO 2"] },
  { code: "PO 9", category: "discipline", description: "Utilize modern computing tools.", referencePeos: ["PEO 3", "PEO 4"] },
  {
    code: "PO 10",
    category: "it-specific",
    description: "Apply knowledge of computing, science, and mathematics appropriate to the discipline.",
    referencePeos: ["PEO 2", "PEO 3"],
    referenceNote: "In the template the category intro row also carries “PEO 1, PEO 2”; the PEO column may be offset by one row.",
  },
  { code: "PO 11", category: "it-specific", description: "Analyze complex problems and identify and define the computing requirements appropriate to its solutions.", referencePeos: ["PEO 1"] },
  {
    code: "PO 12",
    category: "it-specific",
    description:
      "Design, implement, and evaluate computer-based systems, processes, components, or programs to meet desired needs and requirements under various constraints.",
    referencePeos: ["PEO 3"],
  },
  { code: "PO 13", category: "it-specific", description: "Integrate IT-based solutions into the user environment effectively", referencePeos: ["PEO 1", "PEO 2"] },
  {
    code: "PO 14",
    category: "it-specific",
    description: "Apply knowledge through the use of current techniques, skills, tools and practices necessary for the IT profession.",
    referencePeos: ["PEO 1", "PEO 2"],
  },
  {
    code: "PO 15",
    category: "it-specific",
    description: "Analyze the local and global impact of computing information technology on individuals, organization, and society",
    referencePeos: ["PEO 4"],
  },
  {
    code: "PO 16",
    category: "it-specific",
    description:
      "Recognize the need for and engage in planning self-learning and improving performance as a foundation for continuing professional development",
    referencePeos: ["PEO 1", "PEO 2", "PEO 3"],
  },
];

/** Known differences between the uploaded references and the written requirements. Shown in Templates & Settings. */
export const TEMPLATE_DISCREPANCIES: { id: string; area: string; detail: string; resolution: string }[] = [
  {
    id: "paper",
    area: "Syllabus paper size",
    detail: "The reference syllabus is 14 × 8.5 in (Legal, landscape). The requirements ask for a custom 11 × 13 in landscape page (13 in wide × 11 in high).",
    resolution: "Choose the paper size explicitly in Templates & Settings. The requested 13 × 11 in size is preselected; header, footer and margins scale to the chosen width.",
  },
  {
    id: "exam-weeks",
    area: "Examination weeks",
    detail: "The reference plan shows Week 8 Prelim and Week 13 Midterm examinations, then Final Examinations after Week 18. The requirements reserve Weeks 7, 14 and 18.",
    resolution: "Weeks 7/14/18 are used by default and are configurable in Templates & Settings.",
  },
  {
    id: "plan-columns",
    area: "Course Learning Plan columns",
    detail: "The reference table has Timeline · Learning Content · Specific Intended Learning Outcomes · Teaching and Learning Activities · Assessment · Instructional Material References. The requirements add a Corresponding CLOs column.",
    resolution: "Both the Corresponding CLOs and Instructional Material References columns can be shown or hidden in the export.",
  },
  {
    id: "units",
    area: "Units and hours",
    detail: "The reference course information table prints only “No. of Units”. Lecture and laboratory hours are stored separately but have no printed location in the reference.",
    resolution: "Hours are hidden in the export by default; an option appends them to the units cell.",
  },
  {
    id: "grading-position",
    area: "Grading System position",
    detail: "In the reference, “Grading System” is item i. (the last item) under Class Policies. The requirements describe it as the third item.",
    resolution: "The reference position is used by default; the grading item can be reordered like any other policy item.",
  },
  {
    id: "exam-terms",
    area: "Exam term names",
    detail: "The TOS reference labels periods “Prelim · Midterm · Final”. The requirements use First Prelim · Second Prelim · Finals.",
    resolution: "The TOS marks First Prelim → Prelim, Second Prelim → Midterm, Finals → Final.",
  },
  {
    id: "tos-paper",
    area: "TOS paper size",
    detail: "Both TOS references are US Letter (8.5 × 11 in) portrait. The requirements ask for A4 portrait.",
    resolution: "TOS exports use A4 portrait (8.27 × 11.69 in) as requested.",
  },
  {
    id: "fonts",
    area: "Fonts",
    detail: "The references use Book Antiqua, Monotype Corsiva, Arial and Calibri. Browsers can only use fonts installed on the device.",
    resolution: "If a font is missing, the closest available font is substituted (Palatino-family, Arimo, Carlito). Check the exported PDF against the reference before official use.",
  },
];

export const EXAM_TERM_TO_TOS_PERIOD: Record<string, "Prelim" | "Midterm" | "Final"> = {
  "First Prelim": "Prelim",
  "Second Prelim": "Midterm",
  Finals: "Final",
};
