from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.auth import Role, User
from app.models.people import Admin, Student
from app.models.program import ACTIVE_ENROLLMENT_STATUSES, ProgramEnrollment

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_role(*role_names: str):
    def dependency(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        role = db.get(Role, user.role_id)
        if role is None or role.name not in role_names:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return dependency


require_admin = require_role("admin")
require_student = require_role("student")
require_any_role = require_role("admin", "student")


def get_current_student(user: User = Depends(require_student), db: Session = Depends(get_db)) -> Student:
    student = db.query(Student).filter(Student.user_id == user.id).first()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    return student


def require_unsuspended_student(
    student: Student = Depends(get_current_student), db: Session = Depends(get_db)
) -> Student:
    """Fail-closed guard for protected assessment/resource endpoints (coding/quiz/project start,
    protected file downloads). A suspended student must not regain access by refreshing the
    page, editing frontend state, or calling the API directly — every such endpoint must
    independently re-check status on every request, not just hide the button in the UI."""
    enrollments = db.query(ProgramEnrollment).filter(ProgramEnrollment.student_id == student.id).all()
    has_active = any(e.status in ACTIVE_ENROLLMENT_STATUSES for e in enrollments)
    is_suspended = not has_active and any(e.status == "suspended" for e in enrollments)
    if is_suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is suspended. Please contact Support to resolve this before accessing protected content.",
        )
    return student


def get_current_admin(user: User = Depends(require_admin), db: Session = Depends(get_db)) -> Admin:
    admin = db.query(Admin).filter(Admin.user_id == user.id).first()
    if admin is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin profile not found")
    return admin


def get_current_super_admin(admin: Admin = Depends(get_current_admin)) -> Admin:
    if not admin.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return admin
