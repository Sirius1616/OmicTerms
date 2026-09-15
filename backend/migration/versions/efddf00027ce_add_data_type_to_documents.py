"""Add data_type to documents

Revision ID: efddf00027ce
Revises: 3e2b9af38383
Create Date: 2026-09-14 00:12:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "efddf00027ce"
down_revision: Union[str, None] = "3e2b9af38383"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    data_type_enum = postgresql.ENUM(
        "expression",
        "methylation",
        "variants",
        "peaks",
        "document",
        name="datatype",
        create_type=True,
    )
    data_type_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "document",
        sa.Column("data_type", data_type_enum, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("document", "data_type")
    op.execute("DROP TYPE IF EXISTS datatype")