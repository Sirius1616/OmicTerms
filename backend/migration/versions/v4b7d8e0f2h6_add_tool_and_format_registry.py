"""add tool and format registry (Story 20)

Registry ground truth, exactly matching the parsers that exist today (see
``app/services/extraction.py``). The rows come from
``app/services/registry_seed.py`` — the single source of truth shared with
the CI truth-check test, so supported statuses can only lose their match in
one place, and a test fails on drift.

Revision ID: v4b7d8e0f2h6
Revises: t7r9w3x6z3v5
Create Date: 2026-11-02 18:20:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

from app.models import FormatDefinition, ToolDefinition
from app.services.registry_seed import FORMAT_ROWS, TOOL_ROWS

# revision identifiers, used by Alembic.
revision = "v4b7d8e0f2h6"
down_revision = "t7r9w3x6z3v5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tooldefinition",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=128), nullable=False),
        sa.Column(
            "version_policy", sqlmodel.sql.sqltypes.AutoString(length=128), nullable=False
        ),
        sa.Column(
            "category", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False
        ),
        sa.Column(
            "website_url", sqlmodel.sql.sqltypes.AutoString(length=512), nullable=True
        ),
        sa.Column("docs_url", sqlmodel.sql.sqltypes.AutoString(length=512), nullable=True),
        sa.Column("input_formats", sa.JSON(), nullable=False),
        sa.Column("output_formats", sa.JSON(), nullable=False),
        sa.Column(
            "internal_representation_mapping_id",
            sqlmodel.sql.sqltypes.AutoString(length=128),
            nullable=True,
        ),
        sa.Column(
            "support_status",
            sa.Enum(
                "supported", "planned", "experimental", name="registrysupportstatus"
            ),
            nullable=False,
        ),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=512), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_tooldefinition_id"), "tooldefinition", ["id"], unique=False)
    op.create_index(
        op.f("ix_tooldefinition_name"), "tooldefinition", ["name"], unique=True
    )
    op.create_index(
        "ix_tooldefinition_category_status",
        "tooldefinition",
        ["category", "support_status"],
        unique=False,
    )
    op.create_table(
        "formatdefinition",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "extension", sqlmodel.sql.sqltypes.AutoString(length=16), nullable=False
        ),
        sa.Column(
            "media_type", sqlmodel.sql.sqltypes.AutoString(length=128), nullable=False
        ),
        sa.Column(
            "description", sqlmodel.sql.sqltypes.AutoString(length=4000), nullable=False
        ),
        sa.Column(
            "parser_id", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False
        ),
        sa.Column("examples", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("extension"),
    )
    op.create_index(
        op.f("ix_formatdefinition_id"), "formatdefinition", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_formatdefinition_extension"),
        "formatdefinition",
        ["extension"],
        unique=True,
    )

    # Seed rows carry real uuids so SQLite-based runs (metadata.create_all +
    # seed_registry) keep the same shape as the migrated Postgres.
    import uuid

    op.bulk_insert(
        FormatDefinition.__table__,
        [{**row, "id": uuid.uuid4()} for row in FORMAT_ROWS],
    )
    op.bulk_insert(
        ToolDefinition.__table__,
        [{**row, "id": uuid.uuid4()} for row in TOOL_ROWS],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_formatdefinition_extension"), table_name="formatdefinition"
    )
    op.drop_index(op.f("ix_formatdefinition_id"), table_name="formatdefinition")
    op.drop_table("formatdefinition")
    op.drop_index(
        "ix_tooldefinition_category_status", table_name="tooldefinition"
    )
    op.drop_index(op.f("ix_tooldefinition_name"), table_name="tooldefinition")
    op.drop_index(op.f("ix_tooldefinition_id"), table_name="tooldefinition")
    op.drop_table("tooldefinition")
    op.execute("DROP TYPE IF EXISTS registrysupportstatus")
