import re
def proper_name(name: str | None) -> str:
    """'sayan das' / 'SAYAN DAS' -> 'Sayan Das'. Mixed-case words (McDonald, DeSouza) are kept;
    hyphens and apostrophes start a new capital (Mary-Ann, O'Neil)."""
    if not name:
        return name or ""
    def fix(word: str) -> str:
        if word.islower() or word.isupper():
            word = word.lower()
            return re.sub(r"(^|[-'’.])([a-z])", lambda m: m.group(1) + m.group(2).upper(), word)
        return word[:1].upper() + word[1:]
    return " ".join(fix(w) for w in name.split())
