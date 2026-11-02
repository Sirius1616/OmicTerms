"""add findings and finding evidence (Story 30)

``Finding`` is a research claim tied to supporting material, with a
claim-to-evidence rule enforced server-side (publishing requires primary
evidence) and a version history of published snapshots. ``FindingEvidence``
records one referenced material with an explicit role.

Also extends the polymorphic validation substrate so deterministic finding
checks (``POST /findings/{id}/validate``) persist as ordinary
``ValidationRun``/``ValidationIssue`` rows with ``subject_type = finding``.

Revision ID: t7r9w3x6z3v5
Revises: l3n5m7q9s1t3
Create Date: 2026-11-02 09:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "t7r9w3x6z3v5"
down_revision = "l3n5m7q9s1t3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE validationsubjecttype ADD VALUE IF NOT EXISTS 'finding'"
    )
    op.create_table(
        "finding",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=256), nullable=False),
        sa.Column("summary", sqlmodel.sql.sqltypes.AutoString(length=4000), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "review",
                "published",
                "retracted",
                name="findingstatus",
            ),
            nullable=False,
        ),
        sa.Column(
            "validation_state",
            sa.Enum(
                "unvalidated",
                "validated",
                "disputed",
                name="findingvalidationstate",
            ),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("supersedes_id", sa.Uuid(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("history", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["project.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["user.id"]),
        sa.ForeignKeyConstraint(["supersedes_id"], ["finding.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_finding_id"), "finding", ["id"], unique=False)
    op.create_index(
        op.f("ix_finding_project_id"), "finding", ["project_id"], unique=False
    )
    op.create_index(
        op.f("ix_finding_created_by"), "finding", ["created_by"], unique=False
    )
    op.create_index(
        op.f("ix_finding_supersedes_id"), "finding", ["supersedes_id"], unique=False
    )
    op.create_index(
        "ix_finding_project_updated", "finding", ["project_id", "updated_at"],
        unique=False,
    )
    op.create_table(
        "findingevidence",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("finding_id", sa.Uuid(), nullable=False),
        sa.Column(
            "target_type",
            sa.Enum(
                "document",
                "run",
                "artifact",
                "report_passage",
                "graph_edge",
                name="findingevidencetarget",
            ),
            nullable=False,
        ),
        sa.Column(
            "target_id", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False
        ),
        sa.Column("quote_or_field", sa.JSON(), nullable=True),
        sa.Column(
            "role",
            sa.Enum(
                "primary",
                "supporting",
                "contradicting",
                name="findingevidencerole",
            ),
            nullable=False,
        ),
        sa.Column("added_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["finding_id"], ["finding.id"]),
        sa.ForeignKeyConstraint(["added_by"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_findingevidence_id"), "findingevidence", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_findingevidence_finding_id"),
        "findingevidence",
        ["finding_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_findingevidence_added_by"),
        "findingevidence",
        ["added_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_findingevidence_added_by"), table_name="findingevidence")
    op.drop_index(op.f("ix_findingevidence_finding_id"), table_name="findingevidence")
    op.drop_index(op.f("ix_findingevidence_id"), table_name="findingevidence")
    op.drop_table("findingevidence")
    op.drop_index("ix_finding_project_updated", table_name="finding")
    op.drop_index(op.f("ix_finding_supersedes_id"), table_name="finding")
    op.drop_index(op.f("ix_finding_created_by"), table_name="finding")
    op.drop_index(op.f("ix_finding_project_id"), table_name="finding")
    op.drop_index(op.f("ix_finding_id"), table_name="finding")
    op.drop_table("finding")
    op.execute("DROP TYPE IF EXISTS findingevidencerole")
    op.execute("DROP TYPE IF EXISTS findingevidencetarget")
    op.execute("DROP TYPE IF EXISTS findingvalidationstate")
    op.execute("DROP TYPE IF EXISTS findingstatus")
