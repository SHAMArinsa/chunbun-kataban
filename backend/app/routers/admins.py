from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_super_admin, require_admin
from app.core.permissions import AREAS, clean
from app.core.security import hash_password
from app.models.auth import RefreshToken, Role, User
from app.models.people import Admin
from app.schemas.people import AdminCreateRequest, AdminOut, AdminUpdateRequest

router = APIRouter(prefix="/api/admins", tags=["admins"])


def _admin_out(row: Admin) -> AdminOut:
    return AdminOut(
        id=row.id, user_id=row.user_id, full_name=row.full_name, designation=row.designation,
        department=row.department, is_super_admin=row.is_super_admin, email=row.user.email,
        permissions=None if row.is_super_admin else row.permissions, is_active=row.user.is_active,
        last_login_at=row.user.last_login_at,
    )


def _super_count(db: Session) -> int:
    return (db.query(Admin).join(User).join(Role)
            .filter(Role.name == "admin", Admin.is_super_admin.is_(True), User.is_active.is_(True)).count())


@router.get("/areas")
def list_areas(admin=Depends(require_admin)):
    return [{"key": k, "label": v} for k, v in AREAS.items()]


@router.get("", response_model=list[AdminOut])
def list_admins(admin: Admin = Depends(get_current_super_admin), db: Session = Depends(get_db)):
    rows = db.query(Admin).join(User).join(Role).filter(Role.name == "admin").order_by(Admin.id).all()
    return [_admin_out(row) for row in rows]


@router.post("", response_model=AdminOut, status_code=status.HTTP_201_CREATED)
def create_admin(payload: AdminCreateRequest, admin: Admin = Depends(get_current_super_admin), db: Session = Depends(get_db)):
    """Only a super admin can create admins, choose super admin or pick the areas they can access."""
    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    perms = clean(payload.permissions)
    if not payload.is_super_admin and not perms:
        raise HTTPException(status_code=400, detail="Select at least one area this admin can access")
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    user = User(email=email, password_hash=hash_password(payload.password), role_id=admin_role.id, is_active=True)
    db.add(user)
    db.flush()
    new_admin = Admin(
        user_id=user.id, full_name=payload.full_name.strip(), designation=payload.designation,
        department=payload.department, is_super_admin=payload.is_super_admin,
        permissions=None if payload.is_super_admin else perms,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return _admin_out(new_admin)


@router.put("/{admin_id}", response_model=AdminOut)
def update_admin(admin_id: int, payload: AdminUpdateRequest, admin: Admin = Depends(get_current_super_admin), db: Session = Depends(get_db)):
    target = db.get(Admin, admin_id)
    if target is None or target.user.role.name != "admin":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    data = payload.model_dump(exclude_unset=True)
    me = target.id == admin.id
    if me and (data.get("is_super_admin") is False or data.get("is_active") is False):
        raise HTTPException(status_code=400, detail="You can't remove your own super admin access or deactivate yourself")
    losing_super = target.is_super_admin and (data.get("is_super_admin") is False or data.get("is_active") is False)
    if losing_super and _super_count(db) <= 1:
        raise HTTPException(status_code=400, detail="There must always be at least one active super admin")

    if "is_super_admin" in data and data["is_super_admin"] is not None:
        target.is_super_admin = data["is_super_admin"]
    if "permissions" in data and data["permissions"] is not None:
        target.permissions = clean(data["permissions"])
    if not target.is_super_admin and not target.permissions:
        raise HTTPException(status_code=400, detail="Select at least one area this admin can access")
    if target.is_super_admin:
        target.permissions = None
    for field in ("full_name", "designation", "department"):
        if data.get(field) is not None:
            setattr(target, field, data[field].strip() or getattr(target, field))
    if data.get("password"):
        if len(data["password"]) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        target.user.password_hash = hash_password(data["password"])
    if data.get("is_active") is not None:
        target.user.is_active = data["is_active"]
    if data.get("is_active") is False or data.get("password"):
        db.query(RefreshToken).filter(RefreshToken.user_id == target.user_id, RefreshToken.revoked.is_(False)).update(
            {"revoked": True, "revoked_at": datetime.now(timezone.utc)}, synchronize_session=False)
    db.add(target)
    db.commit()
    db.refresh(target)
    return _admin_out(target)
