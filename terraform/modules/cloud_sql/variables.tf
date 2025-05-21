/**
 * しゃべるノート - Cloud SQL モジュール変数
 */

variable "project_id" {
  description = "GCPプロジェクトID"
  type        = string
}

variable "region" {
  description = "GCPリージョン"
  type        = string
}

variable "instance_name" {
  description = "Cloud SQLインスタンス名"
  type        = string
}

variable "database_name" {
  description = "作成するデータベース名"
  type        = string
  default     = "talknote"
}

variable "database_version" {
  description = "PostgreSQLのバージョン"
  type        = string
  default     = "POSTGRES_14"
}

variable "tier" {
  description = "インスタンスのマシンタイプ"
  type        = string
  default     = "db-f1-micro"
}

variable "high_availability" {
  description = "高可用性の有効化"
  type        = bool
  default     = false
}

variable "disk_size" {
  description = "ディスクサイズ（GB）"
  type        = number
  default     = 10
}

variable "disk_type" {
  description = "ディスクタイプ"
  type        = string
  default     = "PD_SSD"
}

variable "backup_enabled" {
  description = "バックアップの有効化"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "バックアップの保持日数"
  type        = number
  default     = 7
}

variable "private_network_id" {
  description = "プライベートネットワークID（VPC）"
  type        = string
  default     = ""
}

variable "authorized_networks" {
  description = "アクセスを許可するIPアドレスのマップ"
  type        = map(string)
  default     = {}
}

variable "max_connections" {
  description = "最大接続数"
  type        = string
  default     = "100"
}

variable "deletion_protection" {
  description = "削除保護の有効化"
  type        = bool
  default     = true
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
