/**
 * しゃべるノート - Cloud SQL モジュール出力
 */

output "instance_name" {
  description = "作成されたCloud SQLインスタンス名"
  value       = google_sql_database_instance.instance.name
}

output "instance_connection_name" {
  description = "インスタンス接続名"
  value       = google_sql_database_instance.instance.connection_name
}

output "database_name" {
  description = "作成されたデータベース名"
  value       = google_sql_database.database.name
}

output "database_url" {
  description = "データベース接続URL"
  value       = "postgresql://${var.db_user}:${var.db_password}@${google_sql_database_instance.instance.public_ip_address}:5432/${var.database_name}"
  sensitive   = true
}

output "public_ip_address" {
  description = "データベースのパブリックIPアドレス"
  value       = google_sql_database_instance.instance.public_ip_address
}
