"""add provenance event log (Story 32)

Append-only audit trail: ProvenanceEvent rows record who did what to which
entity, with a non-secret JSON payload. No foreign keys by design — the audit
trail outlives deleted projects; deleted users have actor_id anonymised
(GDPR-style erasure without rewriting history). Append-only means no update or
delete API exists; retention is documented with Story 61 (ADR/docs).

Revision ID: h5k8m2p9q3r7
Revises: g9d4e7f81b23
Create Date: 2026-10-28 09:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "h5k8m2p9q3r7"
down_revision = "g9d4e7f81b23"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "provenanceevent",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column(
            "actor_type",
            sa.Enum("user", "system", "job", name="provenanceactortype"),
            nullable=False,
        ),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("action", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
        sa.Column(
            "entity_type", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False
        ),
        sa.Column(
            "entity_id", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False
        ),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column(
            "request_id", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_provenanceevent_id"), "provenanceevent", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_provenanceevent_project_id"),
        "provenanceevent",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_provenanceevent_actor_id"),
        "provenanceevent",
        ["actor_id"],
        unique=False,
    )
    op.create_index(
        "ix_provenanceevent_project_occurred",
        "provenanceevent",
        ["project_id", "occurred_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_provenanceevent_project_occurred", table_name="provenanceevent"
    )
    op.drop_index(op.f("ix_provenanceevent_actor_id"), table_name="provenanceevent")
    op.drop_index(
        op.f("ix_provenanceevent_project_id"), table_name="provenanceevent"
    )
    op.drop_index(op.f("ix_provenanceevent_id"), table_name="provenanceevent")
    op.drop_table("provenanceevent")
    op.execute("DROP TYPE IF EXISTS provenanceactortype")
