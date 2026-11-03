from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_staff, require_academic_role, require_unsuspended_student
from app.models.content import LearningMaterial, MaterialAssignment
from app.models.people import Admin, Student
from app.schemas.content import LearningMaterialOut, MaterialAssignRequest, MaterialUpdateRequest
from app.services.activity_log_service import log_activity
from app.services.assignment_visibility import visible_ids_for_student
from app.services.storage import delete as delete_file, download_response, save
from app.utils.file_validation import read_and_validate_upload, read_and_validate_video

router = APIRouter(prefix="/api/materials", tags=["materials"])


def _checked_chapter(db: Session, chapter_id: int | None, program_id: int | None) -> int | None:
    """A video may only be placed in a chapter of its own program."""
    if chapter_id is None:
        return None
    from app.models.content import CourseChapter, CourseModule
    chapter = db.get(CourseChapter, chapter_id)
    if chapter is None or db.get(CourseModule, chapter.module_id).program_id != program_id:
        raise HTTPException(status_code=400, detail="Chapter not found in this program")
    return chapter_id


@router.post("", response_model=LearningMaterialOut, status_code=status.HTTP_201_CREATED)
async def upload_material(
    title: str = Form(...),
    description: str | None = Form(None),
    program_id: int = Form(...),
    domain_id: int | None = Form(None),
    week_number: int | None = Form(None),
    is_platinum_exclusive: bool = Form(False),
    content_type: str = Form("file"),
    resource_url: str | None = Form(None),
    display_order: int = Form(0),
    publication_state: str = Form("published"),
    chapter_id: int | None = Form(None),
    duration_minutes: int | None = Form(None),
    file: UploadFile | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_staff),
):
    """Every material belongs to exactly one program (plan). Publishing it makes it visible to
    that program's actively-enrolled students — no separate assign step required.
    content_type "file" needs an upload; "video" / "link" need a resource_url instead."""
    if content_type not in ("file", "video", "link"):
        raise HTTPException(status_code=400, detail="content_type must be file, video or link")
    if publication_state not in ("published", "draft"):
        raise HTTPException(status_code=400, detail="publication_state must be published or draft")
    relative_path = ext = size = None
    if content_type == "file":
        if file is None or not file.filename:
            raise HTTPException(status_code=400, detail="A file is required")
        content, ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
        relative_path, size = save(content, "materials", file.filename), len(content)
    elif content_type == "video" and file is not None and file.filename:
        content, ext = await read_and_validate_video(file, settings.MAX_VIDEO_UPLOAD_MB)
        relative_path, size = save(content, "materials", file.filename), len(content)
        resource_url = None
    elif not resource_url or not resource_url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="A valid http(s) link is required for videos and links")

    material = LearningMaterial(
        program_id=program_id,
        domain_id=domain_id,
        week_number=week_number,
        title=title,
        description=description,
        file_path=relative_path,
        file_type=ext,
        file_size_bytes=size,
        content_type=content_type,
        resource_url=resource_url if content_type != "file" else None,
        display_order=display_order,
        publication_state=publication_state,
        is_platinum_exclusive=is_platinum_exclusive,
        chapter_id=_checked_chapter(db, chapter_id, program_id),
        duration_minutes=duration_minutes,
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

    log_activity(db, admin.user_id, admin.user.role.name, "upload_material", "learning_materials", material.id, title)
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
    admin: Admin = Depends(get_current_staff),
):
    """Swaps the underlying file on an existing material (e.g. an updated PDF) while keeping
    its id, program assignment, and student visibility intact. Old file is deleted from disk."""
    material = db.get(LearningMaterial, material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    is_video = material.content_type == "video"
    if is_video:
        content, ext = await read_and_validate_video(file, settings.MAX_VIDEO_UPLOAD_MB)
    else:
        content, ext = await read_and_validate_upload(file, settings.MAX_UPLOAD_SIZE_MB)
    new_path = save(content, "materials", file.filename)

    old_path = material.file_path
    material.content_type, material.resource_url = ("video" if is_video else "file"), None
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

    log_activity(db, admin.user_id, admin.user.role.name, "replace_material_file", "learning_materials", material.id, material.title)
    db.commit()
    db.refresh(material)

    if old_path:
        delete_file(old_path)
    return material


@router.patch("/{material_id}", response_model=LearningMaterialOut)
def update_material(material_id: int, payload: MaterialUpdateRequest, db: Session = Depends(get_db),
                    admin: Admin = Depends(get_current_staff)):
    """Edit title/description/order and publish or unpublish without replacing the file."""
    material = db.get(LearningMaterial, material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("publication_state") not in (None, "published", "draft"):
        raise HTTPException(status_code=400, detail="publication_state must be published or draft")
    if "resource_url" in data and material.content_type == "file":
        data.pop("resource_url")
    if "chapter_id" in payload.model_fields_set:
        data["chapter_id"] = _checked_chapter(db, payload.chapter_id, material.program_id)
    for key, value in data.items():
        setattr(material, key, value)
    log_activity(db, admin.user_id, admin.user.role.name, "update_material", "learning_materials", material.id, material.title)
    db.commit()
    db.refresh(material)
    return material


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_staff),
):
    material = db.get(LearningMaterial, material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    file_path = material.file_path
    title = material.title

    db.query(MaterialAssignment).filter(MaterialAssignment.material_id == material_id).delete(synchronize_session=False)
    db.delete(material)
    log_activity(db, admin.user_id, admin.user.role.name, "delete_material", "learning_materials", material_id, title)
    db.commit()

    if file_path:
        delete_file(file_path)
    return None


@router.post("/{material_id}/assign", status_code=status.HTTP_201_CREATED)
def assign_material(
    material_id: int,
    payload: MaterialAssignRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_staff),
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
    role_user=Depends(require_academic_role),
):
    if role_user.role.name in ("admin", "instructor"):
        query = db.query(LearningMaterial)
        if program_id:
            query = query.filter(LearningMaterial.program_id == program_id)
        return query.order_by(LearningMaterial.display_order, LearningMaterial.id.desc()).all()

    student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
    if student_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    visible_ids = visible_ids_for_student(db, student_row, MaterialAssignment, "material_id")
    if not visible_ids:
        return []
    return (db.query(LearningMaterial).filter(LearningMaterial.id.in_(visible_ids))
            .order_by(LearningMaterial.display_order, LearningMaterial.id.desc()).all())


@router.get("/{material_id}/download")
def download_material(
    material_id: int,
    db: Session = Depends(get_db),
    role_user=Depends(require_academic_role),
):
    material = db.get(LearningMaterial, material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    if role_user.role.name not in ("admin", "instructor"):
        student_row = db.query(Student).filter(Student.user_id == role_user.id).first()
        if student_row is not None:
            require_unsuspended_student(student_row, db)
        visible_ids = visible_ids_for_student(db, student_row, MaterialAssignment, "material_id") if student_row else []
        if material_id not in visible_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Material not assigned to you")

    if not material.file_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This material is a link; open its resource_url")
    return download_response(material.file_path, filename=material.title + "." + material.file_type)
