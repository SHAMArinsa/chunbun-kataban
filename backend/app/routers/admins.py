from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_super_admin, require_admin
from app.core.security import hash_password
from app.models.auth import Role, User
from app.models.people import Admin
from app.schemas.people import AdminCreateRequest, AdminOut, AdminUpdateRequest

router = APIRouter(prefix="/api/admins", tags=["admins"])


def _admin_out(row: Admin) -> AdminOut:
    return AdminOut(
        id=row.id, user_id=row.user_id, full_name=row.full_name, designation=row.designation,
        department=row.department, is_super_admin=row.is_super_admin, email=row.user.email,
    )


@router.get("", response_model=list[AdminOut])
def list_admins(admin=Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(Admin).order_by(Admin.id).all()
    return [_admin_out(row) for row in rows]


@router.post("", response_model=AdminOut, status_code=status.HTTP_201_CREATED)
def create_admin(payload: AdminCreateRequest, admin: Admin = Depends(get_current_super_admin), db: Session = Depends(get_db)):
    """Only a super admin can create new admin accounts (and optionally grant them super admin
    themselves) — a regular admin has no path to self-escalate or mint new admins."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    user = User(email=payload.email, password_hash=hash_password(payload.password), role_id=admin_role.id, is_active=True)
    db.add(user)
    db.flush()
    new_admin = Admin(
        user_id=user.id, full_name=payload.full_name, designation=payload.designation,
        department=payload.department, is_super_admin=payload.is_super_admin,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return _admin_out(new_admin)


@router.put("/{admin_id}", response_model=AdminOut)
def update_admin(admin_id: int, payload: AdminUpdateRequest, admin: Admin = Depends(get_current_super_admin), db: Session = Depends(get_db)):
    target = db.get(Admin, admin_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    if target.id == admin.id and payload.is_super_admin is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't remove your own super admin access")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(target, field, value)
    db.add(target)
    db.commit()
    db.refresh(target)
    return _admin_out(target)
