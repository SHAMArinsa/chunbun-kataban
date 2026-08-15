from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, require_any_role
from app.models.people import Admin
from app.models.program import Batch, BatchMember, InternshipProgram, SpecializationTrack
from app.schemas.program import (
    BatchCreateRequest,
    BatchOut,
    ProgramOut,
    ProgramUpdateRequest,
    SpecializationTrackOut,
)
from app.services.activity_log_service import log_activity

router = APIRouter(prefix="/api/programs", tags=["programs"])


@router.get("", response_model=list[ProgramOut])
def list_programs(db: Session = Depends(get_db), _=Depends(require_any_role)):
    return db.query(InternshipProgram).order_by(InternshipProgram.duration_weeks).all()


@router.get("/{program_id}", response_model=ProgramOut)
def get_program(program_id: int, db: Session = Depends(get_db), _=Depends(require_any_role)):
    program = db.get(InternshipProgram, program_id)
    if program is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return program


@router.put("/{program_id}", response_model=ProgramOut)
def update_program(
    program_id: int,
    payload: ProgramUpdateRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    program = db.get(InternshipProgram, program_id)
    if program is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(program, field, value)
    db.add(program)
    log_activity(db, admin.user_id, "admin", "update_program", "internship_programs", program.id, f"Updated {program.name}")
    db.commit()
    db.refresh(program)
    return program


tracks_router = APIRouter(prefix="/api/specialization-tracks", tags=["specialization-tracks"])


@tracks_router.get("", response_model=list[SpecializationTrackOut])
def list_tracks(db: Session = Depends(get_db), _=Depends(require_any_role)):
    return db.query(SpecializationTrack).all()


batches_router = APIRouter(prefix="/api/batches", tags=["batches"])


@batches_router.get("", response_model=list[BatchOut])
def list_batches(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return db.query(Batch).order_by(Batch.id.desc()).all()


@batches_router.post("", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def create_batch(payload: BatchCreateRequest, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    batch = Batch(**payload.model_dump(), created_by=admin.id)
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@batches_router.post("/{batch_id}/members/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_batch_member(batch_id: int, student_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    batch = db.get(Batch, batch_id)
    if batch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    existing = db.get(BatchMember, {"batch_id": batch_id, "student_id": student_id})
    if existing is None:
        db.add(BatchMember(batch_id=batch_id, student_id=student_id))
        db.commit()
    return None


@batches_router.delete("/{batch_id}/members/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_batch_member(batch_id: int, student_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    existing = db.get(BatchMember, {"batch_id": batch_id, "student_id": student_id})
    if existing is not None:
        db.delete(existing)
        db.commit()
    return None
