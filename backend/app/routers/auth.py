from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.auth import EmailOtp, Role, User
from app.models.nda import NdaAcceptance
from app.models.people import Student
from app.models.program import Payment, ProgramEnrollment
from app.schemas.auth import (
    AccessTokenResponse,
    EmailOtpSendRequest,
    EmailOtpVerifyRequest,
    LoginRequest,
    StudentRegisterRequest,
    UserMeOut,
)
from app.services.auth_service import find_valid_refresh_token, issue_refresh_token, revoke_refresh_token
from app.services.otp_service import is_email_verified, request_email_otp, verify_email_otp
from app.services.storage import delete as delete_stored_file

router = APIRouter(prefix="/api/auth", tags=["auth"])

REFRESH_COOKIE_PATH = "/api/auth"


def _cookie_name_for(request: Request) -> str:
    """Both portals call the same backend origin, so a single cookie name would let one
    portal's session silently hijack the other's silent-refresh in a shared browser.
    Scope the cookie name by which frontend origin issued the request instead."""
    origin = request.headers.get("origin", "")
    if origin == settings.ADMIN_PORTAL_URL:
        return "refresh_token_admin"
    return "refresh_token_student"


def _set_refresh_cookie(request: Request, response: Response, token: str) -> None:
    response.set_cookie(
        key=_cookie_name_for(request),
        value=token,
        httponly=True,
        # Vercel frontends and Render API are cross-site in production. Browsers require
        # SameSite=None together with Secure for the refresh request to include this cookie.
        samesite="none" if settings.is_production else "lax",
        secure=settings.is_production,
        path=REFRESH_COOKIE_PATH,
        max_age=60 * 60 * 24 * 7,
    )


def _delete_unpaid_signup(db: Session, user: User) -> bool:
    """Remove every persisted trace of an abandoned signup.

    Returns False for a paid account, which must never be removed automatically.
    """
    student = db.query(Student).filter(Student.user_id == user.id).first()
    if student is None:
        return False
    payments = db.query(Payment).filter(Payment.student_id == student.id).all()
    if any(payment.status == "paid" for payment in payments):
        return False

    document_paths = [student.national_id_document_front_path, student.national_id_document_back_path]
    enrollment_ids = [enrollment.id for enrollment in db.query(ProgramEnrollment).filter(ProgramEnrollment.student_id == student.id).all()]
    if enrollment_ids:
        db.query(NdaAcceptance).filter(NdaAcceptance.enrollment_id.in_(enrollment_ids)).delete(synchronize_session=False)
    db.query(Payment).filter(Payment.student_id == student.id).delete(synchronize_session=False)
    db.query(ProgramEnrollment).filter(ProgramEnrollment.student_id == student.id).delete(synchronize_session=False)
    db.query(EmailOtp).filter(EmailOtp.email == user.email, EmailOtp.purpose == "signup").delete(synchronize_session=False)
    db.delete(user)
    db.commit()

    for document_path in document_paths:
        if document_path:
            try:
                delete_stored_file(document_path)
            except Exception:
                pass
    return True


@router.post("/otp/send", status_code=status.HTTP_204_NO_CONTENT)
def send_signup_otp(payload: EmailOtpSendRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing and not _delete_unpaid_signup(db, existing):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    request_email_otp(db, payload.email, purpose="signup")
    return None


@router.post("/otp/verify", status_code=status.HTTP_204_NO_CONTENT)
def verify_signup_otp(payload: EmailOtpVerifyRequest, db: Session = Depends(get_db)):
    verify_email_otp(db, payload.email, payload.code, purpose="signup")
    return None


@router.post("/register", response_model=AccessTokenResponse, status_code=status.HTTP_201_CREATED)
def register_student(payload: StudentRegisterRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    if not is_email_verified(db, payload.email, purpose="signup"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please verify your email before signing up")

    student_role = db.query(Role).filter(Role.name == "student").first()
    if student_role is None:
        raise HTTPException(status_code=500, detail="Student role not seeded")

    user = User(email=payload.email, password_hash=hash_password(payload.password), role_id=student_role.id, phone=payload.phone)
    db.add(user)
    db.flush()

    student = Student(
        user_id=user.id,
        full_name=payload.full_name,
        phone=payload.phone,
        citizenship_status=payload.citizenship_status,
        country=payload.country,
        dob=payload.dob,
        national_id_type=payload.national_id_type,
        national_id_number=payload.national_id_number,
    )
    db.add(student)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.id, "student")
    refresh_token = issue_refresh_token(db, user.id, request.headers.get("user-agent"), request.client.host if request.client else None)
    _set_refresh_cookie(request, response, refresh_token)

    return AccessTokenResponse(access_token=access_token, role="student", user_id=user.id)


@router.post("/signup/cancel", status_code=status.HTTP_204_NO_CONTENT)
def cancel_unpaid_signup(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Erase a newly verified signup when its payment is abandoned.

    This endpoint is deliberately limited to accounts with no successful payment,
    so a paid student can never accidentally remove their account from checkout.
    """
    if not _delete_unpaid_signup(db, user):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A paid account cannot be cancelled")
    response.delete_cookie(_cookie_name_for(request), path=REFRESH_COOKIE_PATH)
    return None


@router.post("/login", response_model=AccessTokenResponse)
def login(payload: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    role = db.get(Role, user.role_id)
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()

    access_token = create_access_token(user.id, role.name)
    refresh_token = issue_refresh_token(db, user.id, request.headers.get("user-agent"), request.client.host if request.client else None)
    _set_refresh_cookie(request, response, refresh_token)

    return AccessTokenResponse(access_token=access_token, role=role.name, user_id=user.id)


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    raw_token = request.cookies.get(_cookie_name_for(request))
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    token_row = find_valid_refresh_token(db, raw_token)
    if token_row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user = db.get(User, token_row.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer active")

    role = db.get(Role, user.role_id)

    revoke_refresh_token(db, token_row)
    new_refresh_token = issue_refresh_token(db, user.id, request.headers.get("user-agent"), request.client.host if request.client else None)
    _set_refresh_cookie(request, response, new_refresh_token)

    access_token = create_access_token(user.id, role.name)
    return AccessTokenResponse(access_token=access_token, role=role.name, user_id=user.id)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    cookie_name = _cookie_name_for(request)
    raw_token = request.cookies.get(cookie_name)
    if raw_token:
        token_row = find_valid_refresh_token(db, raw_token)
        if token_row is not None:
            revoke_refresh_token(db, token_row)
    response.delete_cookie(cookie_name, path=REFRESH_COOKIE_PATH)
    return None


@router.get("/me", response_model=UserMeOut)
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    role = db.get(Role, user.role_id)
    full_name = None
    is_super_admin = False
    student_id = None
    national_id_type = None
    national_id_number = None
    if role.name == "student" and user.student:
        full_name = user.student.full_name
        student_id = user.student.id
        national_id_type = user.student.national_id_type
        national_id_number = user.student.national_id_number
    elif role.name == "admin" and user.admin:
        full_name = user.admin.full_name
        is_super_admin = user.admin.is_super_admin
    return UserMeOut(
        id=user.id,
        email=user.email,
        role=role.name,
        is_active=user.is_active,
        full_name=full_name,
        is_super_admin=is_super_admin,
        student_id=student_id,
        national_id_type=national_id_type,
        national_id_number=national_id_number,
    )
