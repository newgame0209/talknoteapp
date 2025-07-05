"""add_import_id_to_pages

Revision ID: 8a871f530904
Revises: 0b0f6c414d52
Create Date: 2025-07-05 18:21:43.911628

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a871f530904'
down_revision: Union[str, None] = '0b0f6c414d52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Phase 2: pagesテーブルにimport_idカラムを追加
    既存データに影響しない安全な変更
    """
    # pagesテーブルにimport_idカラムを追加（NULLABLE）
    op.add_column('pages', sa.Column('import_id', sa.String(), nullable=True, comment='インポート処理ID（メモリ管理）'))


def downgrade() -> None:
    """
    ロールバック: import_idカラムを削除
    """
    # import_idカラムを削除
    op.drop_column('pages', 'import_id')
