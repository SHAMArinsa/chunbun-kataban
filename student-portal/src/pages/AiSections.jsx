import { Link } from 'react-router-dom'
import {
  ArrowRight, Bot, Brain, BriefcaseBusiness, Check, Code2, Cpu, Database, Eye, LineChart,
  MessagesSquare, ShieldCheck, Sparkles, TrendingUp, Workflow, X, Zap, BookOpen, Hammer, Briefcase, Rocket, Layers, Plug, Mic, Trophy, Cog, FlaskConical, BarChart3, Palette, Compass, GraduationCap, Globe2,
} from 'lucide-react'

/* ---------------------------------------------------------------- illustrations (inline SVG) */

/** Neural-network brain: glowing nodes and links inside a brain outline. Used in the hero ring. */
export function AiBrainArt({ className = '' }) {
  const nodes = [[150, 92], [196, 78], [240, 96], [118, 140], [170, 136], [222, 140], [268, 150], [134, 192], [186, 186], [238, 196], [160, 236], [214, 238]]
  const links = [[0, 1], [1, 2], [0, 3], [0, 4], [1, 4], [1, 5], [2, 5], [2, 6], [3, 4], [4, 5], [5, 6], [3, 7], [4, 7], [4, 8], [5, 8], [5, 9], [6, 9], [7, 8], [8, 9], [7, 10], [8, 10], [8, 11], [9, 11], [10, 11]]
  return (
    <svg className={className} viewBox="0 0 390 330" role="img" aria-label="Artificial intelligence neural network">
      <defs>
        <radialGradient id="aiGlow" cx="50%" cy="45%" r="55%"><stop offset="0" stopColor="#2583d8" stopOpacity=".35" /><stop offset="1" stopColor="#2583d8" stopOpacity="0" /></radialGradient>
        <linearGradient id="aiStroke" x1="0" x2="1"><stop offset="0" stopColor="#1254a6" /><stop offset="1" stopColor="#2583d8" /></linearGradient>
      </defs>
      <ellipse cx="195" cy="160" rx="170" ry="150" fill="url(#aiGlow)" />
      {/* brain outline */}
      <path d="M190 52c-22-18-62-14-74 12-26-2-46 20-40 46-22 12-26 44-8 62-8 26 10 52 36 54 8 22 38 32 60 18 10 14 26 18 26 18V52Z" fill="#fff" stroke="url(#aiStroke)" strokeWidth="5" strokeLinejoin="round" />
      <path d="M200 52c22-18 62-14 74 12 26-2 46 20 40 46 22 12 26 44 8 62 8 26-10 52-36 54-8 22-38 32-60 18-10 14-26 18-26 18V52Z" fill="#e8f3ff" stroke="url(#aiStroke)" strokeWidth="5" strokeLinejoin="round" />
      {links.map(([a, b], i) => <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="#2583d8" strokeOpacity=".55" strokeWidth="2" className="aiLink" style={{ animationDelay: `${(i % 6) * 0.35}s` }} />)}
      {nodes.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="11" fill="#2583d8" opacity=".18" className="aiPulse" style={{ animationDelay: `${(i % 4) * 0.5}s` }} /><circle cx={x} cy={y} r="6" fill={i % 3 ? '#1254a6' : '#2583d8'} stroke="#fff" strokeWidth="2" /></g>)}
      {/* circuit traces leaving the brain */}
      {[[60, 90, 20, 90], [56, 200, 14, 200], [334, 110, 376, 110], [330, 220, 372, 220]].map(([x1, y1, x2, y2], i) => <g key={i}><path d={`M${x1} ${y1}H${x2}`} stroke="#1254a6" strokeWidth="3" strokeLinecap="round" /><circle cx={x2} cy={y2} r="6" fill="#fff" stroke="#1254a6" strokeWidth="3" /></g>)}
      <text x="195" y="318" textAnchor="middle" fontFamily="Jost, sans-serif" fontWeight="700" fontSize="15" letterSpacing="4" fill="#1254a6">ARTIFICIAL INTELLIGENCE</text>
    </svg>
  )
}

/** AI chip with traces. Used in the skills section. */
export function AiChipArt({ className = '' }) {
  const pins = [70, 105, 140, 175, 210]
  return (
    <svg className={className} viewBox="0 0 280 280" role="img" aria-label="AI processor chip">
      <defs><linearGradient id="chipG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1254a6" /><stop offset="1" stopColor="#0b2e59" /></linearGradient></defs>
      {pins.map((p) => <g key={p} stroke="#a9cff5" strokeWidth="4" strokeLinecap="round"><path d={`M${p} 20v40`} /><path d={`M${p} 220v40`} /><path d={`M20 ${p}h40`} /><path d={`M220 ${p}h40`} /></g>)}
      {pins.map((p) => <g key={'d' + p} fill="#2583d8"><circle cx={p} cy="18" r="5" /><circle cx={p} cy="262" r="5" /><circle cx="18" cy={p} r="5" /><circle cx="262" cy={p} r="5" /></g>)}
      <rect x="58" y="58" width="164" height="164" rx="22" fill="url(#chipG)" />
      <rect x="78" y="78" width="124" height="124" rx="14" fill="none" stroke="#2583d8" strokeWidth="2" strokeDasharray="6 6" />
      <text x="140" y="156" textAnchor="middle" fontFamily="Jost, sans-serif" fontWeight="800" fontSize="54" fill="#fff">AI</text>
      <circle cx="140" cy="140" r="78" fill="none" stroke="#8ec9ff" strokeOpacity=".35" strokeWidth="2" className="aiSpin" strokeDasharray="10 14" />
    </svg>
  )
}

/** Wide animated network used as a background in the "AI shift" band. */
function NetworkBg() {
  const pts = Array.from({ length: 26 }, (_, i) => [((i * 137) % 1000) + 20, ((i * 71) % 300) + 20])
  return (
    <svg className="aiNetBg" viewBox="0 0 1040 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {pts.map(([x, y], i) => pts.slice(i + 1).filter(([x2, y2]) => Math.hypot(x - x2, y - y2) < 190).map(([x2, y2], j) => <line key={`${i}-${j}`} x1={x} y1={y} x2={x2} y2={y2} stroke="#8ec9ff" strokeOpacity=".22" />))}
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 5 ? 3 : 5} fill="#8ec9ff" opacity=".7" className="aiPulse" style={{ animationDelay: `${(i % 5) * 0.6}s` }} />)}
    </svg>
  )
}

/* ---------------------------------------------------------------- sections */

const SHIFT_STEPS = [
  [BookOpen, 'LEARN', 'Understand what matters', 'Build strong foundations before moving into modern AI, Generative AI and intelligent systems.'],
  [Hammer, 'BUILD', 'Turn knowledge into proof', 'Work on projects, assignments and practical challenges that demonstrate what you can actually do.'],
  [Briefcase, 'EXPERIENCE', 'Learn how real work feels', 'Move beyond tutorials through deadlines, submissions, reviews, feedback and structured internship experience.'],
  [Rocket, 'ADVANCE', 'Prepare for what comes next', 'Develop the technical ability, practical experience and professional readiness needed for an AI-driven job market.'],
]

export function AiShiftSection() {
  return (
    <section className="aiShift">
      <NetworkBg />
      <div className="aiShiftHead">
        <p className="eduKicker light"><i /> THE AI SHIFT IS ALREADY HERE</p>
        <h2>The way we work is changing.<br /><span>Your skills should change with it.</span></h2>
        <p>AI is no longer limited to specialists or research teams. It is becoming part of how software is built, data is understood, products are created, workflows are automated and businesses operate.</p>
        <p>The opportunity now belongs to people who can <b>understand AI, build with it and apply it to real problems.</b></p>
      </div>
      <div className="shiftSteps">
        {SHIFT_STEPS.map(([Icon, tag, title, desc], i) => (
          <article key={tag}>
            <div className="shiftTop"><span><Icon /></span><small>0{i + 1} · {tag}</small></div>
            <h3>{title}</h3><p>{desc}</p>
            {i < 3 && <ArrowRight className="shiftArrow" />}
          </article>
        ))}
      </div>
      <blockquote className="shiftQuote">The future of work will not only reward people who know AI.<br /><span>It will reward people who know what to do with it.</span></blockquote>
    </section>
  )
}

export function AiCompareSection() {
  const traditional = [
    'Learn concepts, but get limited opportunities to apply them',
    'Complete tutorials without building end-to-end solutions',
    'Know about AI tools without knowing how to use them effectively',
    'Enter interviews with qualifications, but limited work to demonstrate',
    'Compete with candidates who already have hands-on experience',
  ]
  const arinsa = [
    'Develop practical skills across Python, AI, GenAI, LLMs, APIs and modern development',
    'Turn concepts into projects, assignments and working solutions',
    'Experience structured tasks, deadlines, submissions and professional feedback',
    'Build work you can discuss confidently in interviews',
    'Earn verifiable credentials that support your professional profile',
    'Progress from learning to internship experience and career preparation',
  ]
  return (
    <section className="aiCompare">
      <div className="aiSectionHead">
        <p className="eduKicker"><i /> WHY IT MATTERS FOR YOU</p>
        <h2>Same degree. <span>Different readiness.</span></h2>
        <p>Knowing technology is one thing. Being able to apply it, build with it and demonstrate what you can do is what creates the difference.</p>
        <p>As AI becomes part of everyday work, practical skills, project experience and the ability to use modern tools are becoming increasingly valuable.</p>
      </div>
      <div className="aiCompareGrid">
        <article className="without">
          <header><span><BookOpen /></span><div><small>TRADITIONAL LEARNING</small><h3>Knowledge without enough practice</h3></div></header>
          <ul>{traditional.map((x) => <li key={x}><i className="dot" />{x}</li>)}</ul>
        </article>
        <div className="aiVs">VS</div>
        <article className="with">
          <header><span><Zap /></span><div><small>THE ARINSA APPROACH</small><h3>Learn it. Build it. Prove it.</h3></div></header>
          <ul>{arinsa.map((x) => <li key={x}><Check />{x}</li>)}</ul>
        </article>
      </div>
      <div className="compareClose">
        <p>The difference isn’t just what you know.<br /><b>It’s what you can do with what you know.</b></p>
        <Link className="eduBtn" to="/programs">Build your advantage <ArrowRight /></Link>
      </div>
    </section>
  )
}

const SKILLS = [
  [Code2, 'Python & Development', 'Build strong programming foundations and turn ideas into working applications, APIs and backend systems.'],
  [LineChart, 'Data & Machine Learning', 'Work with data, prepare features, train models, evaluate performance and understand how machine learning solves real problems.'],
  [Layers, 'Deep Learning', 'Explore neural networks and modern deep-learning techniques behind increasingly intelligent applications.'],
  [Sparkles, 'Generative AI & LLMs', 'Understand how modern language models work and learn to build applications powered by Generative AI.'],
  [MessagesSquare, 'Prompt Engineering', 'Design, test and refine prompts that produce more useful, consistent and task-focused AI outputs.'],
  [Database, 'RAG & Vector Search', 'Build AI applications that retrieve relevant information from documents and knowledge sources before generating responses.'],
  [Bot, 'AI Agents & Automation', 'Create intelligent workflows where AI can reason through tasks, use tools and automate multi-step processes.'],
  [Eye, 'Computer Vision', 'Build systems that work with images and visual information using modern computer-vision techniques.'],
  [Plug, 'APIs & AI Applications', 'Move beyond notebooks by connecting models and AI capabilities to APIs, applications and real user experiences.'],
  [ShieldCheck, 'Responsible AI', 'Learn to think critically about reliability, privacy, bias, security and responsible use when building AI-powered systems.'],
]
const ROADMAP = ['Python', 'Data', 'ML', 'Deep Learning', 'GenAI', 'RAG', 'AI Agents', 'Real Applications']

export function AiSkillsSection() {
  return (
    <section className="aiSkills v2">
      <div className="skillsTop">
        <div>
          <p className="eduKicker"><i /> SKILLS FOR THE AI ERA</p>
          <h2>Build the skills behind <span>modern technology.</span></h2>
          <p>From software foundations to advanced AI systems, ARINSA programmes are designed around learning by doing. Depending on your programme, you work with core development skills or go further into building, testing and applying modern AI technologies.</p>
        </div>
        <AiChipArt className="aiChip" />
      </div>
      <div className="skillsRoad">
        <small>FROM FOUNDATIONS TO ADVANCED AI</small>
        <div>{ROADMAP.map((x, i) => <span key={x} className={i === ROADMAP.length - 1 ? 'end' : ''}>{i > 0 && <ArrowRight />}<b>{x}</b></span>)}</div>
      </div>
      <div className="aiSkillGrid">
        {SKILLS.map(([Icon, t, d], i) => <article key={t}><div className="skTop"><span><Icon /></span><i>{String(i + 1).padStart(2, '0')}</i></div><h3>{t}</h3><p>{d}</p></article>)}
      </div>
      <p className="skillsNote">Skills covered depend on your programme — foundational programmes focus on development, while longer programmes go further into advanced AI.</p>
    </section>
  )
}

const ROLES = [
  [Cpu, 'AI / ML Engineer'], [Sparkles, 'Generative AI Developer'], [LineChart, 'Junior Data Scientist'], [Code2, 'Python Developer'],
  [Layers, 'AI Application Developer'], [Globe2, 'AI-Powered Full-Stack Developer'], [Workflow, 'Junior MLOps / ML Engineer'],
  [Bot, 'AI Automation Developer'], [MessagesSquare, 'LLM Application Developer'], [BriefcaseBusiness, 'AI Product / Technical Analyst'],
]
const CA_STEPS = [
  [BookOpen, 'LEARN', 'Build from the foundations into Python, data, Machine Learning, Deep Learning, Generative AI, LLMs and Agentic AI.'],
  [Hammer, 'BUILD', 'Complete technical assignments and real-world projects designed to turn concepts into practical ability.'],
  [Briefcase, 'WORK', 'Move into internship experience with structured tasks, deadlines, submissions, reviews and feedback.'],
  [Mic, 'PREPARE', 'Take part in mock interviews, strengthen your professional profile and prepare for real recruitment processes.'],
  [Trophy, 'PURSUE PLACEMENT', 'Students who meet the eligibility requirements progress into placement support under the placement guarantee terms.*'],
]
const BACKGROUNDS = [
  [Cog, 'Engineering?', 'Build deeper AI and software capabilities.'],
  [FlaskConical, 'Science?', 'Turn analytical thinking into practical technology skills.'],
  [BarChart3, 'Commerce or Business?', 'Learn how AI, data and automation are reshaping modern organisations.'],
  [Palette, 'Arts or Humanities?', 'Bring communication, creativity and human understanding into an AI-powered world.'],
  [Compass, 'From another field?', 'Start with the foundations and build forward one step at a time.'],
]

export function AiCareersSection() {
  return (
    <section className="careerJourney">
      {/* 1. Intro with photo */}
      <div className="aiCareers cjIntro">
        <div className="aiHiredPhoto">
          <picture>
            <source srcSet="/brand/hired-intern.webp" type="image/webp" />
            <img src="/brand/hired-intern.jpg" alt="A new software engineer celebrating her job offer at her desk" loading="lazy" width="1100" height="1008" />
          </picture>
          <div className="cjCaption"><span><Sparkles /></span><div><small>YOUR NEXT CHAPTER</small><b>Build towards the moment you’ve been working for.</b><em>Skills · Projects · Internship · Mock Interviews · Career Preparation</em></div></div>
        </div>
        <div>
          <p className="eduKicker"><i /> WHERE YOUR JOURNEY CAN LEAD</p>
          <h2>You don’t need a tech degree <span>to build a future in tech.</span></h2>
          <p>Technology is changing quickly — and opportunity isn’t limited to engineering or computer-science graduates.</p>
          <p>Whether you come from <b>engineering, science, commerce, business, arts or another field</b>, what matters is your willingness to learn, practise and build.</p>
          <p>Start with the fundamentals. Develop technical skills step by step. Build projects. Experience real work. Prepare for interviews. Then show employers what you can actually do.</p>
        </div>
      </div>

      {/* 2. Career Accelerator feature */}
      <div className="caBand">
        <div className="caHead">
          <div>
            <p className="caTag">CAREER ACCELERATOR · 1 YEAR</p>
            <h3>From beginner to career-ready. <i>One complete journey.</i></h3>
            <p>The <b>Career Accelerator</b> is ARINSA’s most comprehensive programme — combining structured learning, practical assignments, real-world projects, internship experience and career preparation in one year.</p>
          </div>
          <div className="caPromise"><small>You don’t need to arrive as an expert.</small><b>You arrive ready to learn.</b><b>You leave with something to prove.</b></div>
        </div>
        <ol className="caSteps">{CA_STEPS.map(([Icon, t, d], i) => <li key={t}><span><Icon /></span><small>0{i + 1}</small><h4>{t}</h4><p>{d}</p></li>)}</ol>
      </div>

      {/* 3. Backgrounds */}
      <div className="cjBlock">
        <h3 className="cjTitle">Your background doesn’t have to define <span>your next move.</span></h3>
        <div className="bgGrid">{BACKGROUNDS.map(([Icon, t, d]) => <article key={t}><span><Icon /></span><h4>{t}</h4><p>{d}</p></article>)}</div>
        <p className="bgNote"><GraduationCap /> <span><b>No computer-science degree required to begin.</b> What matters is your commitment to learn, practise, complete the work and keep progressing.</span></p>
      </div>

      {/* 4. Roles */}
      <div className="cjBlock rolesBlock">
        <div>
          <p className="eduKicker"><i /> CAREERS BUILT AROUND MODERN TECHNOLOGY</p>
          <p className="rolesLead">The skills developed throughout the Career Accelerator can help you prepare toward career paths such as:</p>
          <div className="aiRoles">{ROLES.map(([Icon, r]) => <span key={r}><Icon />{r}</span>)}</div>
        </div>
        <aside className="unsureCard"><Compass /><h4>Don’t know which role is right for you yet?</h4><p>That’s okay. <b>You don’t need to choose your destination before you’ve taken your first step.</b></p><p>Start by building the foundation. As you learn, build projects and experience different areas of technology, you’ll develop a clearer understanding of where your strengths and interests fit.</p></aside>
      </div>

      {/* 5. Start smaller + CTA */}
      <div className="cjFinal">
        <div className="startSmall">
          <p className="caTag dark">NOT READY FOR A 1-YEAR COMMITMENT?</p>
          <h3>Choose a shorter programme. <span>Still build real skills.</span></h3>
          <p>Pick the <b>2-week Basic</b>, <b>4-week Professional</b>, <b>12-week Advanced</b> or <b>24-week Career Internship</b> — each is a complete programme on its own, with its own work, feedback and certificate.</p>
          <div className="durFlow">{[['Basic', '2 Weeks'], ['Professional', '4 Weeks'], ['Advanced', '12 Weeks'], ['Career', '24 Weeks']].map(([n, d]) => <span key={n}><b>{n} · {d}</b></span>)}</div>
          <p className="muted">Choose the programme that fits your time, experience and goals today.</p>
        </div>
        <div className="bigMove">
          <small>READY TO MAKE THE BIGGER MOVE?</small>
          <h3>Learn. Build. Intern. Prepare. <span>Pursue your career.</span></h3>
          <div className="eduActions"><Link className="eduBtn light" to="/programs/career_accelerator">Start Career Accelerator <ArrowRight /></Link><Link className="eduBtn ghost" to="/programs">Explore all programmes <ArrowRight /></Link></div>
        </div>
      </div>
      <p className="cjNote">*Placement guarantee is subject to successful completion of applicable programme eligibility requirements and terms.</p>
    </section>
  )
}
