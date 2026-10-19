"""Add extraction job table

Revision ID: a1b2c3d4e5f6
Revises: efddf00027ce
Create Date: 2026-10-19 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "efddf00027ce"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "extractionjob",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "running",
                "succeeded",
                "failed",
                name="extractionjobstatus",
            ),
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("last_error", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["document.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_extractionjob_id"), "extractionjob", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_extractionjob_document_id"),
        "extractionjob",
        ["document_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_extractionjob_document_id"), table_name="extractionjob")
    op.drop_index(op.f("ix_extractionjob_id"), table_name="extractionjob")
    op.drop_table("extractionjob")
    op.execute("DROP TYPE IF EXISTS extractionjobstatus")
