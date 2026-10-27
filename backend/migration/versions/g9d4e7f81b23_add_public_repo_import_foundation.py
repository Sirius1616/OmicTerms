"""add public repository import foundation

Revision ID: g9d4e7f81b23
Revises: f7b3c8d92e41
Create Date: 2026-10-26 09:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "g9d4e7f81b23"
down_revision = "f7b3c8d92e41"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "repositoryimport",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("experiment_id", sa.Uuid(), nullable=True),
        sa.Column(
            "repo",
            sa.Enum("geo", "ena", "sra", "pride", name="externalrepotype"),
            nullable=False,
        ),
        sa.Column("accession", sa.String(length=256), nullable=False),
        sa.Column("query", sa.String(length=512), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "running",
                "succeeded",
                "failed",
                "cancelled",
                name="repositoryimportstatus",
            ),
            nullable=False,
        ),
        sa.Column("metadata_json", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("provenance_json", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["experiment_id"], ["experiment.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["project.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_repositoryimport_id"), "repositoryimport", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_repositoryimport_owner_id"),
        "repositoryimport",
        ["owner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_repositoryimport_project_id"),
        "repositoryimport",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_repositoryimport_experiment_id"),
        "repositoryimport",
        ["experiment_id"],
        unique=False,
    )
    op.create_table(
        "importjob",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("import_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "running",
                "succeeded",
                "failed",
                "cancelled",
                name="importjobstatus",
            ),
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("last_error", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("downloaded_bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["import_id"], ["repositoryimport.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_importjob_id"), "importjob", ["id"], unique=False)
    op.create_index(
        op.f("ix_importjob_import_id"), "importjob", ["import_id"], unique=False
    )
    op.add_column(
        "document",
        sa.Column(
            "source_repo",
            sa.Enum("geo", "ena", "sra", "pride", name="externalrepotype"),
            nullable=True,
        ),
    )
    op.add_column("document", sa.Column("source_id", sa.String(length=256), nullable=True))
    op.add_column(
        "document", sa.Column("source_url", sa.String(length=1024), nullable=True)
    )
    op.add_column("document", sa.Column("fetched_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("document", "fetched_at")
    op.drop_column("document", "source_url")
    op.drop_column("document", "source_id")
    op.drop_column("document", "source_repo")
    op.drop_index(op.f("ix_importjob_import_id"), table_name="importjob")
    op.drop_index(op.f("ix_importjob_id"), table_name="importjob")
    op.drop_table("importjob")
    op.drop_index(
        op.f("ix_repositoryimport_experiment_id"), table_name="repositoryimport"
    )
    op.drop_index(op.f("ix_repositoryimport_project_id"), table_name="repositoryimport")
    op.drop_index(op.f("ix_repositoryimport_owner_id"), table_name="repositoryimport")
    op.drop_index(op.f("ix_repositoryimport_id"), table_name="repositoryimport")
    op.drop_table("repositoryimport")
    op.execute("DROP TYPE IF EXISTS importjobstatus")
    op.execute("DROP TYPE IF EXISTS repositoryimportstatus")
    op.execute("DROP TYPE IF EXISTS externalrepotype")
