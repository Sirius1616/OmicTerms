"""merge heads

Revision ID: cb4966256490
Revises: a1b2c3d4e5f6, b3f7e92a81c4
Create Date: 2026-10-21 06:44:49.882642

"""
from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = 'cb4966256490'
down_revision: str | None = ('a1b2c3d4e5f6', 'b3f7e92a81c4')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
