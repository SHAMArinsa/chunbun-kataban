from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.core.security import hash_password
from app.models.auth import Role, User, RefreshToken
from app.models.people import Admin
from app.schemas.staff import InstructorCreate, InstructorOut, InstructorUpdate
from app.services.activity_log_service import log_activity

router = APIRouter(prefix="/api/instructors", tags=["instructors"], dependencies=[Depends(get_current_admin)])


def _out(profile: Admin) -> InstructorOut:
    return InstructorOut(id=profile.id, user_id=profile.user_id, email=profile.user.email,
                         full_name=profile.full_name, is_active=profile.user.is_active)


def _target(db: Session, instructor_id: int) -> Admin:
    row = db.query(Admin).join(User).join(Role).filter(Admin.id == instructor_id, Role.name == "instructor").first()
    if row is None:
        raise HTTPException(404, "Instructor not found")
    return row


@router.get("", response_model=list[InstructorOut])
def list_instructors(db: Session = Depends(get_db)):
    return [_out(row) for row in db.query(Admin).join(User).join(Role).filter(Role.name == "instructor").all()]


@router.get("/{instructor_id}", response_model=InstructorOut)
def get_instructor(instructor_id: int, db: Session = Depends(get_db)):
    return _out(_target(db, instructor_id))


@router.post("", response_model=InstructorOut, status_code=201)
def create_instructor(payload: InstructorCreate, db: Session = Depends(get_db), actor: Admin = Depends(get_current_admin)):
    if db.query(User).filter(User.email == str(payload.email)).first():
        raise HTTPException(409, "Email already registered")
    role = db.query(Role).filter(Role.name == "instructor").first()
    if role is None:
        raise HTTPException(409, "Instructor role requires the Phase 1 migration")
    user = User(email=str(payload.email), password_hash=hash_password(payload.password), role_id=role.id, is_active=True)
    db.add(user)
    db.flush()
    profile = Admin(user_id=user.id, full_name=payload.full_name, is_super_admin=False)
    db.add(profile)
    db.flush()
    log_activity(db, actor.user_id, "admin", "create_instructor", "users", user.id, None)
    db.commit()
    return _out(profile)


@router.patch("/{instructor_id}", response_model=InstructorOut)
def update_instructor(instructor_id: int, payload: InstructorUpdate, db: Session = Depends(get_db), actor: Admin = Depends(get_current_admin)):
    profile = _target(db, instructor_id)
    profile.user.is_active = payload.is_active
    if not payload.is_active:
        db.query(RefreshToken).filter(RefreshToken.user_id == profile.user_id, RefreshToken.revoked.is_(False)).update(
            {"revoked": True, "revoked_at": datetime.now(timezone.utc)}, synchronize_session=False)
    log_activity(db, actor.user_id, "admin", "set_instructor_active", "users", profile.user_id, str(payload.is_active))
    db.commit()
    return _out(profile)
