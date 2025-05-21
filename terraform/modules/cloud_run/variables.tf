/**
 * しゃべるノート - Cloud Run モジュール変数
 */

variable "project_id" {
  description = "GCPプロジェクトID"
  type        = string
}

variable "region" {
  description = "GCPリージョン"
  type        = string
}

variable "service_name" {
  description = "Cloud Runサービス名"
  type        = string
}

variable "image" {
  description = "デプロイするDockerイメージ"
  type        = string
}

variable "env_vars" {
  description = "環境変数のマップ"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "マウントするシークレットのマップ (シークレット名 => シークレットバージョンID)"
  type        = map(string)
  default     = {}
}

variable "cpu" {
  description = "割り当てるCPUリソース"
  type        = string
  default     = "1000m"
}

variable "memory" {
  description = "割り当てるメモリリソース"
  type        = string
  default     = "512Mi"
}

variable "concurrency" {
  description = "コンテナの同時実行数"
  type        = number
  default     = 80
}

variable "timeout_seconds" {
  description = "リクエストのタイムアウト秒数"
  type        = number
  default     = 300
}

variable "min_instances" {
  description = "最小インスタンス数"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "最大インスタンス数"
  type        = number
  default     = 10
}
