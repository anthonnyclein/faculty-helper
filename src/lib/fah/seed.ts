// Initial data: template-derived IT Program Outcomes (institutional, not demo) plus clearly
// labeled demonstration records (isDemo: true) that can be removed from Templates & Settings.
// Everything here is synchronous and deterministic: stable ids containing "demo", fixed timestamps.
import { TEMPLATE_LIBRARY_POS } from "./template";
import { newExam, newSyllabus, blankTos } from "./factories";
import type {
  AppData,
  CLO,
  Exam,
  ExamSection,
  LearningPlanItem,
  LibraryPO,
  Person,
  Question,
  Resource,
  Syllabus,
  SyllabusPO,
  Tos,
  TosMapping,
} from "./types";

const T0 = "2026-01-05T08:00:00.000Z";
const T1 = "2026-01-12T09:30:00.000Z";

export function templateLibraryPOs(): LibraryPO[] {
  return TEMPLATE_LIBRARY_POS.map((p, i) => ({
    id: `lpo_tpl_${i + 1}`,
    createdAt: T0,
    updatedAt: T0,
    code: p.code,
    description: p.description,
    category: p.category,
    status: "active",
    referencePeos: p.referencePeos,
    referenceNote: p.referenceNote,
    version: 1,
    fromTemplate: true,
  }));
}

export function demoPeople(): Person[] {
  const mk = (id: string, name: string, roles: Person["roles"]): Person => ({
    id,
    createdAt: T0,
    updatedAt: T0,
    isDemo: true,
    name,
    roles,
    department: "Department of Information Technology",
  });
  return [
    mk("per_demo_1", "DR. FLORDELINE A. CADELIÑA", ["faculty"]),
    mk("per_demo_2", "WENDELL S. GALEOS", ["faculty"]),
    mk("per_demo_3", "CRIS NIEL ANTHONNY M. GULFAN", ["faculty", "chair"]),
    mk("per_demo_4", "DR. LILIBETH P. CORONEL", ["dean"]),
  ];
}

/* ------------------------------------------------------------------ */
/* Demo resources                                                      */
/* ------------------------------------------------------------------ */

const DEMO_SYL_ID = "syl_demo_ite153";
const DEMO_EXAM_ID = "exam_demo_ite153_p1";
const DEMO_TOS_ID = "tos_demo_ite153_p1";
const RES_TEXT = "res_demo_notes";
const RES_BOOK = "res_demo_book";
const RES_URL = "res_demo_url";

/** Original demonstration text written for this prototype (not copied from any source). */
const DEMO_NOTES = `Web Systems Fundamentals — Lecture Notes (Demonstration)

1. The client–server model
Every interaction on the web is a conversation between two programs. The client, usually a web browser, asks for something; the server, a program running on a machine connected to the network, answers. The client never reaches directly into the server's files. Instead it sends a structured request and waits for a structured response. This separation lets millions of different devices use the same service, and it lets the people who run the server change how it works internally without breaking the clients, as long as the conversation keeps the same shape.

Before a browser can talk to a server it needs the server's numeric address. People type names such as www.example.org, so the browser first asks the Domain Name System (DNS) to translate the name into an IP address. Only then can it open a connection, normally protected with TLS so that the traffic cannot be read or altered on the way.

2. HTTP: requests and responses
The Hypertext Transfer Protocol (HTTP) defines the conversation. A request names a method, a path and a set of headers. GET asks for a representation of a resource and should not change anything on the server. POST sends data, for example the contents of a form, and usually creates or changes something. PUT and DELETE replace or remove resources, and HEAD asks only for the headers.

The server replies with a status code, headers and, usually, a body. Status codes are grouped by their first digit: 2xx means success (200 OK, 201 Created), 3xx means the client should look elsewhere (301 Moved Permanently), 4xx means the request itself had a problem (400 Bad Request, 403 Forbidden, 404 Not Found), and 5xx means the server failed while handling a valid request (500 Internal Server Error). Headers carry information about the message: Content-Type tells the browser whether the body is HTML, CSS, JSON or an image, and Cache-Control tells it how long the response may be reused.

HTTP is stateless: each request stands on its own. Applications that need to remember a signed-in user attach a small token to every request, usually in a cookie, and the server looks that token up.

3. HTML: structure and meaning
HyperText Markup Language describes what the parts of a document are. A heading is marked with h1 to h6, a paragraph with p, a list with ul or ol, and a link with a. Semantic elements such as header, nav, main, article and footer describe the role of a region, which helps screen readers, search engines and other developers understand the page. Images need an alt attribute that describes their purpose; forms need label elements connected to their inputs. Good structure comes first: a page that is well organised without any styling is easier to style, easier to maintain and usable by more people.

4. CSS: presentation
Cascading Style Sheets control how the structure is displayed. A rule has a selector and a block of declarations. When several rules target the same element, the browser decides which one wins by specificity (an id selector outranks a class, which outranks an element name) and then by source order. Every element is drawn as a box made of content, padding, border and margin. Modern layouts use flexbox for arranging items along one axis and grid for two-dimensional layouts. Media queries apply rules only when the viewport meets a condition, which is the basis of responsive design: one page that adapts to phones, tablets and desktops.

5. JavaScript: behaviour
JavaScript runs inside the browser and can read and change the Document Object Model (DOM), the tree of objects the browser builds from the HTML. Scripts react to events such as clicks, key presses and form submissions. With the fetch function a script can request data from a server in the background, receive JSON, and update only the part of the page that changed instead of reloading everything. Because network requests take time, this code is asynchronous: it continues when the response arrives, using promises or the async and await keywords.

6. Putting the layers together
A useful habit is to keep the three layers separate: HTML for meaning, CSS for appearance, JavaScript for behaviour, and the server for data and rules that must be trusted. Anything that runs in the browser can be inspected and changed by the user, so validation that protects data must always be repeated on the server.`;

function countWords(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function demoResources(): Resource[] {
  const base = {
    createdAt: T0,
    updatedAt: T0,
    isDemo: true,
    purpose: "instructional" as const,
    edition: "",
    doi: "",
    notes: "",
  };
  return [
    {
      ...base,
      id: RES_TEXT,
      title: "Web Systems Fundamentals: Lecture Notes (Demonstration)",
      type: "text",
      authors: "Department of Information Technology",
      year: "2026",
      publisher: "Mindanao State University at Naawan",
      url: "",
      fileName: "web-systems-lecture-notes.txt",
      status: "extracted",
      statusMessage: "Demonstration text written for this prototype. Readable content is available for AI use.",
      content: DEMO_NOTES,
      wordCount: countWords(DEMO_NOTES),
      linkedSyllabusIds: [DEMO_SYL_ID],
      linkedExamIds: [DEMO_EXAM_ID],
      notes: "Original demonstration notes covering the client–server model, HTTP, HTML, CSS and JavaScript.",
    },
    {
      ...base,
      id: RES_BOOK,
      title: "HTML and CSS: Design and build websites",
      type: "book",
      authors: "Duckett, J.",
      year: "2011",
      publisher: "John Wiley & Sons",
      url: "",
      status: "metadata-only",
      statusMessage: "Bibliographic information only — not analyzed source material. Add text to enable AI use.",
      content: "",
      wordCount: 0,
      linkedSyllabusIds: [DEMO_SYL_ID],
      linkedExamIds: [],
      notes: "Manual book entry used as a course reference.",
    },
    {
      ...base,
      id: RES_URL,
      title: "Course reading pack (learning management system link)",
      type: "url",
      authors: "",
      year: "",
      publisher: "",
      url: "https://lms.example.edu/courses/ite153/readings",
      status: "inaccessible",
      statusMessage:
        "The page could not be read (HTTP 403 — sign-in required). Links behind a login, or pages built entirely with JavaScript, cannot be fetched. Download the material and upload the file, or paste the text manually.",
      content: "",
      wordCount: 0,
      linkedSyllabusIds: [],
      linkedExamIds: [],
      notes: "Example of a link that could not be accessed.",
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Demo syllabus                                                       */
/* ------------------------------------------------------------------ */

function lib(pos: LibraryPO[], code: string): LibraryPO {
  const p = pos.find((x) => x.code === code);
  if (!p) throw new Error(`[seed] template library PO ${code} not found`);
  return p;
}

function demoSyllabus(data: AppData): Syllabus {
  const s = newSyllabus(data);
  // Deterministic ids for everything newSyllabus generated.
  s.id = DEMO_SYL_ID;
  s.createdAt = T0;
  s.updatedAt = T1;
  s.isDemo = true;
  s.programOutcomes.forEach((p, i) => (p.id = `spo_demo_t${i + 1}`));
  s.requirements.forEach((r, i) => (r.id = `req_demo_${i + 1}`));
  s.classPolicies.forEach((r, i) => (r.id = `pol_demo_${i + 1}`));
  s.grading.rows.forEach((r, i) => (r.id = `gr_demo_${i + 1}`));
  s.dimensionEvaluation.forEach((r, i) => (r.id = `dim_demo_${i + 1}`));

  s.collegeName = "College of Business and Information Technology";
  s.syllabusCode = "MSUN-CBIT-SYL-ITE153-2026-REV00";
  s.courseCode = "ITE 153";
  s.descriptiveTitle = "Web Systems and Technologies";
  s.prerequisite = "ITE 112 (Computer Programming 2)";
  s.corequisite = "None";
  s.units = 3;
  s.lectureHours = 2;
  s.labHours = 3;
  s.semester = "2nd Semester";
  s.academicYear = "2025-2026";
  s.courseDescription =
    "This course introduces the concepts, technologies and practices used to build web systems. Students examine the client–server model and the HTTP protocol, structure content with semantic HTML, present it with CSS using responsive layouts, and add behaviour with JavaScript and the DOM. The course ends with server-side request handling, data persistence, basic web security and deployment, and students apply these in a small web application project.";

  const mk = (code: string, category: 2 | 3, note: string): SyllabusPO => {
    const l = lib(data.libraryPOs, code);
    return {
      id: `spo_demo_${code.replace(/\s+/g, "").toLowerCase()}`,
      category,
      description: l.description,
      peos: [...(l.referencePeos ?? [])],
      source: "library",
      libraryId: l.id,
      libraryVersion: l.version,
      mappingSource: "demo",
      alignmentNote: note,
    };
  };
  const po7 = mk("PO 7", 2, "Students apply web technologies to real information-sharing problems (demonstration mapping).");
  const po8 = mk("PO 8", 2, "The course project requires designing a web system across client, server and data layers (demonstration mapping).");
  const po11 = mk("PO 11", 3, "Students analyze how requests travel between client and server to define requirements (demonstration mapping).");
  const po12 = mk("PO 12", 3, "Students design, implement and evaluate interactive web components (demonstration mapping).");
  const po13 = mk("PO 13", 3, "Deployment and usability evaluation integrate the solution into the user environment (demonstration mapping).");
  const po14 = mk("PO 14", 3, "Students use current tools and practices: HTML, CSS, JavaScript and browser developer tools (demonstration mapping).");
  const added = [po7, po8, po11, po12, po13, po14];
  s.programOutcomes = [...s.programOutcomes, ...added];
  s.addressedPoIds = added.map((p) => p.id);

  const clo = (n: number, statement: string, poIds: string[]): CLO => ({
    id: `clo_demo_${n}`,
    code: `CLO ${n}`,
    statement,
    poIds,
    mappingSource: "demo",
    alignmentNote: "Demonstration mapping — review before official use.",
  });
  s.clos = [
    clo(1, "Explain the client–server model, the Domain Name System and the HTTP request–response cycle used by web systems.", [po7.id, po11.id]),
    clo(2, "Build semantic, accessible and responsive web pages using HTML and CSS.", [po8.id, po14.id]),
    clo(3, "Implement client-side interactivity using JavaScript, DOM events and asynchronous requests.", [po12.id, po14.id]),
    clo(4, "Design, deploy and evaluate a small web application that integrates front-end pages with server-side processing and data.", [po8.id, po12.id, po13.id]),
  ];
  const [c1, c2, c3, c4] = s.clos.map((c) => c.id);

  const exams = s.learningPlan.filter((l) => l.kind === "exam");
  exams.forEach((e, i) => (e.id = `lp_demo_exam_${i + 1}`));
  const lesson = (
    n: number,
    weekStart: number,
    weekEnd: number | null,
    content: string,
    silos: string,
    cloIds: string[],
    activities: string,
    assessment: string,
    materials: string
  ): LearningPlanItem => ({
    id: `lp_demo_${n}`,
    weekStart,
    weekEnd,
    kind: "lesson",
    content,
    silos,
    cloIds,
    activities,
    assessment,
    materials,
    origin: "demo",
    sourceResourceIds: [RES_TEXT],
  });
  const lessons: LearningPlanItem[] = [
    lesson(
      1, 1, null,
      "Orientation: MSU at Naawan Vision, Mission, Goals and Core Values (VMGO); Course Syllabus, Class Policies and Grading System",
      "Explain the Vision, Mission, Goals and Core Values of the University\nDiscuss the course outcomes, requirements and class policies",
      [],
      "Class discussion\nSyllabus walkthrough",
      "Recitation",
      "Course syllabus; University Student Handbook"
    ),
    lesson(2, 2, null, "Introduction to Web Systems: history of the web, the client–server model, how browsers work",
      "Describe the roles of clients and servers\nExplain what happens when a URL is entered in a browser",
      [c1], "Lecture-discussion\nBrowser developer tools walkthrough", "Short quiz", "Lecture Notes §1"),
    lesson(3, 3, null, "HTTP and DNS: requests, responses, methods, status codes and headers; URLs and name resolution",
      "Differentiate HTTP methods and status code classes\nInspect real HTTP traffic using developer tools",
      [c1], "Lecture-discussion\nLaboratory: inspecting network requests", "Laboratory exercise 1", "Lecture Notes §2"),
    lesson(4, 4, null, "HTML Fundamentals: document structure, semantic elements, links, images, lists and tables",
      "Write a well-structured HTML document\nUse semantic elements appropriately",
      [c2], "Lecture-demonstration\nLaboratory: building a personal profile page", "Laboratory exercise 2", "Duckett (2011), Ch. 1–8; Lecture Notes §3"),
    lesson(5, 5, 6, "HTML Forms and Accessibility; CSS Basics: selectors, the cascade, specificity and the box model",
      "Build accessible forms with labelled controls\nApply CSS rules and predict which rule wins",
      [c2], "Lecture-demonstration\nPair programming\nLaboratory: styling the profile page", "Laboratory exercise 3\nQuiz 1", "Duckett (2011), Ch. 7, 10–13; Lecture Notes §4"),
    lesson(6, 8, 9, "CSS Layout: flexbox, grid, responsive design and media queries",
      "Create responsive layouts using flexbox and grid\nAdapt a page to different screen sizes with media queries",
      [c2], "Lecture-demonstration\nLaboratory: responsive landing page", "Laboratory exercise 4", "Duckett (2011), Ch. 15–17; Lecture Notes §4"),
    lesson(7, 10, null, "JavaScript Fundamentals: variables, data types, operators, functions and control flow",
      "Write basic JavaScript programs\nTrace the execution of simple scripts",
      [c3], "Lecture-discussion\nCoding exercises", "Laboratory exercise 5", "Lecture Notes §5"),
    lesson(8, 11, 12, "The DOM and Events: selecting and changing elements, event listeners, client-side form validation",
      "Manipulate page content through the DOM\nValidate form input before submission",
      [c3], "Lecture-demonstration\nLaboratory: interactive to-do list", "Laboratory exercise 6\nQuiz 2", "Lecture Notes §5"),
    lesson(9, 13, null, "Asynchronous JavaScript: promises, async/await, the fetch API and JSON",
      "Retrieve JSON data from a web API\nUpdate part of a page without reloading",
      [c1, c3], "Lecture-demonstration\nLaboratory: consuming a public API", "Laboratory exercise 7", "Lecture Notes §2, §5"),
    lesson(10, 15, null, "Server-side Basics: routing, handling requests and returning responses",
      "Explain how a server processes a request\nImplement simple routes that return HTML and JSON",
      [c1, c4], "Lecture-demonstration\nLaboratory: a minimal web server", "Laboratory exercise 8", "Lecture Notes §1–2, §6"),
    lesson(11, 16, null, "Data Persistence and Web Security Basics: databases, sessions, HTTPS and server-side validation",
      "Store and retrieve data for a web application\nIdentify common security risks and their mitigations",
      [c4], "Lecture-discussion\nCase analysis\nProject consultation", "Project milestone 1", "Lecture Notes §6"),
    lesson(12, 17, null, "Deployment and Evaluation: publishing a web application; performance and accessibility checks; project presentation",
      "Deploy a web application\nEvaluate a web application against usability and accessibility criteria",
      [c4], "Project presentation\nPeer evaluation", "Final project (rubric)", "Lecture Notes §6"),
  ];
  s.learningPlan = [...lessons, ...exams].sort((a, b) => a.weekStart - b.weekStart);

  s.references = [
    {
      id: "ref_demo_1",
      resourceId: RES_BOOK,
      origin: "resource",
      authors: "Duckett, J.",
      year: "2011",
      title: "HTML and CSS: Design and build websites",
      publisher: "John Wiley & Sons",
    },
    {
      id: "ref_demo_2",
      resourceId: RES_TEXT,
      origin: "resource",
      authors: "Department of Information Technology",
      year: "2026",
      title: "Web Systems Fundamentals: Lecture Notes (Demonstration)",
      publisher: "Mindanao State University at Naawan",
    },
  ];

  const people = data.people;
  const ref = (id: string, title: string) => {
    const p = people.find((x) => x.id === id);
    return { personId: id, name: p?.name ?? "", title, dateSigned: "" };
  };
  s.preparedBy = [ref("per_demo_1", "Faculty"), ref("per_demo_2", "Faculty")];
  s.reviewedBy = ref("per_demo_3", "Department Chairperson");
  s.approvedBy = ref("per_demo_4", "Dean");
  s.revision = { number: "00", dateRevised: "", effectivity: "" };
  s.resourceIds = [RES_TEXT, RES_BOOK];
  return s;
}

/* ------------------------------------------------------------------ */
/* Demo exam                                                           */
/* ------------------------------------------------------------------ */

function demoExam(syl: Syllabus): Exam {
  const e = newExam();
  const [c1, c2, c3, c4] = syl.clos.map((c) => c.id);
  e.id = DEMO_EXAM_ID;
  e.createdAt = T0;
  e.updatedAt = T1;
  e.isDemo = true;
  e.courseCode = syl.courseCode;
  e.courseTitle = syl.descriptiveTitle;
  e.semester = syl.semester;
  e.academicYear = syl.academicYear;
  e.term = "First Prelim";
  e.title = "First Preliminary Examination";
  e.instructions = "Read each item carefully. Write your answers on the answer sheet provided. Erasures on final answers are not allowed.";
  e.coverage = "Weeks 1–6: client–server model, HTTP and DNS, HTML fundamentals and forms, CSS basics, introduction to JavaScript";
  e.syllabusId = syl.id;
  e.resourceIds = [RES_TEXT];
  e.source = "manual";
  e.numbering = "continuous";
  e.revision = 1;

  let qn = 0;
  const mc = (prompt: string, choices: string[], correct: number, cloId: string, level: string, topic: string): Question => {
    qn++;
    const ids = choices.map((_, i) => `ch_demo_${qn}_${"abcd"[i]}`);
    return {
      id: `q_demo_${qn}`,
      prompt,
      choices: choices.map((text, i) => ({ id: ids[i], text })),
      correctChoiceId: ids[correct],
      points: null,
      topic,
      cloId,
      cognitiveLevel: level,
      origin: "demo",
      sourceResourceIds: [RES_TEXT],
    };
  };
  const idq = (prompt: string, answerKey: string, cloId: string, level: string, topic: string): Question => {
    qn++;
    return { id: `q_demo_${qn}`, prompt, answerKey, points: null, topic, cloId, cognitiveLevel: level, origin: "demo", sourceResourceIds: [RES_TEXT] };
  };
  const essay = (prompt: string, answerKey: string, rubric: string, cloId: string, level: string, topic: string): Question => {
    qn++;
    return {
      id: `q_demo_${qn}`,
      prompt,
      answerKey,
      rubric,
      answerLines: 8,
      points: null,
      topic,
      cloId,
      cognitiveLevel: level,
      origin: "demo",
      sourceResourceIds: [RES_TEXT],
    };
  };

  const test1: ExamSection = {
    id: "sec_demo_1",
    title: "Test I",
    instructions: "Multiple Choice. Choose the letter of the best answer.",
    type: "multiple-choice",
    plannedItems: 10,
    defaultPoints: 1,
    questions: [
      mc("In the client–server model, which component initiates an HTTP request?", ["The web server", "The browser (client)", "The database", "The network cable"], 1, c1, "Remembering", "Client–server model"),
      mc("What does the HTTP status code 404 indicate?", ["The server crashed while processing the request", "The client should use a different URL permanently", "The requested resource was not found", "The request succeeded"], 2, c1, "Remembering", "HTTP status codes"),
      mc("Which HTTP method is normally used to submit form data that creates a new record on the server?", ["GET", "POST", "HEAD", "OPTIONS"], 1, c1, "Understanding", "HTTP methods"),
      mc("Why does a browser perform a DNS lookup before contacting a website?", ["To translate the domain name into an IP address", "To encrypt the page content", "To check the spelling of the URL", "To download the page's style sheet"], 0, c1, "Understanding", "DNS"),
      mc("Which HTML element is most appropriate for a page's main navigation links?", ["<div>", "<nav>", "<span>", "<section>"], 1, c2, "Remembering", "Semantic HTML"),
      mc("Which attribute provides alternative text for an image?", ["title", "src", "alt", "href"], 2, c2, "Remembering", "Accessibility"),
      mc("In the CSS box model, which property adds space between an element's border and its content?", ["margin", "padding", "outline", "gap"], 1, c2, "Understanding", "CSS box model"),
      mc(
        "Given the rules  p { color: blue; }  .note { color: green; }  #intro { color: red; }, what color is the text of <p id=\"intro\" class=\"note\">?",
        ["Blue", "Green", "Red", "Black (browser default)"],
        2, c2, "Applying", "CSS specificity"
      ),
      mc("Which language is primarily responsible for adding interactive behavior to a web page in the browser?", ["HTML", "CSS", "JavaScript", "SQL"], 2, c3, "Remembering", "Role of JavaScript"),
      mc(
        "A page reloads completely every time a user clicks \"Show more\". Which approach updates only the part of the page that changed?",
        ["Adding more CSS rules", "Using JavaScript fetch to request data and update the DOM", "Increasing the server's memory", "Using a longer URL"],
        1, c3, "Understanding", "Asynchronous requests"
      ),
    ],
  };
  const test2: ExamSection = {
    id: "sec_demo_2",
    title: "Test II",
    instructions: "Identification. Write the term being described. (2 points each)",
    type: "identification",
    plannedItems: 5,
    defaultPoints: 2,
    questions: [
      idq("The protocol that protects HTTP traffic with TLS encryption.", "HTTPS", c1, "Remembering", "Secure transport"),
      idq("The part of a URL after the \"?\" that passes name=value pairs to the server.", "Query string", c1, "Understanding", "URLs"),
      idq("The HTML element that groups input controls and sends their values to a server.", "<form> (form element)", c2, "Remembering", "HTML forms"),
      idq("The CSS feature that applies rules only when the viewport meets a condition, such as a width below 600 pixels.", "Media query", c2, "Understanding", "Responsive design"),
      idq("The tree of objects a browser builds from an HTML document, which JavaScript can read and modify.", "Document Object Model (DOM)", c3, "Remembering", "DOM"),
    ],
  };
  const test3: ExamSection = {
    id: "sec_demo_3",
    title: "Test III",
    instructions: "Essay. Answer each question in complete sentences. (5 points each)",
    type: "essay",
    plannedItems: 2,
    defaultPoints: 5,
    questions: [
      essay(
        "Trace what happens from the moment a user types a website address into the browser until the page is displayed. Explain at least four distinct steps and the role of the client and the server in each.",
        "DNS resolves the name to an IP address; the browser opens a (TLS) connection; it sends an HTTP GET request; the server processes it and returns a status code, headers and HTML; the browser parses the HTML, requests CSS/JS/images, builds the DOM and renders the page.",
        "5 – four or more correct steps in the right order with client/server roles; 3–4 – three steps or minor ordering errors; 1–2 – vague or mostly incorrect; 0 – no answer.",
        c1, "Analyzing", "Request–response cycle"
      ),
      essay(
        "A small school office wants a web page for weekly announcements that staff can update without editing code. Compare publishing a static HTML page with a page generated by a server from stored data. Which would you recommend, and why?",
        "A static page is simple and fast but must be edited and re-uploaded for each change; a server-generated page reads announcements from stored data so staff can update them through a form, at the cost of hosting a server/database and securing the input. Recommendation should be justified against the office's need for non-technical updates.",
        "5 – accurate comparison of both options and a justified recommendation; 3–4 – comparison with weak justification; 1–2 – describes only one option; 0 – no answer.",
        c4, "Evaluating", "Static vs. dynamic web systems"
      ),
    ],
  };
  e.sections = [test1, test2, test3];
  return e;
}

/* ------------------------------------------------------------------ */
/* Demo TOS                                                            */
/* ------------------------------------------------------------------ */

function demoTos(exam: Exam, syl: Syllabus, data: AppData): Tos {
  const t = blankTos(exam, data);
  t.id = DEMO_TOS_ID;
  t.createdAt = T0;
  t.updatedAt = T1;
  t.isDemo = true;
  t.title = "TOS — First Preliminary Examination (ITE 153)";
  t.tosCode = "MSUN-CBIT-TOS-ITE153-2026-P1";
  t.college = syl.collegeName;
  t.department = "Department of Information Technology";
  t.objectives = syl.clos.map((c, i) => ({
    id: `tobj_demo_${i + 1}`,
    label: `${i + 1}. ${c.statement}`,
    cloId: c.id,
    topic: "",
    weight: null,
  }));
  const objByClo = new Map(t.objectives.map((o) => [o.cloId, o.id]));
  const mappings: TosMapping[] = [];
  exam.sections.forEach((sec) =>
    sec.questions.forEach((q) =>
      mappings.push({
        questionId: q.id,
        sectionId: sec.id,
        objectiveId: objByClo.get(q.cloId) ?? null,
        level: q.cognitiveLevel ?? null,
        mappingSource: "demo",
        rationale: `Demonstration mapping from the item's CLO (${syl.clos.find((c) => c.id === q.cloId)?.code ?? "?"}) and cognitive level.`,
      })
    )
  );
  t.mappings = mappings;
  t.sourceExamRevision = exam.revision;
  t.numbering = "placement";
  t.preparedBy = { name: "DR. FLORDELINE A. CADELIÑA", date: "" };
  t.reviewedBy = { name: "CRIS NIEL ANTHONNY M. GULFAN", date: "" };
  t.approvedBy = { name: "DR. LILIBETH P. CORONEL", date: "" };
  return t;
}

export function buildInitialData(base: AppData): AppData {
  const data: AppData = {
    ...base,
    libraryPOs: templateLibraryPOs(),
    people: demoPeople(),
    settings: {
      ...base.settings,
      defaultSignatories: { facultyIds: ["per_demo_1"], chairId: "per_demo_3", deanId: "per_demo_4" },
    },
  };
  data.resources = demoResources();
  const syl = demoSyllabus(data);
  data.syllabi = [syl];
  const exam = demoExam(syl);
  data.exams = [exam];
  data.tos = [demoTos(exam, syl, data)];
  return data;
}
