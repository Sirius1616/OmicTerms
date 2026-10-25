"""add experiment subject type to validation

Revision ID: f7b3c8d92e41
Revises: e7a92f61c803
Create Date: 2026-10-22 09:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f7b3c8d92e41"
down_revision: str | None = "e7a92f61c803"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE validationsubjecttype ADD VALUE IF NOT EXISTS 'experiment'")


def downgrade() -> None:
    pass
