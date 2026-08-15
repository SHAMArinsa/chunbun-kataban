import mimetypes
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student, get_current_user, require_any_role
from app.models.auth import User
from app.models.engagement import FAQ, SupportTicket, TicketReply
from app.models.people import Admin, Student
from app.schemas.engagement import (
    FAQCreateRequest,
    FAQOut,
    SupportTicketOut,
    SupportTicketUpdateRequest,
    TicketReplyOut,
)
from app.services.notification_service import notify_student
from app.services.storage import download_response, save
from app.utils.file_validation import read_and_validate_upload

router = APIRouter(prefix="/api/support", tags=["support"])


def _reply_out(db: Session, reply: TicketReply) -> TicketReplyOut:
    user = db.get(User, reply.sender_user_id)
    sender_name = None
    if user is not None:
        if user.role.name == "student":
            student = db.query(Student).filter(Student.user_id == user.id).first()
            sender_name = student.full_name if student else user.email
        else:
            admin = db.query(Admin).filter(Admin.user_id == user.id).first()
            sender_name = admin.full_name if admin else user.email
    return TicketReplyOut(
        id=reply.id, sender_user_id=reply.sender_user_id, sender_name=sender_name,
        sender_role=user.role.name if user else None, message=reply.message,
        attachment_name=reply.attachment_name, created_at=reply.created_at,
    )


def _ticket_out(db: Session, ticket: SupportTicket) -> SupportTicketOut:
    student = db.get(Student, ticket.student_id)
    return SupportTicketOut(
        id=ticket.id, student_id=ticket.student_id,
        student_full_name=student.full_name if student else None,
        student_email=student.email if student else None,
        subject=ticket.subject, description=ticket.description, category=ticket.category,
        status=ticket.status, priority=ticket.priority, attachment_name=ticket.attachment_name,
        created_at=ticket.created_at, updated_at=ticket.updated_at,
        replies=[_reply_out(db, r) for r in sorted(ticket.replies, key=lambda r: r.id)],
    )


@router.post("/tickets", response_model=SupportTicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    subject: str = Form(...),
    description: str = Form(...),
    category: str = Form("other"),
    priority: str = Form("medium"),
    file: UploadFile | None = None,
    db: Session = Depends(get_db),
    student: Student = Depends(get_current_student),
):
    ticket = SupportTicket(student_id=student.id, subject=subject, description=description, category=category, priority=priority)
    if file is not None and file.filename:
        content, _ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
        ticket.attachment_path = save(content, "support_tickets", file.filename)
        ticket.attachment_name = file.filename
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return _ticket_out(db, ticket)


@router.get("/tickets/me", response_model=list[SupportTicketOut])
def my_tickets(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    tickets = db.query(SupportTicket).filter(SupportTicket.student_id == student.id).order_by(SupportTicket.id.desc()).all()
    return [_ticket_out(db, t) for t in tickets]


@router.get("/tickets", response_model=list[SupportTicketOut])
def list_tickets(status_filter: str | None = None, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    query = db.query(SupportTicket)
    if status_filter:
        query = query.filter(SupportTicket.status == status_filter)
    tickets = query.order_by(SupportTicket.id.desc()).all()
    return [_ticket_out(db, t) for t in tickets]


@router.get("/tickets/{ticket_id}", response_model=SupportTicketOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if user.role.name == "student":
        student = db.query(Student).filter(Student.user_id == user.id).first()
        if student is None or ticket.student_id != student.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your ticket")
    return _ticket_out(db, ticket)


@router.put("/tickets/{ticket_id}", response_model=SupportTicketOut)
def update_ticket(ticket_id: int, payload: SupportTicketUpdateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ticket, field, value)
    if payload.status in ("resolved", "closed"):
        ticket.closed_at = datetime.now(timezone.utc)
    db.add(ticket)
    if payload.status is not None:
        student = db.get(Student, ticket.student_id)
        if student is not None:
            notify_student(
                db, student,
                title=f"Ticket #{ticket.id} {payload.status.replace('_', ' ')}",
                message=f'Your support ticket "{ticket.subject}" is now {payload.status.replace("_", " ")}.',
                notification_type="info",
                link_url="/support",
            )
    db.commit()
    db.refresh(ticket)
    return _ticket_out(db, ticket)


@router.post("/tickets/{ticket_id}/replies", response_model=TicketReplyOut, status_code=status.HTTP_201_CREATED)
async def reply_to_ticket(
    ticket_id: int,
    message: str = Form(...),
    file: UploadFile | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if user.role.name == "student":
        student = db.query(Student).filter(Student.user_id == user.id).first()
        if student is None or ticket.student_id != student.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your ticket")
    reply = TicketReply(ticket_id=ticket_id, sender_user_id=user.id, message=message)
    if file is not None and file.filename:
        content, _ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
        reply.attachment_path = save(content, "support_tickets", file.filename)
        reply.attachment_name = file.filename
    db.add(reply)
    if user.role.name == "admin":
        if ticket.status == "open":
            ticket.status = "in_progress"
            db.add(ticket)
        student = db.get(Student, ticket.student_id)
        if student is not None:
            notify_student(
                db, student,
                title=f'New reply on ticket "{ticket.subject}"',
                message=message[:200],
                notification_type="info",
                link_url="/support",
            )
    db.commit()
    db.refresh(reply)
    return _reply_out(db, reply)


def _attachment_download(db: Session, user: User, attachment_path: str | None, attachment_name: str | None, ticket_student_id: int):
    if user.role.name == "student":
        student = db.query(Student).filter(Student.user_id == user.id).first()
        if student is None or ticket_student_id != student.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your ticket")
    if not attachment_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No attachment")
    media_type, _ = mimetypes.guess_type(attachment_name or attachment_path)
    return download_response(attachment_path, filename=attachment_name or "attachment", media_type=media_type or "application/octet-stream")


@router.get("/tickets/{ticket_id}/attachment")
def download_ticket_attachment(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return _attachment_download(db, user, ticket.attachment_path, ticket.attachment_name, ticket.student_id)


@router.get("/tickets/{ticket_id}/replies/{reply_id}/attachment")
def download_reply_attachment(ticket_id: int, reply_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    reply = db.get(TicketReply, reply_id)
    if reply is None or reply.ticket_id != ticket_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found")
    return _attachment_download(db, user, reply.attachment_path, reply.attachment_name, ticket.student_id)


@router.get("/faqs", response_model=list[FAQOut])
def list_faqs(db: Session = Depends(get_db), _=Depends(require_any_role)):
    return db.query(FAQ).filter(FAQ.is_active.is_(True)).order_by(FAQ.order_index).all()


@router.post("/faqs", response_model=FAQOut, status_code=status.HTTP_201_CREATED)
def create_faq(payload: FAQCreateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    faq = FAQ(**payload.model_dump())
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return faq
