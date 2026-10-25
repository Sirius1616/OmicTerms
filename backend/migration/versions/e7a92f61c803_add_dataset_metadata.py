"""add dataset metadata

Revision ID: e7a92f61c803
Revises: d8f92a61b703
Create Date: 2026-10-21 13:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e7a92f61c803"
down_revision: str | None = "d8f92a61b703"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "datasetmetadata",
        sa.Column("genome_assembly", sa.String(length=64), nullable=True),
        sa.Column(
            "coordinate_system",
            sa.Enum("zero_based", "one_based", "unknown", name="coordinatesystem"),
            nullable=False,
        ),
        sa.Column("source_tool", sa.String(length=128), nullable=True),
        sa.Column("source_tool_version", sa.String(length=64), nullable=True),
        sa.Column("reference_database", sa.String(length=128), nullable=True),
        sa.Column("declared_by", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["document.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id"),
    )
    op.create_index(
        op.f("ix_datasetmetadata_id"), "datasetmetadata", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_datasetmetadata_document_id"),
        "datasetmetadata",
        ["document_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_datasetmetadata_document_id"), table_name="datasetmetadata")
    op.drop_index(op.f("ix_datasetmetadata_id"), table_name="datasetmetadata")
    op.drop_table("datasetmetadata")
    op.execute("DROP TYPE IF EXISTS coordinatesystem")
