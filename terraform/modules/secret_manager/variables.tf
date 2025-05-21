/**
 * しゃべるノート - Secret Manager モジュール変数
 */

variable "project_id" {
  description = "GCPプロジェクトID"
  type        = string
}

variable "environment" {
  description = "デプロイ環境 (dev, prod)"
  type        = string
  default     = "dev"
}

variable "secrets" {
  description = "シークレットのマップ (シークレット名 => シークレット値)"
  type        = map(string)
  sensitive   = true
}
