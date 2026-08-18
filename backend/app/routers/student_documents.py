from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_student, require_any_role
from app.models.engagement import StudentDocument
from app.models.people import Admin, Student
from app.schemas.certificate import StudentDocumentOut
from app.services.activity_log_service import log_activity
from app.services.storage import delete as delete_file, download_response, save
from app.utils.file_validation import read_and_validate_upload

router = APIRouter(prefix="/api/student-documents", tags=["student-documents"])

DOCUMENT_TYPES = {"invoice", "welcome_certificate"}


def _out(document: StudentDocument, student: Student | None = None) -> StudentDocumentOut:
    return StudentDocumentOut(
        id=document.id,
        student_id=document.student_id,
        document_type=document.document_type,
        title=document.title,
        file_name=document.file_name,
        uploaded_at=document.uploaded_at,
        student_name=student.full_name if student else None,
        student_email=student.email if student else None,
    )


@router.post("", response_model=StudentDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_student_document(
    student_id: int = Form(...),
    document_type: str = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document type must be invoice or welcome_certificate")
    if not title.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document title is required")
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    content, ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    if ext != "pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoices and certificates must be uploaded as PDF files")

    document = StudentDocument(
        student_id=student.id,
        document_type=document_type,
        title=title.strip(),
        file_path=save(content, "student_documents", file.filename),
        file_name=file.filename,
        uploaded_by=admin.id,
    )
    db.add(document)
    db.flush()
    log_activity(db, admin.user_id, "admin", "upload_student_document", "student_documents", document.id, f"{document_type} for student {student.id}")
    db.commit()
    db.refresh(document)
    return _out(document, student)


@router.get("", response_model=list[StudentDocumentOut])
def list_student_documents(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    documents = db.query(StudentDocument).order_by(StudentDocument.id.desc()).all()
    students = {student.id: student for student in db.query(Student).filter(Student.id.in_([doc.student_id for doc in documents])).all()} if documents else {}
    return [_out(document, students.get(document.student_id)) for document in documents]


@router.get("/me", response_model=list[StudentDocumentOut])
def list_my_student_documents(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    documents = db.query(StudentDocument).filter(StudentDocument.student_id == student.id).order_by(StudentDocument.id.desc()).all()
    return [_out(document, student) for document in documents]


@router.get("/{document_id}/download")
def download_student_document(document_id: int, db: Session = Depends(get_db), role_user=Depends(require_any_role)):
    document = db.get(StudentDocument, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if role_user.role.name != "admin":
        student = db.query(Student).filter(Student.user_id == role_user.id).first()
        if student is None or student.id != document.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your document")
    return download_response(document.file_path, document.file_name, media_type="application/pdf")


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student_document(document_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    document = db.get(StudentDocument, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    path = document.file_path
    db.delete(document)
    log_activity(db, admin.user_id, "admin", "delete_student_document", "student_documents", document_id, None)
    db.commit()
    try:
        delete_file(path)
    except RuntimeError:
        pass
