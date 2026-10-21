"""add validation run and issue

Revision ID: d8f92a61b703
Revises: cb4966256490
Create Date: 2026-10-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8f92a61b703'
down_revision: Union[str, None] = 'cb4966256490'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'validationrun',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('subject_type', sa.Enum('document', 'dataset', 'report', name='validationsubjecttype'), nullable=False),
        sa.Column('subject_id', sa.Uuid(), nullable=False),
        sa.Column('document_id', sa.Uuid(), nullable=True),
        sa.Column('trigger', sa.Enum('upload', 'manual', 'dependency', name='validationtrigger'), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('validator_set_version', sa.String(), nullable=False),
        sa.Column('document_id', sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(['document_id'], ['document.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_validationrun_document_id'), 'validationrun', ['document_id'], unique=False)
    op.create_index(op.f('ix_validationrun_id'), 'validationrun', ['id'], unique=False)
    op.create_index(op.f('ix_validationrun_subject_id'), 'validationrun', ['subject_id'], unique=False)
    op.create_table(
        'validationissue',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('run_id', sa.Uuid(), nullable=False),
        sa.Column('code', sa.String(length=64), nullable=False),
        sa.Column('severity', sa.Enum('error', 'warning', 'info', 'skipped', name='validationseverity'), nullable=False),
        sa.Column('message', sa.String(), nullable=False),
        sa.Column('detail', sa.String(), nullable=True),
        sa.Column('field', sa.String(), nullable=True),
        sa.Column('path', sa.String(), nullable=True),
        sa.Column('suggestion', sa.String(), nullable=True),
        sa.Column('dedup_key', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['validationrun.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_validationissue_dedup_key'), 'validationissue', ['dedup_key'], unique=False)
    op.create_index(op.f('ix_validationissue_id'), 'validationissue', ['id'], unique=False)
    op.create_index(op.f('ix_validationissue_run_id'), 'validationissue', ['run_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_validationissue_run_id'), table_name='validationissue')
    op.drop_index(op.f('ix_validationissue_id'), table_name='validationissue')
    op.drop_index(op.f('ix_validationissue_dedup_key'), table_name='validationissue')
    op.drop_table('validationissue')
    op.drop_index(op.f('ix_validationrun_subject_id'), table_name='validationrun')
    op.drop_index(op.f('ix_validationrun_id'), table_name='validationrun')
    op.drop_index(op.f('ix_validationrun_document_id'), table_name='validationrun')
    op.drop_table('validationrun')
    op.execute('DROP TYPE IF EXISTS validationseverity')
    op.execute('DROP TYPE IF EXISTS validationtrigger')
    op.execute('DROP TYPE IF EXISTS validationsubjecttype')
