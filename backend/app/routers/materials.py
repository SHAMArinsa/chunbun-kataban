from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_admin, require_any_role, require_unsuspended_student
from app.models.content import LearningMaterial, MaterialAssignment
from app.models.people import Admin, Student
from app.schemas.content import LearningMaterialOut, MaterialAssignRequest
from app.services.activity_log_service import log_activity
from app.services.assignment_visibility import visible_ids_for_student
from app.services.storage import delete as delete_file, download_response, save
from app.utils.file_validation import read_and_validate_upload

router = APIRouter(prefix="/api/materials", tags=["materials"])


@router.post("", response_model=LearningMaterialOut, status_code=status.HTTP_201_CREATED)
async def upload_material(
    title: str = Form(...),
    description: str | None = Form(None),
    program_id: int = Form(...),
    domain_id: int | None = Form(None),
    week_number: int | None = Form(None),
    is_platinum_exclusive: bool = Form(False),
    file: UploadFile = ...,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Every material belongs to exactly one program (plan). Uploading it immediately makes it
    visible to that program's actively-enrolled students — no separate assign step required."""
    content, ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    relative_path = save(content, "materials", file.filename)

    material = LearningMaterial(
        program_id=program_id,
        domain_id=domain_id,
        week_number=week_number,
        title=title,
        description=description,
        file_path=relative_path,
        file_type=ext,
        file_size_bytes=len(content),
        is_platinum_exclusive=is_platinum_exclusive,
        uploaded_by=admin.id,
    )
    db.add(material)
    db.flush()

    db.add(MaterialAssignment(
        material_id=material.id,
        assignment_scope="program",
        program_id=program_id,
        assigned_by=admin.id,
    ))

    log_activity(db, admin.user_id, "admin", "upload_material", "learning_materials", material.id, title)
    db.commit()
    db.refresh(material)
    return material


@router.put("/{material_id}/replace-file", response_model=LearningMaterialOut)
async def replace_material_file(
    material_id: int,
    title: str | None = Form(None),
    description: str | None = Form(None),
    week_number: int | None = Form(None),
    file: UploadFile = ...,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Swaps the underlying file on an existing material (e.g. an updated PDF) while keeping
    its id, program assignment, and student visibility intact. Old file is deleted from disk."""
    material = db.get(LearningMaterial, material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    content, ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    new_path = save(content, "materials", file.filename)

    old_path = material.file_path
    material.file_path = new_path
    material.file_type = ext
    material.file_size_bytes = len(content)
    if title is not None:
        material.title = title
    if description is not None:
        material.description = description
    if week_number is not None:
        material.week_number = week_number
    db.add(material)

    log_activity(db, admin.user_id, "admin", "replace_material_file", "learning_materials", material.id, material.title)
    db.commit()
    db.refresh(material)

    delete_file(old_path)
    return material


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    material = db.get(LearningMaterial, material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    file_path = material.file_path
    title = material.title

    db.query(MaterialAssignment).filter(MaterialAssignment.material_id == material_id).delete(synchronize_session=False)
    db.delete(material)
    log_activity(db, admin.user_id, "admin", "delete_material", "learning_materials", material_id, title)
    db.commit()

    delete_file(file_path)
    return None


@router.post("/{material_id}/assign", status_code=status.HTTP_201_CREATED)
def assign_material(
    material_id: int,
    payload: MaterialAssignRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    material = db.get(LearningMaterial, material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    targets = [payload.student_id, payload.batch_id, payload.program_id]
    if sum(1 for t in targets if t is not None) != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exactly one of student_id/batch_id/program_id must be set")

    assignment = MaterialAssignment(
        material_id=material_id,
        assignment_scope=payload.assignment_scope,
        student_id=payload.student_id,
        batch_id=payload.batch_id,
        program_id=payload.program_id,
        assigned_by=admin.id,
    )
    db.add(assignment)
    db.commit()
    return {"status": "assigned"}


@router.get("", response_model=list[LearningMaterialOut])
def list_materials(
    program_id: int | None = None,
    db: Session = Depends(get_db),
    role_user=Depends(require_any_role),
):
    if role_user.role.name == "admin":
        query = db.query(LearningMaterial)
        if program_id:
            query = query.filter(LearningMaterial.program_id == program_id)
        return query.order_by(LearningMaterial.id.desc()).all()

    student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
    if student_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    visible_ids = visible_ids_for_student(db, student_row, MaterialAssignment, "material_id")
    if not visible_ids:
        return []
    return db.query(LearningMaterial).filter(LearningMaterial.id.in_(visible_ids)).order_by(LearningMaterial.id.desc()).all()


@router.get("/{material_id}/download")
def download_material(
    material_id: int,
    db: Session = Depends(get_db),
    role_user=Depends(require_any_role),
):
    material = db.get(LearningMaterial, material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    if role_user.role.name != "admin":
        student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
        if student_row is not None:
            require_unsuspended_student(student_row, db)
        visible_ids = visible_ids_for_student(db, student_row, MaterialAssignment, "material_id") if student_row else []
        if material_id not in visible_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Material not assigned to you")

    return download_response(material.file_path, filename=material.title + "." + material.file_type)
