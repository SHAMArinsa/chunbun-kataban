"""Additive Portal V2 records. Legacy enrollments opt in to no policy automatically.

History tables are protected by PostgreSQL append-only triggers in the migration.
Staff actors reference users, allowing the existing staff profile/authentication
system to serve Admin and Instructor without a second identity table.
"""
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ProgramWorkflowPolicy(Base):
    __tablename__ = "program_workflow_policies"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_code: Mapped[str] = mapped_column(String(50), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    duration: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_unit: Mapped[str] = mapped_column(String(10), nullable=False)
    selection_limit: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    mock_interview_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    form_unlock_base: Mapped[str | None] = mapped_column(String(20))
    form_unlock_months: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    form_unlock_days: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    mcq_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("program_code", "version", name="uq_v2_policy_code_version"),
        CheckConstraint("version > 0 AND duration > 0", name="ck_v2_policy_positive"),
        CheckConstraint("duration_unit IN ('weeks', 'months', 'years')", name="ck_v2_policy_duration_unit"),
        CheckConstraint("selection_limit BETWEEN 0 AND 2 AND mock_interview_count >= 0 AND form_unlock_months >= 0 AND form_unlock_days >= 0", name="ck_v2_policy_counts"),
        CheckConstraint("form_unlock_base IS NULL OR form_unlock_base IN ('enrolled_at', 'start_date')", name="ck_v2_policy_unlock_base"),
    )


class ProgramStage(Base):
    __tablename__ = "program_stages"
    id: Mapped[int] = mapped_column(primary_key=True)
    policy_id: Mapped[int] = mapped_column(ForeignKey("program_workflow_policies.id"), index=True)
    code: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(200))
    start_month: Mapped[int] = mapped_column(Integer)
    end_month: Mapped[int] = mapped_column(Integer)
    __table_args__ = (
        UniqueConstraint("policy_id", "code", name="uq_v2_stage_code"),
        CheckConstraint("start_month >= 1 AND end_month >= start_month", name="ck_v2_stage_months"),
    )


class ProgramRequirement(Base):
    __tablename__ = "program_requirements"
    id: Mapped[int] = mapped_column(primary_key=True)
    policy_id: Mapped[int] = mapped_column(ForeignKey("program_workflow_policies.id"), index=True)
    code: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(200))
    requirement_type: Mapped[str] = mapped_column(String(30))
    target_count: Mapped[int] = mapped_column(Integer)
    aggregation: Mapped[str] = mapped_column(String(20), server_default="direct")
    __table_args__ = (
        UniqueConstraint("policy_id", "code", name="uq_v2_requirement_code"),
        CheckConstraint("target_count > 0", name="ck_v2_requirement_count"),
        CheckConstraint("aggregation IN ('direct', 'sum')", name="ck_v2_requirement_aggregation"),
    )


class RequirementDependency(Base):
    __tablename__ = "requirement_dependencies"
    requirement_id: Mapped[int] = mapped_column(ForeignKey("program_requirements.id"), primary_key=True)
    source_requirement_id: Mapped[int] = mapped_column(ForeignKey("program_requirements.id"), primary_key=True)
    __table_args__ = (CheckConstraint("requirement_id <> source_requirement_id", name="ck_v2_requirement_not_self"),)


class RequirementProgress(Base):
    __tablename__ = "requirement_progress"
    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("program_requirements.id"), index=True)
    completed_count: Mapped[int] = mapped_column(Integer, server_default="0")
    status: Mapped[str] = mapped_column(String(30), server_default="not_started")
    evidence: Mapped[dict | None] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (
        UniqueConstraint("enrollment_id", "requirement_id", name="uq_v2_progress_enrollment_requirement"),
        CheckConstraint("completed_count >= 0", name="ck_v2_progress_nonnegative"),
        CheckConstraint("status IN ('not_started', 'in_progress', 'completed', 'waived')", name="ck_v2_progress_status"),
    )


class EnrollmentAccessExtension(Base):
    __tablename__ = "enrollment_access_extensions"
    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), index=True)
    previous_end_date: Mapped[date | None] = mapped_column(Date)
    new_end_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(Text)
    granted_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    status: Mapped[str] = mapped_column(String(20), server_default="granted")
    __table_args__ = (
        CheckConstraint("previous_end_date IS NULL OR new_end_date > previous_end_date", name="ck_v2_extension_later"),
        CheckConstraint("length(trim(reason)) > 0", name="ck_v2_extension_reason"),
    )


class ProjectSelection(Base):
    __tablename__ = "project_selections"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), index=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    slot: Mapped[int] = mapped_column(Integer)
    is_locked: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    selected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        CheckConstraint("slot IN (1, 2)", name="ck_v2_selection_slot"),
        Index("uq_v2_selection_active_slot", "enrollment_id", "slot", unique=True, postgresql_where=text("active")),
        Index("uq_v2_selection_active_project", "enrollment_id", "project_id", unique=True, postgresql_where=text("active")),
    )


class ProjectSelectionEvent(Base):
    __tablename__ = "project_selection_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    selection_id: Mapped[int] = mapped_column(ForeignKey("project_selections.id"), index=True)
    action: Mapped[str] = mapped_column(String(30))
    previous_project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    new_project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    reason: Mapped[str] = mapped_column(Text)
    performed_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    __table_args__ = (CheckConstraint("action IN ('selected', 'locked', 'reset', 'changed', 'deactivated')", name="ck_v2_selection_event_action"),)


class AreaOfInterest(Base):
    __tablename__ = "areas_of_interest"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    display_order: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AreaOfInterestProgram(Base):
    __tablename__ = "area_of_interest_programs"
    area_of_interest_id: Mapped[int] = mapped_column(ForeignKey("areas_of_interest.id"), primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), primary_key=True)


class InternshipForm(Base):
    __tablename__ = "internship_forms"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), unique=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), index=True)
    education: Mapped[str | None] = mapped_column(Text)
    institution: Mapped[str | None] = mapped_column(String(200))
    area_of_interest_id: Mapped[int | None] = mapped_column(ForeignKey("areas_of_interest.id"))
    skills: Mapped[str | None] = mapped_column(Text)
    experience: Mapped[str | None] = mapped_column(Text)
    preferred_role: Mapped[str | None] = mapped_column(String(300))
    comments: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(30), server_default="draft", index=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_status: Mapped[str] = mapped_column(String(30), server_default="pending")
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'submitted', 'revision_required', 'completed')", name="ck_v2_form_status"),
        CheckConstraint("review_status IN ('pending', 'under_review', 'accepted', 'revision_required', 'rejected')", name="ck_v2_form_review_status"),
    )


class ResumeVersion(Base):
    __tablename__ = "resume_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    internship_form_id: Mapped[int] = mapped_column(ForeignKey("internship_forms.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    file_path: Mapped[str] = mapped_column(String(500))
    file_name: Mapped[str] = mapped_column(String(300))
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        UniqueConstraint("internship_form_id", "version", name="uq_v2_resume_version"),
        CheckConstraint("version > 0", name="ck_v2_resume_version"),
    )


class ReviewEvent(Base):
    __tablename__ = "review_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_submission_id: Mapped[int | None] = mapped_column(ForeignKey("project_submissions.id"), index=True)
    assignment_submission_id: Mapped[int | None] = mapped_column(ForeignKey("assignment_submissions.id"), index=True)
    evaluation_id: Mapped[int | None] = mapped_column(ForeignKey("evaluations.id"), index=True)
    internship_form_id: Mapped[int | None] = mapped_column(ForeignKey("internship_forms.id"), index=True)
    resume_version_id: Mapped[int | None] = mapped_column(ForeignKey("resume_versions.id"), index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    previous_status: Mapped[str | None] = mapped_column(String(30))
    new_status: Mapped[str] = mapped_column(String(30))
    feedback: Mapped[str | None] = mapped_column(Text)
    score: Mapped[float | None] = mapped_column(Numeric(10, 2))
    decision: Mapped[str] = mapped_column(String(50))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    __table_args__ = (CheckConstraint("num_nonnulls(project_submission_id, assignment_submission_id, evaluation_id, internship_form_id, resume_version_id) = 1", name="ck_v2_review_one_target"),)


class EligibilityCriterion(Base):
    __tablename__ = "eligibility_criteria"
    id: Mapped[int] = mapped_column(primary_key=True)
    policy_id: Mapped[int] = mapped_column(ForeignKey("program_workflow_policies.id"), index=True)
    code: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text)
    requirement_id: Mapped[int | None] = mapped_column(ForeignKey("program_requirements.id"))
    is_required: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    __table_args__ = (UniqueConstraint("policy_id", "code", name="uq_v2_criterion_policy_code"),)


class EligibilityState(Base):
    __tablename__ = "eligibility_states"
    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), index=True)
    criterion_id: Mapped[int] = mapped_column(ForeignKey("eligibility_criteria.id"), index=True)
    state: Mapped[str] = mapped_column(String(30), server_default="pending")
    value: Mapped[dict | None] = mapped_column(JSONB)
    reason: Mapped[str | None] = mapped_column(Text)
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        UniqueConstraint("enrollment_id", "criterion_id", name="uq_v2_eligibility_enrollment_criterion"),
        CheckConstraint("state IN ('pending', 'met', 'not_met', 'waived')", name="ck_v2_eligibility_state"),
    )


class EligibilityDecision(Base):
    __tablename__ = "eligibility_decisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    eligibility_state_id: Mapped[int] = mapped_column(ForeignKey("eligibility_states.id"), index=True)
    previous_state: Mapped[str | None] = mapped_column(String(30))
    new_state: Mapped[str] = mapped_column(String(30))
    previous_value: Mapped[dict | None] = mapped_column(JSONB)
    new_value: Mapped[dict | None] = mapped_column(JSONB)
    reason: Mapped[str] = mapped_column(Text)
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class CertificateEvent(Base):
    __tablename__ = "certificate_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    certificate_id: Mapped[int] = mapped_column(ForeignKey("certificates.id"), index=True)
    action: Mapped[str] = mapped_column(String(30))
    file_path: Mapped[str | None] = mapped_column(String(500))
    snapshot: Mapped[dict | None] = mapped_column(JSONB)
    reason: Mapped[str | None] = mapped_column(Text)
    performed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    __table_args__ = (CheckConstraint("action IN ('generated', 'issued', 'revoked', 'reissued')", name="ck_v2_certificate_event_action"),)


class InvoiceArtifact(Base):
    __tablename__ = "invoice_artifacts"
    id: Mapped[int] = mapped_column(primary_key=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id"), unique=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id"), index=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("internship_programs.id"), index=True)
    file_path: Mapped[str] = mapped_column(String(500))
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(20), server_default="generated")
    payment: Mapped["Payment"] = relationship()  # noqa: F821

    @property
    def invoice_number(self) -> str | None:
        """The only authoritative number remains payments.invoice_number."""
        return self.payment.invoice_number


class DocumentDelivery(Base):
    __tablename__ = "document_deliveries"
    id: Mapped[int] = mapped_column(primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(200), unique=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    enrollment_id: Mapped[int | None] = mapped_column(ForeignKey("program_enrollments.id"), index=True)
    document_type: Mapped[str] = mapped_column(String(40))
    certificate_id: Mapped[int | None] = mapped_column(ForeignKey("certificates.id"))
    invoice_artifact_id: Mapped[int | None] = mapped_column(ForeignKey("invoice_artifacts.id"))
    student_document_id: Mapped[int | None] = mapped_column(ForeignKey("student_documents.id"))
    recipient: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), server_default="pending", index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, server_default="0")
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        CheckConstraint("num_nonnulls(certificate_id, invoice_artifact_id, student_document_id) = 1", name="ck_v2_delivery_one_document"),
        CheckConstraint("attempt_count >= 0", name="ck_v2_delivery_attempts"),
        CheckConstraint("status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')", name="ck_v2_delivery_status"),
        UniqueConstraint("certificate_id", "recipient", name="uq_v2_delivery_certificate_recipient"),
        UniqueConstraint("invoice_artifact_id", "recipient", name="uq_v2_delivery_invoice_recipient"),
        UniqueConstraint("student_document_id", "recipient", name="uq_v2_delivery_document_recipient"),
    )


class DeliveryAttempt(Base):
    __tablename__ = "delivery_attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    delivery_id: Mapped[int] = mapped_column(ForeignKey("document_deliveries.id"), index=True)
    attempt_number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    error_message: Mapped[str | None] = mapped_column(Text)
    provider_message_id: Mapped[str | None] = mapped_column(String(255))
    __table_args__ = (
        UniqueConstraint("delivery_id", "attempt_number", name="uq_v2_delivery_attempt"),
        CheckConstraint("attempt_number > 0", name="ck_v2_delivery_attempt_number"),
        CheckConstraint("status IN ('sent', 'failed', 'unknown')", name="ck_v2_delivery_attempt_status"),
    )


class NotificationReceipt(Base):
    __tablename__ = "notification_receipts"
    notification_id: Mapped[int] = mapped_column(ForeignKey("notifications.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkFeedbackMessage(Base):
    """Chat-style feedback thread between reviewers and a student for one project (spans all versions)."""
    __tablename__ = "work_feedback_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    submission_id: Mapped[int | None] = mapped_column(ForeignKey("project_submissions.id", ondelete="SET NULL"))
    sender_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    sender_role: Mapped[str] = mapped_column(String(10), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    image_path: Mapped[str | None] = mapped_column(String(500))
    image_name: Mapped[str | None] = mapped_column(String(300))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_work_feedback_thread", "enrollment_id", "project_id"),
                      CheckConstraint("sender_role in ('staff','student')", name="ck_work_feedback_role"),
                      CheckConstraint("body is not null or image_path is not null", name="ck_work_feedback_content"))


class MockInterviewRequest(Base):
    """A student's 5 preferred timings for one mock interview slot."""
    __tablename__ = "mock_interview_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(ForeignKey("program_enrollments.id", ondelete="CASCADE"), nullable=False)
    interview_number: Mapped[int] = mapped_column(Integer, nullable=False)
    preferred_times: Mapped[list] = mapped_column(JSONB, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), server_default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("enrollment_id", "interview_number", name="uq_mock_request_slot"),
                      CheckConstraint("status in ('pending','scheduled','cancelled')", name="ck_mock_request_status"))


class SystemState(Base):
    """Small key/value store for deployment bookkeeping (e.g. last certificate design refreshed)."""
    __tablename__ = "system_state"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
