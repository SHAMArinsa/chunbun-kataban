"""Admin access areas.

Super admins can do everything. A regular admin has a list of area keys (admins.permissions);
`None` means "all areas" (accounts created before access control existed). Instructors are
not affected — they keep their existing role-based restrictions.
"""
AREAS: dict[str, str] = {
    "students": "Students",
    "work": "Work Management",
    "mcq": "MCQ Results",
    "selections": "Student Selections",
    "evaluation": "Submissions & Evaluation",
    "mock": "Mock Interviews",
    "eligibility": "Placement Eligibility",
    "programs": "Programs",
    "materials": "Study Materials",
    "certificates": "Certificates & Invoices",
    "payments": "Payments",
    "announcements": "Announcements",
    "proctoring": "Proctoring",
    "reports": "Reports",
    "support": "Support",
    "settings": "Settings",
}

_STUDENT_WORK = {"students", "work", "mcq", "selections", "evaluation", "mock", "eligibility", "certificates"}
_WORK = {"work", "mcq", "selections", "evaluation", "mock", "eligibility"}
_LEGACY = {"__legacy__"}  # closed Premium/Platinum modules: super admins only

# (path prefix, areas that unlock it, open for read-only GET to every admin)
RULES: list[tuple[str, set[str], bool]] = [
    ("/api/v2/staff/dashboard", set(), True),
    ("/api/v2/staff/students", _STUDENT_WORK, False),
    ("/api/v2/staff/enrollments", _STUDENT_WORK, False),
    ("/api/v2/staff/evaluations", {"evaluation"}, False),
    ("/api/v2/staff/work", _WORK, False),
    ("/api/v2/staff/assigned-work", _WORK, False),
    ("/api/v2/staff/real-world-projects", _WORK, False),
    ("/api/v2/staff/projects", _WORK, False),
    ("/api/v2/staff/submissions", _WORK, False),
    ("/api/v2/staff/feedback-messages", _WORK, False),
    ("/api/v2/staff/forms", _WORK, False),
    ("/api/v2/staff/resumes", _WORK, False),
    ("/api/v2/staff/mock-interviews", {"mock"}, False),
    ("/api/v2/staff/mock-interview-files", {"mock"}, False),
    ("/api/v2/staff/certificates", {"certificates"}, False),
    ("/api/v2/staff/invoices", {"certificates", "payments"}, False),
    ("/api/v2/staff/deliveries", {"settings", "certificates"}, False),
    ("/api/v2/staff/programs", {"programs"}, True),
    ("/api/v2/staff/announcements", {"announcements"}, False),
    ("/api/v2/staff/areas-of-interest", {"settings"}, True),
    ("/api/v2/staff/reports", {"reports", "evaluation"}, False),
    ("/api/materials", {"materials", "work"}, False),
    ("/api/payments", {"payments"}, False),
    ("/api/support", {"support"}, False),
    ("/api/proctoring", {"proctoring"}, False),
    ("/api/instructors", {"settings"}, False),
    ("/api/settings", {"settings"}, False),
    ("/api/academic", {"announcements", "students"}, False),
    ("/api/quizzes", _LEGACY, False),
    ("/api/coding-assignments", _LEGACY, False),
    ("/api/projects", _LEGACY, False),
    ("/api/evaluations", _LEGACY, False),
    ("/api/live-classes", _LEGACY, False),
    ("/api/students", _LEGACY, False),
]


def clean(perms) -> list[str]:
    return sorted({p for p in (perms or []) if p in AREAS})


def allowed(path: str, method: str, perms: list[str] | None) -> bool:
    if perms is None:
        return True
    for prefix, areas, read_open in RULES:
        if path == prefix or path.startswith(prefix + "/") or path.startswith(prefix + "?"):
            if not areas or (read_open and method == "GET"):
                return True
            return bool(areas & set(perms))
    return True  # auth, notifications, public and other shared endpoints
