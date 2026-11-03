"""Internship Information Form (Advanced, Career Internship and Career Accelerator).

Single source of truth for the sections, fields and allowed options. The student form,
submit validation and the admin review screen are all driven by this definition.
"""
LEVELS4 = ["None", "Basic", "Intermediate", "Advanced"]
LEVELS3 = ["Beginner", "Intermediate", "Advanced"]

DETAILED_FORM_TIERS = ("advanced", "career", "accelerator")

SECTIONS = [
    {"key": "academic", "title": "Student & Academic Information", "fields": [
        {"key": "phone", "label": "Phone Number", "type": "text", "required": True, "placeholder": "+91 98765 43210"},
        {"key": "qualification", "label": "Current Education / Qualification", "type": "select", "required": True,
         "options": ["School", "Diploma", "B.Tech-B.E.", "BCA", "B.Sc", "MCA", "M.Tech-M.E.", "M.Sc", "MBA", "Graduate", "Postgraduate", "Other"]},
        {"key": "specialization", "label": "Specialization / Branch", "type": "text", "required": True, "placeholder": "e.g. Computer Science"},
        {"key": "institution", "label": "College / University / Institution", "type": "text", "required": True},
        {"key": "year_semester", "label": "Current Year / Semester", "type": "text", "required": True, "placeholder": "e.g. 3rd year / 6th semester"},
        {"key": "graduation_year", "label": "Expected / Actual Graduation Year", "type": "year", "required": True},
    ]},
    {"key": "technical", "title": "Technical Profile", "fields": [
        {"key": "primary_area", "label": "Primary Area of Interest", "type": "select", "required": True,
         "options": ["AI/ML", "GenAI", "Data Science", "Python", "Backend", "Frontend", "Full Stack", "Database", "Testing", "DevOps", "Automation", "Others"]},
        {"key": "secondary_area", "label": "Secondary Area of Interest", "type": "text", "required": False},
        {"key": "skills", "label": "Relevant Skills / Technologies", "type": "tags", "required": True,
         "suggestions": ["Python", "SQL", "Pandas", "NumPy", "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "LLMs", "Prompt Engineering",
                         "REST APIs", "HTML/CSS", "Docker", "Linux", "Power BI", "Excel", "Git"]},
        {"key": "skill_level", "label": "Skill Level", "type": "choice", "required": True, "options": LEVELS3},
        {"key": "languages", "label": "Programming Languages Known", "type": "leveled", "required": True, "levels": LEVELS3,
         "suggestions": ["Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#", "Go", "SQL", "R", "PHP", "Kotlin"]},
        {"key": "frameworks", "label": "Frameworks / Libraries Known", "type": "leveled", "required": False, "levels": LEVELS3,
         "suggestions": ["FastAPI", "Django", "Flask", "React", "Node.js", "Express", "Spring Boot", "TensorFlow", "PyTorch", "scikit-learn", "LangChain", "Pandas"]},
        {"key": "database_level", "label": "Database Knowledge", "type": "choice", "required": True, "options": LEVELS4},
        {"key": "database_tech", "label": "Database technologies known", "type": "tags", "required": False,
         "suggestions": ["PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Oracle", "SQL Server"], "show_if": {"database_level": ["Basic", "Intermediate", "Advanced"]}},
        {"key": "git_level", "label": "Git / GitHub Experience", "type": "choice", "required": True, "options": ["None", "Basic", "Comfortable"]},
        {"key": "ml_level", "label": "Machine Learning Experience", "type": "choice", "required": True, "options": LEVELS4},
        {"key": "dl_level", "label": "Deep Learning Experience", "type": "choice", "required": True, "options": LEVELS4},
        {"key": "genai_level", "label": "Generative AI Experience", "type": "choice", "required": True, "options": LEVELS4},
        {"key": "agentic_level", "label": "Agentic AI / AI Agent Experience", "type": "choice", "required": True, "options": LEVELS4},
        {"key": "fullstack_level", "label": "Full Stack / Web Development Experience", "type": "choice", "required": True, "options": LEVELS4},
    ]},
    {"key": "experience", "title": "Experience & Employment", "fields": [
        {"key": "has_experience", "label": "Previous Internship / Work Experience?", "type": "choice", "required": True, "options": ["Yes", "No"]},
        {"key": "experience_details", "label": "Previous Experience Details", "type": "textarea", "required": True,
         "placeholder": "Company / organisation, role, duration and what you worked on", "show_if": {"has_experience": ["Yes"]}},
        {"key": "employment_status", "label": "Current Employment Status", "type": "choice", "required": True,
         "options": ["Student", "Fresher", "Employed", "Self-employed", "Other"]},
    ]},
    {"key": "preferences", "title": "Internship & Project Preferences", "fields": [
        {"key": "project_type", "label": "Preferred Project / Task Type", "type": "select", "required": True,
         "options": ["Development", "Machine Learning", "Data Analysis", "Testing", "Research", "Automation", "Support", "Open to Any"]},
        {"key": "difficulty", "label": "Preferred Difficulty Level", "type": "choice", "required": True,
         "options": ["Beginner", "Intermediate", "Challenging", "Let ARINSA Decide"]},
        {"key": "working_style", "label": "Preferred Working Style", "type": "choice", "required": True, "options": ["Individual", "Team", "No Preference"]},
        {"key": "hours_per_day", "label": "Hours Available Per Day", "type": "choice", "required": True, "options": ["Less than 1", "1–2", "2–4", "4+"]},
        {"key": "working_time", "label": "Preferred Working Time", "type": "choice", "required": True,
         "options": ["Morning", "Afternoon", "Evening", "Night", "Flexible"]},
    ]},
    {"key": "career", "title": "Learning & Career Information", "fields": [
        {"key": "expectations", "label": "What do you expect to learn from this internship?", "type": "textarea", "required": True},
        {"key": "career_goal", "label": "Career Goal / Target Role", "type": "text", "required": True, "placeholder": "e.g. ML Engineer, Data Scientist, Software Developer"},
        {"key": "improve_areas", "label": "Areas You Want to Improve", "type": "textarea", "required": True},
        {"key": "comments", "label": "Additional Information / Comments", "type": "textarea", "required": False},
    ]},
]

FIELDS = {f["key"]: f for s in SECTIONS for f in s["fields"]}

# Map the form's Primary Area onto the shared Areas of Interest used for work assignment.
AREA_ALIASES = {"AI/ML": "AI / ML", "GenAI": "Generative AI", "Testing": "Testing / QA"}


def visible(field: dict, d: dict) -> bool:
    cond = field.get("show_if")
    return not cond or all(d.get(k) in allowed for k, allowed in cond.items())


def clean(details: dict | None) -> dict:
    """Keep only known keys with values of the right shape and allowed options."""
    out: dict = {}
    for k, v in (details or {}).items():
        f = FIELDS.get(k)
        if f is None or v in (None, "", []):
            continue
        t = f["type"]
        if t in ("text", "textarea"):
            out[k] = str(v).strip()[: 4000 if t == "textarea" else 300]
        elif t == "year":
            try:
                y = int(v)
            except (TypeError, ValueError):
                raise ValueError(f"{f['label']}: enter a valid year")
            if not 1950 <= y <= 2100:
                raise ValueError(f"{f['label']}: enter a valid year")
            out[k] = y
        elif t in ("select", "choice"):
            if v not in f["options"]:
                raise ValueError(f"{f['label']}: invalid option")
            out[k] = v
        elif t == "tags":
            if not isinstance(v, list):
                raise ValueError(f"{f['label']}: invalid value")
            out[k] = list(dict.fromkeys(str(x).strip()[:60] for x in v if str(x).strip()))[:40]
        elif t == "leveled":
            if not isinstance(v, list):
                raise ValueError(f"{f['label']}: invalid value")
            items = []
            for it in v[:40]:
                name, level = str((it or {}).get("name", "")).strip()[:60], (it or {}).get("level")
                if name and level in f["levels"]:
                    items.append({"name": name, "level": level})
            out[k] = items
        if k in out and out[k] in ("", []):
            out.pop(k)
    return {k: v for k, v in out.items() if visible(FIELDS[k], out)}


def missing(details: dict) -> list[str]:
    return [f["label"] for f in FIELDS.values() if f["required"] and visible(f, details) and details.get(f["key"]) in (None, "", [])]


def summary_text(details: dict) -> dict:
    """Derived plain-text values for the legacy columns (search, exports, older screens)."""
    skills = list(details.get("skills", []))
    skills += [f"{x['name']} ({x['level']})" for x in details.get("languages", []) + details.get("frameworks", [])]
    edu = " – ".join(x for x in (details.get("qualification"), details.get("specialization")) if x)
    return {"education": edu or None, "skills": ", ".join(skills) or None,
            "experience": details.get("experience_details") if details.get("has_experience") == "Yes" else ("No previous experience" if details.get("has_experience") == "No" else None),
            "preferred_role": details.get("career_goal"), "comments": details.get("comments")}
