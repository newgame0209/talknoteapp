/**
 * しゃべるノート - 本番環境変数
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

variable "api_image" {
  description = "APIサービスのDockerイメージ"
  type        = string
}

variable "firebase_project_id" {
  description = "Firebase プロジェクトID"
  type        = string
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
