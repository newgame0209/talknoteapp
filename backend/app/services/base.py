"""
しゃべるノート - CRUD基底クラス
すべてのCRUDサービスの基底となるクラス
"""
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import Base

# モデルとスキーマの型変数
ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    CRUD操作の基底クラス
    
    Attributes:
        model: SQLAlchemyモデル
    """
    def __init__(self, model: Type[ModelType]):
        """
        CRUD基底クラスのコンストラクタ
        
        Args:
            model: SQLAlchemyモデル
        """
        self.model = model

    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        """
        IDによるオブジェクト取得
        
        Args:
            db: データベースセッション
            id: オブジェクトID
            
        Returns:
            Optional[ModelType]: 該当オブジェクト（存在しない場合はNone）
        """
        return db.query(self.model).filter(self.model.id == id).first()

    def get_multi(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        """
        複数オブジェクト取得
        
        Args:
            db: データベースセッション
            skip: スキップ数
            limit: 取得上限
            
        Returns:
            List[ModelType]: オブジェクトリスト
        """
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: CreateSchemaType) -> ModelType:
        """
        オブジェクト作成
        
        Args:
            db: データベースセッション
            obj_in: 作成データ
            
        Returns:
            ModelType: 作成されたオブジェクト
        """
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """
        オブジェクト更新
        
        Args:
            db: データベースセッション
            db_obj: 更新対象オブジェクト
            obj_in: 更新データ
            
        Returns:
            ModelType: 更新されたオブジェクト
        """
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: Any) -> ModelType:
        """
        オブジェクト削除
        
        Args:
            db: データベースセッション
            id: 削除対象オブジェクトID
            
        Returns:
            ModelType: 削除されたオブジェクト
        """
        obj = db.get(self.model, id)  # SQLAlchemy 2.0対応の書き方
        db.delete(obj)
        db.commit()
        return obj
