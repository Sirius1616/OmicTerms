"""Add sha256 and size_bytes to document

Revision ID: b3f7e92a81c4
Revises: efddf00027ce
Create Date: 2026-10-21 12:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "b3f7e92a81c4"
down_revision = "efddf00027ce"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("document", sa.Column("sha256", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True))
    op.add_column("document", sa.Column("size_bytes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("document", "size_bytes")
    op.drop_column("document", "sha256")
