"""
しゃべるノート - ユーザーサービス
ユーザー関連の操作を提供するサービス
"""
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.user import User


class UserService:
    """ユーザーサービス"""

    @staticmethod
    def get_by_uid(db: Session, uid: str) -> Optional[User]:
        """
        UIDでユーザーを取得
        
        Args:
            db: データベースセッション
            uid: ユーザーUID (Firebase)
            
        Returns:
            User: ユーザーオブジェクト（存在しない場合はNone）
        """
        return db.query(User).filter(User.uid == uid).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        """
        メールアドレスでユーザーを取得
        
        Args:
            db: データベースセッション
            email: メールアドレス
            
        Returns:
            User: ユーザーオブジェクト（存在しない場合はNone）
        """
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def create(db: Session, user_data: Dict[str, Any]) -> User:
        """
        新規ユーザーを作成
        
        Args:
            db: データベースセッション
            user_data: ユーザーデータ（uid, email, name, picture, email_verified）
            
        Returns:
            User: 作成されたユーザーオブジェクト
            
        Raises:
            IntegrityError: 一意制約違反（既に存在するuidやemail）
        """
        user = User(
            uid=user_data["uid"],
            email=user_data.get("email"),
            name=user_data.get("name"),
            picture=user_data.get("picture"),
            email_verified=user_data.get("email_verified", False)
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update(db: Session, uid: str, user_data: Dict[str, Any]) -> Optional[User]:
        """
        ユーザー情報を更新
        
        Args:
            db: データベースセッション
            uid: ユーザーUID
            user_data: 更新するユーザーデータ
            
        Returns:
            User: 更新されたユーザーオブジェクト（存在しない場合はNone）
        """
        user = UserService.get_by_uid(db, uid)
        if not user:
            return None
            
        for key, value in user_data.items():
            if hasattr(user, key) and key != "uid":  # uidは変更不可
                setattr(user, key, value)
                
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def get_or_create(db: Session, user_data: Dict[str, Any]) -> User:
        """
        ユーザーを取得、存在しない場合は作成
        
        Args:
            db: データベースセッション
            user_data: ユーザーデータ（uid, email, name, picture, email_verified）
            
        Returns:
            User: 取得または作成されたユーザーオブジェクト
        """
        user = UserService.get_by_uid(db, user_data["uid"])
        if user:
            # 既存ユーザーの場合、情報を更新
            return UserService.update(db, user_data["uid"], user_data)
        
        try:
            # 新規ユーザーの場合、作成
            return UserService.create(db, user_data)
        except IntegrityError:
            # 競合が発生した場合（同時作成など）、再取得
            db.rollback()
            return UserService.get_by_uid(db, user_data["uid"])


# グローバルインスタンス
user = UserService()
