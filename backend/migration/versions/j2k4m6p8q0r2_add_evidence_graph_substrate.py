"""add evidence graph substrate (Story 28)

Two additive tables backing the Multi-Omics Evidence Map:

- ``evidencenode``: one row per materialised scientific record in the graph,
  unique on ``(entity_type, entity_id)``. ``project_id`` scopes tenancy (not a
  foreign key on purpose: nodes are derivable substrate, audit history stays
  in ``provenanceevent``).
- ``evidenceedge``: typed relations between nodes. ``belongs_to`` carries the
  structural containment (document→sample, sample→experiment, experiment→
  project) required by Story 28's auto-materialisation acceptance criteria;
  ``supports``/``contradicts`` are user-created and audit ``created_by``.

Revision ID: j2k4m6p8q0r2
Revises: h5k8m2p9q3r7
Create Date: 2026-10-29 10:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "j2k4m6p8q0r2"
down_revision = "h5k8m2p9q3r7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "evidencenode",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "entity_type",
            sa.Enum(
                "document",
                "run",
                "sample",
                "experiment",
                "finding",
                "report",
                "artifact",
                "project",
                name="evidenceentitytype",
            ),
            nullable=False,
        ),
        sa.Column(
            "entity_id", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False
        ),
        sa.Column(
            "label", sqlmodel.sql.sqltypes.AutoString(length=256), nullable=False
        ),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_evidencenode_id"), "evidencenode", ["id"], unique=False)
    op.create_index(
        op.f("ix_evidencenode_project_id"), "evidencenode", ["project_id"], unique=False
    )
    op.create_index(
        "ix_evidencenode_entity_type_entity_id",
        "evidencenode",
        ["entity_type", "entity_id"],
        unique=True,
    )

    op.create_table(
        "evidenceedge",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column(
            "relation",
            sa.Enum(
                "derived_from",
                "produced_by",
                "supports",
                "contradicts",
                "reports_on",
                "same_sample_as",
                "input_to",
                "belongs_to",
                name="evidencerelation",
            ),
            nullable=False,
        ),
        sa.Column("evidence_ref", sa.JSON(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column(
            "note", sqlmodel.sql.sqltypes.AutoString(length=512), nullable=True
        ),
        sa.ForeignKeyConstraint(["source_id"], ["evidencenode.id"]),
        sa.ForeignKeyConstraint(["target_id"], ["evidencenode.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_evidenceedge_id"), "evidenceedge", ["id"], unique=False)
    op.create_index(
        op.f("ix_evidenceedge_source_id"), "evidenceedge", ["source_id"], unique=False
    )
    op.create_index(
        op.f("ix_evidenceedge_target_id"), "evidenceedge", ["target_id"], unique=False
    )
    op.create_index(
        op.f("ix_evidenceedge_created_by"), "evidenceedge", ["created_by"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_evidenceedge_created_by"), table_name="evidenceedge")
    op.drop_index(op.f("ix_evidenceedge_target_id"), table_name="evidenceedge")
    op.drop_index(op.f("ix_evidenceedge_source_id"), table_name="evidenceedge")
    op.drop_index(op.f("ix_evidenceedge_id"), table_name="evidenceedge")
    op.drop_table("evidenceedge")
    op.execute("DROP TYPE IF EXISTS evidencerelation")

    op.drop_index(
        "ix_evidencenode_entity_type_entity_id", table_name="evidencenode"
    )
    op.drop_index(op.f("ix_evidencenode_project_id"), table_name="evidencenode")
    op.drop_index(op.f("ix_evidencenode_id"), table_name="evidencenode")
    op.drop_table("evidencenode")
    op.execute("DROP TYPE IF EXISTS evidenceentitytype")
