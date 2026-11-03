import HeroAiArt from '../components/HeroAiArt'
import { ArrowRight, Check, Star, Menu, X, Globe, AtSign, Share2, Trophy, Award, Users, BriefcaseBusiness, Hammer, Footprints, TrendingUp, BadgeCheck, Zap, Briefcase, BookOpen, PenLine, Rocket, Mic, MessagesSquare, Code2, Brain, Sparkles, Database } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import './Landing.css'
import { ProgramCards } from './ProgramsPage'
import { INDUSTRY_PROJECTS } from '../content/industryProjects'
import { ProjectCard } from './IndustryProjects'
import { AiCareersSection, AiCompareSection, AiShiftSection, AiSkillsSection } from './AiSections'

const plans = [['Basic Internship', '02 weeks', '1,999', ['Python, Flask & HTML foundations', '50-question MCQ assessment', '5 practical coding problems', 'Mentor-reviewed mini project', 'Completion certificate'], '/programs/basic'], ['Professional Internship', '04 weeks', '4,999', ['Advanced Python & PostgreSQL', 'Industry-oriented technical assessment', 'Coding challenges and feedback', 'End-to-end industry project', 'Final evaluation & certificate'], '/programs/professional'], ['Career Accelerator', '1 year', '49,999', ['Industry-focused learning videos', 'Technical assignments', 'Real-world projects', 'Internship + 3 mock interviews', 'Placement guarantee (subject to eligibility)'], '/programs/career_accelerator']]

/* Put a cut-out student photo (transparent PNG, portrait) at public/brand/hero-student.png and it shows here.
   Until then, a preview of the student portal is shown in the ring instead. */
function HeroPhoto() {
  return <HeroAiArt className="eduAiArt" />
}

/* Homepage quote. When you have a REAL student testimonial (with their permission), set name and programme,
   e.g. name: 'Full Name', programme: 'Professional Internship'. Leave name empty to show it as the ARINSA goal. */
const TESTIMONIAL = {
  quote: 'I came to learn. I left with real work, professional feedback, and the confidence to show what I could do.',
  name: '',
  programme: '',
  label: 'The ARINSA goal for every student',
}

export default function Landing() {
  const [open, setOpen] = useState(false)
  return <>
    <div className="announcement-bar"><strong>Discover new high-demand tracks!</strong><span>Talk to us at <a href="tel:+919123745946">+91-9123745946</a> · Available 24 hours</span></div>
    <header className="top">
      <Link className="logo brand-logo" to="/"><img src="/brand/arinsa-ai-minds-logo.png" alt="ARINSA AI MINDS" /></Link>
      <nav className={open ? 'visible' : ''}>
        <Link to="/programs" onClick={() => setOpen(false)}>Programs</Link><Link to="/curriculum" onClick={() => setOpen(false)}>Curriculum</Link><Link to="/projects" onClick={() => setOpen(false)}>Projects</Link><Link to="/about" onClick={() => setOpen(false)}>Why ARINSA</Link><Link to="/login">Sign in</Link><Link className="pill small" to="/apply">Apply now <ArrowRight /></Link>
      </nav>
      <button className="mobile" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
    </header>
    <main>
      <section className="eduHero">
        {/* soft decorative shapes */}
        <span className="eduShape blob" /><span className="eduShape chevrons" /><span className="eduShape dots" /><span className="eduShape confetti" />
        <div className="eduCopy">
          <p className="eduKicker"><i /> INDUSTRY AI INTERNSHIP PROGRAMMES</p>
          <h1><span>Real AI Internships</span>That Build Your Career</h1>
          <p className="eduLead">AI is changing every job in tech. Companies now hire people who can <b>build with AI</b> — not just talk about it. Learn it hands-on — <b>the industry way, not the classroom way</b> — with real projects, mentor reviews and a verified certificate.</p>
          <div className="eduAlert"><span><Zap /></span><p><b>The next 3–5 years belong to AI.</b> Those who can’t work with it risk being left behind.</p></div>
          <ul className="eduChecks">
            <li><Check /> Verified Certificates</li><li><Check /> Real-World Projects</li><li><Check /> Mentor Feedback</li>
          </ul>
          <div className="eduActions">
            <Link className="eduBtn" to="/programs">Get started <ArrowRight /></Link>
            <Link className="eduBtn dark" to="/programs">Our programmes <ArrowRight /></Link>
          </div>
        </div>
        <div className="eduVisual">
          <HeroPhoto />
          
        </div>
      </section>
      <section className="eduStrip">{[[Award, 'Verified certificates', 'Every certificate has a public Credential ID'], [Users, 'Industry mentors', 'Feedback on every submission'], [BriefcaseBusiness, 'Placement support', 'Mock interviews & job assistance'], [Trophy, '95% completion', 'Structured, week-by-week plan']].map(([Icon, t, d]) => <article key={t}><span><Icon /></span><div><b>{t}</b><small>{d}</small></div></article>)}</section>
      <AiShiftSection />
      <AiCompareSection />
      <section className="whyArinsa">
        <div className="whyHead">
          <p className="eduKicker"><i /> 01 / WHY ARINSA</p>
          <h2>More than learning.<br /><span>A pathway to real-world experience.</span></h2>
          <p>ARINSA is designed to take you beyond lessons and tutorials — into projects, practical work, professional feedback and career preparation.</p>
        </div>
        <div className="whyGrid">
          {[[Hammer, 'Learn by doing', 'Build practical skills through assessments, projects and challenges designed around application — not passive learning.'],
            [Footprints, 'Start at your level', 'Whether you’re exploring tech for the first time or preparing for your career, choose a programme built around your current stage and next goal.'],
            [Briefcase, 'Experience how work actually works', 'Take on projects, assigned tasks, deadlines, submissions, reviews and feedback — the disciplines that turn knowledge into professional capability.'],
            [BadgeCheck, 'Leave with something to show', 'Build completed work, practical experience and verifiable credentials that give you more to demonstrate than a qualification alone.'],
          ].map(([Icon, t, d], i) => <article key={t}><div className="whyTop"><span><Icon /></span><b>0{i + 1}</b></div><h3>{t}</h3><p>{d}</p></article>)}
        </div>
        <div className="pathBox">
          <div className="pathHead">
            <div><p>FIVE PROGRAMMES. ONE FOR EVERY GOAL.</p><h3>Choose the internship that fits you. <span>Each one is complete on its own.</span></h3></div>
            <p className="pathIndep">Independent programmes — pick the one that matches your time, experience and career goal.</p>
          </div>
          <ol className="pathSteps">
            {[['/programs/basic', 'BEST FOR BEGINNERS', '2 Weeks', 'Basic Internship', 'Your first hands-on step into practical tech.', 'Learn the foundations, complete an assessment and build your first guided project.', ['Foundation', 'Practical Exposure', 'First Project']],
              ['/programs/professional', 'BEST FOR PROJECT BUILDERS', '4 Weeks', 'Professional Internship', 'Build larger, industry-style projects.', 'Work on development in more depth and build larger, industry-style projects you can demonstrate.', ['Development', 'Larger Projects', 'Professional Review']],
              ['/programs/advanced', 'BEST FOR WORK EXPERIENCE', '12 Weeks', 'Advanced Internship', 'Work on real assigned tasks and projects.', 'Take on structured tasks and projects based on your skills and area of interest, with deadlines, submissions and reviewer feedback.', ['Assigned Work', 'Specialisation', 'Feedback']],
              ['/programs/career', 'BEST FOR JOB SEEKERS', '24 Weeks', 'Career Internship', 'Gain long-term experience and get job-ready.', 'Combine long-term internship experience with assigned work, resume support, mock interview preparation and job assistance.', ['Experience', 'Resume', 'Interview', 'Job Assistance']],
              ['/programs/career_accelerator', 'BEST FOR A FULL CAREER JOURNEY', '1 Year', 'Career Accelerator', 'Build towards an AI career from end to end.', 'Follow a structured journey through learning, technical assignments, real-world projects, internship experience, mock interviews and placement preparation.', null],
            ].map(([to, stage, dur, name, lead, desc, chips], i) => (
              <li key={to} className={i === 4 ? 'flag' : ''}>
                                <Link to={to}>
                  <div className="pathMeta"><b>{stage}</b><small>{dur}</small></div>
                  {i === 4 && <span className="pathRibbon">FLAGSHIP</span>}
                  <h4>{name}</h4>
                  <strong>{lead}</strong>
                  <p>{desc}</p>
                  {chips ? <div className="pathChips">{chips.map((c) => <span key={c}>{c}</span>)}</div>
                    : <div className="pathFlowMini">{['Learn', 'Build', 'Intern', 'Prepare', 'Pursue placement*'].map((x, j) => <span key={x}>{j > 0 && <ArrowRight />}{x}</span>)}</div>}
                  <em>View {name} <ArrowRight /></em>
                </Link>
              </li>
            ))}
          </ol>
          <p className="pathNote">*Placement guarantee is subject to programme eligibility requirements and applicable terms.</p>
        </div>
      </section>
      <section className="expSection">
        <div className="expLeft">
          <p className="eduKicker"><i /> 02 / THE EXPERIENCE</p>
          <h2>Every step moves you forward.<br /><span>From learning to doing.</span></h2>
          <p>ARINSA is built around progression. You don’t simply consume content — you <b>learn, practise, build, submit, receive feedback and move forward</b> with stronger evidence of what you can do.</p>
          <p>What you experience depends on the programme you choose — from practical projects to assigned work, professional reviews, career preparation and interview readiness.</p>
          <div className="journeyPhoto">
            <picture><source srcSet="/brand/mock-interview.webp" type="image/webp" /><img src="/brand/mock-interview.jpg" alt="A candidate receiving positive interview feedback from two interviewers" loading="lazy" width="1200" height="800" /></picture>
            <div className="expCaption"><span><MessagesSquare /></span><div><small>INTERVIEW PREPARATION</small><b>Practise the conversation before the real one.</b><em>Real questions · Structured feedback · Career readiness</em></div></div>
          </div>
        </div>
        <div className="expRight">
          <ol className="expSteps">
            {[[BookOpen, 'LEARN', 'Build the foundation', 'Understand the concepts and tools you need before putting them into practice.'],
              [PenLine, 'PRACTISE', 'Apply what you learn', 'Work through assessments, assignments and practical challenges that test understanding — not memorisation.'],
              [Hammer, 'BUILD', 'Create something real', 'Turn your skills into projects and working solutions you can explain, demonstrate and improve.'],
              [Briefcase, 'EXPERIENCE', 'Work with structure', 'Take on assigned tasks, deadlines, submissions, reviews and feedback designed to reflect professional working practices.'],
              [Rocket, 'PREPARE', 'Get ready for the next opportunity', 'Career-focused programmes add resume development, mock interviews, detailed feedback and job or placement preparation.'],
            ].map(([Icon, tag, t, d]) => <li key={tag}><span><Icon /></span><div><small>{tag}</small><h3>{t}</h3><p>{d}</p></div></li>)}
          </ol>
          <div className="mockCard">
            <div className="mockHead"><span><Mic /></span><div><small>MOCK INTERVIEWS · CAREER-FOCUSED PROGRAMMES</small><h3>Practise before it counts.</h3></div></div>
            <p>Experience realistic interview questions, communicate your thinking and receive structured feedback on where you’re strong and where you can improve.</p>
            <div className="mockChips">{['Real questions', 'Interview practice', 'Structured feedback', 'Greater confidence'].map((x) => <span key={x}><Check />{x}</span>)}</div>
          </div>
        </div>
      </section>
      <AiSkillsSection />
      <section className="landing-programs"><div className="program-lead"><p>PROGRAMMES</p><h1>Choose the <em>right stretch.</em></h1><span>Five programmes, from a 2-week foundation to a 1-year career accelerator.</span></div><ProgramCards /></section>
      <section className="toolkit">
        <div className="toolkitHead">
          <p className="eduKicker light"><i /> 04 / THE TOOLKIT</p>
          <h2>Tools behind modern AI.<br /><span>Skills built for real development.</span></h2>
          <p>Go beyond individual technologies. Learn how modern applications come together — from code and databases to machine learning, Generative AI, agents, APIs, cloud and deployment.</p>
        </div>
        <div className="toolRows">
          {[['CODE', Code2, ['Python', 'JavaScript', 'TypeScript', 'HTML & CSS', 'React', 'Next.js', 'Flask', 'FastAPI', 'REST APIs']],
            ['AI / ML', Brain, ['scikit-learn', 'XGBoost', 'LightGBM', 'PyTorch', 'TensorFlow', 'Keras', 'OpenCV', 'Hugging Face', 'Transformers']],
            ['GENAI / AGENTS', Sparkles, ['OpenAI', 'LLMs', 'Embeddings', 'Tool Calling', 'RAG', 'LangChain', 'LangGraph', 'MCP', 'AI Agents', 'Multi-Agent Systems']],
            ['DATA', Database, ['NumPy', 'Pandas', 'SQL', 'PostgreSQL', 'SQLite', 'pgvector', 'FAISS', 'Chroma', 'Pinecone', 'EDA']],
            ['SHIP', Rocket, ['Git', 'GitHub', 'GitHub Actions', 'Docker', 'CI/CD', 'Linux', 'AWS', 'Azure', 'Vercel', 'Render', 'Postman']],
          ].map(([label, Icon, tools], i) => (
            <div className="toolRow" key={label}>
              <div className="toolLabel"><Icon /><b>{label}</b></div>
              <div className="toolTrack"><div className={`toolMove ${i % 2 ? 'rev' : ''}`} style={{ animationDuration: `${34 + i * 4}s` }}>
                {[...tools, ...tools].map((t, j) => <span key={j} aria-hidden={j >= tools.length}>{t}</span>)}
              </div></div>
            </div>
          ))}
        </div>
        <p className="toolkitClose">The goal isn’t to collect tools. <b>It’s to learn how to use the right ones together to build something that works.</b></p>
      </section>
      <section className="workLands">
        <div className="wlHead">
          <p className="eduKicker"><i /> 05 / WORK THAT LANDS</p>
          <h2>Build for problems that feel real. <span>Not just another tutorial.</span></h2>
          <p>The strongest projects don’t begin with <i>“follow these steps.”</i> They begin with a problem.</p>
          <p>ARINSA project work is designed around realistic scenarios that challenge you to <b>understand requirements, make technical decisions, build a solution and explain your approach.</b></p>
        </div>
        <div className="ipGrid">{INDUSTRY_PROJECTS.filter((x) => x.featured).map((x, i) => <ProjectCard key={x.slug} p={x} index={i} />)}</div>
        <div className="wlShow">
          <div><small>DON’T JUST SHOW THE RESULT.</small><h3>Show how you got there.</h3>
          <p>Your project should demonstrate more than a finished screen. It should show your ability to <b>understand a problem, design a solution, choose the right tools, write code, test your work and explain your decisions.</b></p></div>
          <Link className="eduBtn" to="/industry-projects">Explore project library <ArrowRight /></Link>
        </div>
      </section>
      <AiCareersSection />
      <section className="novaTestimonial quoteV2">
        <span className="quoteMark" aria-hidden="true">“</span>
        <blockquote>{TESTIMONIAL.quote}</blockquote>
        <div className="quoteBy">{TESTIMONIAL.name ? <><b>{TESTIMONIAL.name}</b><span>{TESTIMONIAL.programme}</span></> : <span className="quoteGoal">{TESTIMONIAL.label}</span>}</div>
      </section>
      <section className="novaFaq"><div><small>06 / THE DETAILS</small><h2>Clear from<br /><i>the first click.</i></h2></div><div>{['How is this different from a typical internship?', 'Can I join while I am studying?', 'What can I add to my portfolio?', 'How does certificate verification work?'].map((x, i) => <details key={x}><summary><span>0{i + 1}</span>{x}<b>+</b></summary><p>Each programme is thoughtfully designed around real delivery, clear milestones and meaningful proof of progress.</p></details>)}</div></section>
      <section className="novaCta"><small>YOUR NEXT MOVE</small><h2>Build something<br /><i>people remember.</i></h2><p>Your first serious project can start here.</p><Link className="novaButton" to="/apply">Start your application <ArrowRight /></Link></section>
    </main>
    <footer className="v2Footer"><div className="footerTop"><div><Link className="logo invert" to="/"><i />arinsa <span>AI MINDS</span></Link><h2>Make your first<br /><em>serious move.</em></h2></div><form><label>FIELD NOTES FROM ARINSA</label><div><input aria-label="Email address" placeholder="Your email address" /><button aria-label="Subscribe"><ArrowRight /></button></div><small>Product thinking, career signals and studio dispatches.</small></form></div><div className="footerColumns"><div><b>PROGRAMMES</b><Link to="/programs">Foundation</Link><Link to="/programs">Professional</Link><Link to="/programs">Premium</Link></div><div><b>EXPERIENCE</b><Link to="/curriculum">Curriculum</Link><Link to="/projects">Projects</Link><Link to="/about">Mentors</Link></div><div><b>COMPANY</b><Link to="/about">About ARINSA</Link><a href="mailto:recruitment@arinsaaiminds.com">Contact</a><Link to="/login">Student portal</Link></div><div><b>FOLLOW</b><span className="socials"><Globe /><AtSign /><Share2 /></span><a href="#top">Back to top</a></div></div><div className="footerBottom"><span>© {new Date().getFullYear()} ARINSA AI MINDS</span><span>Built for people who build what’s next.</span></div></footer>
  </>
}
