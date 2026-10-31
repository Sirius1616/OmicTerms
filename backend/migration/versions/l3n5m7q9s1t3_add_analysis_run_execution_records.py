"""add analysis run execution records (Story 22)

``AnalysisRun`` is the provenance backbone for compute: tool identity, JSON
input/output references (document ids + sha256 from upload integrity), a CAS-
guarded status lifecycle (queued → running → succeeded/failed/cancelled), and
either null or real values for optional metadata so later missing-provenance
checks can flag gaps truthfully instead of cleaning up fake defaults.

Revision ID: l3n5m7q9s1t3
Revises: j2k4m6p8q0r2
Create Date: 2026-10-29 18:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "l3n5m7q9s1t3"
down_revision = "j2k4m6p8q0r2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analysisrun",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column(
            "tool_name", sqlmodel.sql.sqltypes.AutoString(length=128), nullable=False
        ),
        sa.Column(
            "tool_version", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True
        ),
        sa.Column(
            "adapter_id", sqlmodel.sql.sqltypes.AutoString(length=128), nullable=True
        ),
        sa.Column("parameters", sa.JSON(), nullable=False),
        sa.Column(
            "config_hash", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True
        ),
        sa.Column("input_refs", sa.JSON(), nullable=False),
        sa.Column("output_refs", sa.JSON(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "queued",
                "running",
                "succeeded",
                "failed",
                "cancelled",
                name="analysisrunstatus",
            ),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("runtime_info", sa.JSON(), nullable=True),
        sa.Column(
            "notes", sqlmodel.sql.sqltypes.AutoString(length=512), nullable=True
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["project.id"]),
        sa.ForeignKeyConstraint(["actor_user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_analysisrun_id"), "analysisrun", ["id"], unique=False)
    op.create_index(
        op.f("ix_analysisrun_project_id"), "analysisrun", ["project_id"], unique=False
    )
    op.create_index(
        op.f("ix_analysisrun_actor_user_id"),
        "analysisrun",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_analysisrun_project_created",
        "analysisrun",
        ["project_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_analysisrun_project_created", table_name="analysisrun")
    op.drop_index(op.f("ix_analysisrun_actor_user_id"), table_name="analysisrun")
    op.drop_index(op.f("ix_analysisrun_project_id"), table_name="analysisrun")
    op.drop_index(op.f("ix_analysisrun_id"), table_name="analysisrun")
    op.drop_table("analysisrun")
    op.execute("DROP TYPE IF EXISTS analysisrunstatus")
