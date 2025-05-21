/**
 * しゃべるノート - Terraform 変数定義
 */

variable "project_id" {
  description = "GCPプロジェクトID"
  type        = string
}

variable "region" {
  description = "GCPリージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "zone" {
  description = "GCPゾーン"
  type        = string
  default     = "asia-northeast1-a"
}

variable "environment" {
  description = "デプロイ環境 (dev, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "環境は 'dev' または 'prod' である必要があります。"
  }
}

variable "api_image" {
  description = "APIサービスのDockerイメージ"
  type        = string
}

variable "debug" {
  description = "デバッグモードの有効化"
  type        = bool
  default     = false
}

variable "bypass_auth" {
  description = "認証のバイパス（開発環境のみ）"
  type        = bool
  default     = false
}

variable "firebase_project_id" {
  description = "Firebase プロジェクトID"
  type        = string
}

variable "gcs_bucket_name" {
  description = "メディアファイル保存用のGCSバケット名"
  type        = string
  default     = "talknote-media"
}

variable "db_user" {
  description = "データベースユーザー名"
  type        = string
  default     = "talknote"
}

variable "db_password" {
  description = "データベースパスワード"
  type        = string
  sensitive   = true
}

variable "service_account_json" {
  description = "サービスアカウントのJSONキー"
  type        = string
  sensitive   = true
}
