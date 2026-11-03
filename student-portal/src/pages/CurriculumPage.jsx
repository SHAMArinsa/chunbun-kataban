import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, BookOpen, Briefcase, Calculator, ChevronDown, ClipboardCheck, Code2, FileCheck2, FolderGit2,
  GraduationCap, Hammer, Layers, MessagesSquare, Mic, Palette, PlayCircle, RefreshCw, Rocket, Trophy, UserRound, Wrench,
} from 'lucide-react'
import './CurriculumPage.css'

const STATS = [['1 Year', 'Structured learning + internship'], ['Hands-on', 'Technical assignments'], ['Real-world', 'Projects & tasks'], ['3', 'Mock interview milestones'], ['Month 6+', 'Internship experience'], ['Placement', 'Guarantee subject to eligibility*']]

const ROADMAP = ['Foundations', 'Software', 'Data', 'AI', 'GenAI', 'Agentic AI', 'Projects', 'Internship', 'Career']

const PHASES = [
  ['MONTHS 01–05', 'Learn & Build', 'Build technical foundations and progress into software development, data and Artificial Intelligence.', ['Learn', 'Practise', 'Assignments', 'Projects']],
  ['MONTHS 06–09', 'Learn + Intern', 'Continue advanced learning while beginning structured internship work, assignments and real-world projects.', ['Advanced learning', 'Assigned tasks', 'Projects', 'Reviews']],
  ['MONTHS 10–12', 'Full Internship + Career Preparation', 'Focus on internship responsibilities, projects, professional development, mock interviews and placement eligibility.', ['Real-world tasks', 'Deadlines', 'Reviews', 'Career preparation']],
]

const MODULES = [
  ['Computer & Programming Foundations', 'Python Programming', ['Python fundamentals', 'Variables & data types', 'Conditions', 'Loops', 'Functions', 'Data structures', 'File handling', 'Exception handling', 'OOP', 'Modules & packages', 'Virtual environments', 'Debugging'], 'Python applications and problem-solving exercises', null],
  ['Professional Development Workflow', 'Git, GitHub & Developer Tools', ['Git', 'GitHub', 'Repositories', 'Branching', 'Commits', 'Pull requests', 'README', 'VS Code', 'Jupyter', 'Debugging', 'Collaboration'], 'A professional GitHub portfolio', null],
  ['Web Foundations', 'Frontend Development', ['HTML5', 'CSS3', 'JavaScript', 'Responsive design', 'APIs', 'React', 'Component-based development', 'Modern UI development'], 'Responsive web applications', null],
  ['Backend Engineering', 'Python Backend & APIs', ['Flask', 'FastAPI', 'REST APIs', 'JSON', 'Request / response', 'Authentication', 'JWT', 'File uploads', 'Validation', 'Error handling', 'API documentation', 'Async concepts'], 'Production-style backend APIs', null],
  ['Database Engineering', 'SQL & Databases', ['SQL', 'SQLite', 'PostgreSQL', 'Data modelling', 'CRUD', 'Relationships', 'Joins', 'Constraints', 'Indexes', 'Query optimisation', 'Database integration'], 'Database-driven applications', null],
  ['Data Analysis', 'NumPy, Pandas & EDA', ['NumPy', 'Pandas', 'DataFrames', 'Data cleaning', 'Missing values', 'Outliers', 'Exploratory data analysis', 'Visualisation', 'Data preparation'], 'End-to-end data analysis projects', null],
  ['Machine Learning', 'From Data to Prediction', ['Supervised learning', 'Unsupervised learning', 'Regression', 'Classification', 'Clustering', 'Feature selection', 'Feature engineering', 'Model training', 'Validation', 'Hyperparameter tuning', 'Performance metrics', 'Model selection'], 'End-to-end ML systems', 'scikit-learn · XGBoost · LightGBM'],
  ['Deep Learning', 'Neural Networks', ['Neural network fundamentals', 'Training', 'Optimisation', 'CNNs', 'Sequence models', 'Transformers', 'PyTorch', 'TensorFlow / Keras'], 'Deep-learning applications', null],
  ['Natural Language Processing', 'Teaching Machines to Work with Language', ['Text processing', 'Tokenisation', 'Embeddings', 'Classification', 'Sentiment analysis', 'Transformer models', 'Hugging Face'], 'NLP applications', null],
  ['Computer Vision', 'AI for Images & Visual Data', ['Image processing', 'OpenCV', 'CNNs', 'Image classification', 'Object detection', 'Transfer learning', 'Video fundamentals'], 'Computer-vision applications', null],
  ['Generative AI & LLMs', 'Build with Modern AI', ['Generative AI', 'LLM fundamentals', 'Tokens', 'Context', 'Embeddings', 'Prompt engineering', 'Structured outputs', 'Function / tool calling', 'Multimodal AI', 'LLM APIs'], 'LLM-powered applications', null],
  ['RAG & Knowledge Systems', 'Connect AI to Real Information', ['Document processing', 'Chunking', 'Embeddings', 'Vector databases', 'Semantic search', 'Retrieval', 'Reranking concepts', 'RAG architecture', 'Context management', 'Evaluation'], 'An AI knowledge assistant', 'FAISS · Chroma · pgvector · LangChain'],
  ['Agentic AI', 'From Chatbots to Systems That Act', ['AI agents', 'Tools', 'Memory', 'Planning', 'Reasoning workflows', 'LangChain', 'LangGraph', 'Multi-agent concepts', 'Human-in-the-loop', 'MCP'], 'A tool-using AI agent', null],
  ['AI Automation & Integration', 'Connect AI to Workflows', ['APIs', 'Webhooks', 'External services', 'Automation pipelines', 'AI workflows', 'Data processing', 'Agent integration'], 'An intelligent automation workflow', null],
  ['Deployment & MLOps Foundations', 'Take Your Work Beyond Your Laptop', ['Docker', 'Linux', 'Environment variables', 'Cloud fundamentals', 'CI/CD', 'GitHub Actions', 'Application deployment', 'Model deployment', 'Monitoring concepts'], 'Deploy a complete application', 'AWS · Azure · Render · Vercel'],
]

const TOOLKIT = [
  ['Development', ['Python', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'React', 'FastAPI', 'Flask']],
  ['Data & ML', ['NumPy', 'Pandas', 'scikit-learn', 'XGBoost', 'LightGBM']],
  ['Deep Learning', ['PyTorch', 'TensorFlow', 'Keras', 'OpenCV', 'Hugging Face']],
  ['Generative AI', ['OpenAI', 'LLMs', 'Embeddings', 'Prompt Engineering', 'RAG']],
  ['Agentic AI', ['LangChain', 'LangGraph', 'AI Agents', 'Tool Calling', 'MCP']],
  ['Databases', ['SQL', 'SQLite', 'PostgreSQL', 'pgvector', 'FAISS', 'Chroma']],
  ['Development & Deployment', ['Git', 'GitHub', 'Docker', 'Linux', 'GitHub Actions', 'AWS', 'Azure', 'Render', 'Vercel']],
]

const LOOP = ['Learn', 'Practise', 'Solve', 'Build', 'Submit', 'Get reviewed', 'Improve', 'Apply']
const METHODS = [
  [PlayCircle, 'Video Tutorials', 'Learn concepts step by step.'],
  [ClipboardCheck, 'Technical Assignments', 'Substantial assignments across Python, SQL, ML, Deep Learning, NLP, Computer Vision, GenAI and Agentic AI.'],
  [FolderGit2, 'Projects', 'Turn individual skills into complete solutions.'],
  [Briefcase, 'Internship Tasks', 'Work against requirements, deadlines and submission expectations.'],
  [RefreshCw, 'Reviews & Feedback', 'Understand what worked, what didn’t and what needs improvement.'],
  [Mic, 'Mock Interviews', 'Three career milestones designed to develop technical communication and interview readiness.'],
]

const PROJECTS = [
  ['AI Knowledge Workspace', 'RAG · LLMs · Vector Search · FastAPI'],
  ['Customer Intelligence System', 'Python · ML · PostgreSQL · APIs'],
  ['Computer Vision Inspection System', 'Deep Learning · OpenCV · Computer Vision'],
  ['AI Support Agent', 'LLMs · LangGraph · Tool Calling · APIs'],
  ['Intelligent Document Platform', 'Document Processing · RAG · Extraction · AI'],
  ['Agentic Workflow System', 'AI Agents · MCP · Tools · Automation'],
]

const BACKGROUNDS = [
  [Code2, 'Engineering & Computer Science', 'Go deeper into modern AI and software engineering.'],
  [Calculator, 'Science & Mathematics', 'Turn analytical foundations into practical technology skills.'],
  [Layers, 'Commerce & Business', 'Learn how software, data, automation and AI are changing business.'],
  [Palette, 'Arts & Humanities', 'Combine human understanding, communication and creativity with modern AI capabilities.'],
  [UserRound, 'Working Professionals & Career Switchers', 'Build technical foundations before progressing into specialised AI skills.'],
]

const INTERVIEWS = [
  ['Foundation Review', 'Can you explain what you’ve learned and built?'],
  ['Technical & Project Review', 'Can you solve problems and defend your technical decisions?'],
  ['Career Readiness', 'Can you communicate your skills, projects and experience in a real interview environment?'],
]

const LEAVE = [
  [Wrench, 'Technical Skills', 'Across software, data and modern AI.'],
  [ClipboardCheck, 'Completed Assignments', 'Evidence of sustained technical practice.'],
  [Hammer, 'Real-World Projects', 'Work you can demonstrate and discuss.'],
  [Briefcase, 'Internship Experience', 'Structured tasks, deadlines, submissions and reviews.'],
  [FolderGit2, 'Professional Portfolio', 'GitHub and project work that demonstrates your capabilities.'],
  [MessagesSquare, 'Interview Experience', 'Three structured mock-interview milestones.'],
  [BadgeCheck, 'Verifiable Credentials', 'Certificates with credential verification.'],
  [Trophy, 'Placement Eligibility', 'Eligible graduates progress into placement support under the programme’s guarantee terms.*'],
]

const FAQS = [
  ['Can I join if I’m from a non-technical background?', 'Yes. The Career Accelerator begins with programming and technical foundations before progressing into more advanced areas.'],
  ['Do I need previous coding experience?', 'No prior professional coding experience is required to begin. However, you must be prepared for consistent technical learning and practice.'],
  ['Is this only an online course?', 'No. The programme combines structured learning with assignments, projects, internship experience, reviews and career preparation.'],
  ['When does the internship begin?', 'Internship activity begins from Month 6 alongside continued learning, with Months 10–12 focused on full internship experience.'],
  ['Will I learn Generative AI and AI Agents?', 'Yes. The roadmap progresses through core programming, data and AI foundations before reaching Generative AI, RAG and Agentic AI.'],
  ['How does the placement guarantee work?', 'The placement guarantee is subject to programme eligibility requirements and applicable terms, including successful completion of required programme milestones.'],
]

function ModuleCard({ m, i }) {
  const [open, setOpen] = useState(false)
  const [area, title, topics, build, tools] = m
  const shown = open ? topics : topics.slice(0, 6)
  return (
    <article className={`cu-mod ${open ? 'open' : ''}`}>
      <div className="cu-mod-top"><i>{String(i + 1).padStart(2, '0')}</i><small>{area}</small></div>
      <h3>{title}</h3>
      <div className="cu-chips">{shown.map((t) => <span key={t}>{t}</span>)}{topics.length > 6 && <button type="button" onClick={() => setOpen(!open)}>{open ? 'Show less' : `+${topics.length - 6} more`}</button>}</div>
      {tools && <p className="cu-tools"><b>Tools:</b> {tools}</p>}
      <p className="cu-build"><Hammer /> <span><b>Build:</b> {build}</span></p>
    </article>
  )
}

export default function CurriculumPage() {
  return (
    <main className="cu">
      {/* Hero */}
      <section className="cu-hero">
        <p className="cu-kicker">ARINSA AI MINDS · CAREER ACCELERATOR CURRICULUM</p>
        <h1>From foundations to AI. <span>One structured journey.</span></h1>
        <p className="cu-lead">Designed for learners from <b>any academic background</b>, the Career Accelerator takes you step by step from programming fundamentals to modern AI, Generative AI and Agentic AI — followed by projects, internship experience and career preparation.</p>
        <p className="cu-nodeg"><GraduationCap /> No Computer Science degree required. No engineering background required.</p>
        <p className="cu-sub">You start with the foundations and progress by learning, practising, building and applying what you know.</p>
        <div className="cu-stats">{STATS.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>
        <div className="cu-actions"><Link className="cu-btn" to="/signup?program=career_accelerator">Start Career Accelerator <ArrowRight /></Link><Link className="cu-btn ghost" to="/programs/career_accelerator">View programme details</Link></div>
        <p className="cu-scope">This curriculum describes the 1-year Career Accelerator. Other ARINSA programmes have their own, shorter scope — <Link to="/programs/compare?p=basic,career_accelerator">compare programmes</Link>.</p>
      </section>

      {/* Roadmap */}
      <section className="cu-sec">
        <div className="cu-head"><p className="cu-label">THE ROADMAP</p><h2>One year. <span>A clear progression.</span></h2></div>
        <div className="cu-road">{ROADMAP.map((r, i) => <span key={r}>{i > 0 && <ArrowRight />}<b>{r}</b></span>)}</div>
        <ol className="cu-phases">{PHASES.map(([when, title, text, tags], i) => (
          <li key={when}><div className="cu-ph-dot">{i + 1}</div><small>{when}</small><h3>{title}</h3><p>{text}</p><div className="cu-ph-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div></li>
        ))}</ol>
      </section>

      {/* Modules */}
      <section className="cu-sec cu-soft">
        <div className="cu-head"><p className="cu-label">CURRICULUM</p><h2>Start with the fundamentals. <span>Go all the way to modern AI.</span></h2><p>15 modules, from your first line of Python to deployed AI systems.</p></div>
        <div className="cu-mods">{MODULES.map((m, i) => <ModuleCard key={m[1]} m={m} i={i} />)}</div>
      </section>

      {/* Toolkit */}
      <section className="cu-sec">
        <div className="cu-head"><p className="cu-label">THE TECHNICAL TOOLKIT</p><h2>Learn how the pieces <span>work together.</span></h2></div>
        <div className="cu-tk">{TOOLKIT.map(([g, items]) => <div key={g}><b>{g}</b><div>{items.map((t) => <span key={t}>{t}</span>)}</div></div>)}</div>
      </section>

      {/* Not just lessons */}
      <section className="cu-sec cu-navy">
        <div className="cu-head"><p className="cu-label light">NOT JUST LESSONS</p><h2>Every stage asks you <span>to do something.</span></h2></div>
        <div className="cu-loop">{LOOP.map((l, i) => <span key={l}>{i > 0 && <ArrowRight />}<b>{l}</b></span>)}</div>
        <div className="cu-methods">{METHODS.map(([Icon, t, d]) => <article key={t}><span><Icon /></span><h3>{t}</h3><p>{d}</p></article>)}</div>
      </section>

      {/* Learning to working */}
      <section className="cu-sec">
        <div className="cu-head center"><p className="cu-label">FROM LEARNING TO WORKING</p><h2>The internship isn’t added at the end. <span>It becomes part of the journey.</span></h2></div>
        <div className="cu-flow">{PHASES.map(([when, , , tags], i) => (
          <div key={when} className={`cu-flow-step s${i}`}><small>{when}</small><b>{['Course', 'Course + Internship', 'Full Internship'][i]}</b><p>{tags.join(' · ')}</p></div>
        ))}</div>
      </section>

      {/* Projects */}
      <section className="cu-sec cu-soft">
        <div className="cu-head"><p className="cu-label">PROJECT EXPERIENCE</p><h2>Build work <span>worth talking about.</span></h2><p>Projects become more challenging as your capabilities grow — progressing from foundational applications to <b>data-driven systems, ML solutions, Generative AI applications and agentic workflows.</b></p></div>
        <div className="cu-projects">{PROJECTS.map(([t, s], i) => <article key={t}><i>{String(i + 1).padStart(2, '0')}</i><h3>{t}</h3><p>{s}</p></article>)}</div>
        <Link className="cu-link" to="/industry-projects">Explore project work <ArrowRight /></Link>
      </section>

      {/* Backgrounds */}
      <section className="cu-sec">
        <div className="cu-head center"><p className="cu-label">BUILT FOR DIFFERENT BEGINNINGS</p><h2>Your degree doesn’t decide <span>whether you can start.</span></h2></div>
        <div className="cu-bg">{BACKGROUNDS.map(([Icon, t, d]) => <article key={t}><span><Icon /></span><h3>{t}</h3><p>{d}</p></article>)}</div>
        <div className="cu-zero"><BookOpen /><div><b>Starting from zero?</b><p>That’s exactly why the curriculum begins with fundamentals. You aren’t expected to know everything on Day 1. You’re expected to <b>learn, practise and progress.</b></p></div></div>
      </section>

      {/* Interviews */}
      <section className="cu-sec cu-soft">
        <div className="cu-head center"><p className="cu-label">YOUR 3 INTERVIEW MILESTONES</p><h2>Practise the conversation <span>three times.</span></h2></div>
        <div className="cu-iv">{INTERVIEWS.map(([t, q], i) => <article key={t}><i>0{i + 1}</i><h3>{t}</h3><p>{q}</p></article>)}</div>
      </section>

      {/* Leave with */}
      <section className="cu-sec">
        <div className="cu-head"><p className="cu-label">WHAT YOU LEAVE WITH</p><h2>More than <span>completed lessons.</span></h2></div>
        <div className="cu-leave">{LEAVE.map(([Icon, t, d]) => <article key={t}><Icon /><div><h3>{t}</h3><p>{d}</p></div></article>)}</div>
      </section>

      {/* FAQ */}
      <section className="cu-sec cu-soft">
        <div className="cu-head"><p className="cu-label">FREQUENTLY ASKED QUESTIONS</p><h2>Before you decide</h2></div>
        <div className="cu-faq">{FAQS.map(([q, a], i) => <details key={q}><summary><i>0{i + 1}</i>{q}<ChevronDown /></summary><p>{a}</p></details>)}</div>
      </section>

      {/* Final CTA */}
      <section className="cu-final">
        <Rocket />
        <h2>One year can change <span>what you’re ready for.</span></h2>
        <ul>{['Start with the foundations.', 'Build modern technical skills.', 'Complete challenging assignments.', 'Create real projects.', 'Experience an internship.', 'Prepare for interviews.', 'Work toward your career.'].map((x) => <li key={x}><FileCheck2 />{x}</li>)}</ul>
        <div className="cu-actions center"><Link className="cu-btn light" to="/signup?program=career_accelerator">Start Career Accelerator <ArrowRight /></Link><Link className="cu-btn ghost-light" to="/programs/career_accelerator">View programme details <ArrowRight /></Link></div>
        <small>*Placement guarantee is subject to Career Accelerator eligibility requirements and applicable terms.</small>
      </section>
    </main>
  )
}
