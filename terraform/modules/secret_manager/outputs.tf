/**
 * しゃべるノート - Secret Manager モジュール出力
 */

output "secret_ids" {
  description = "作成されたシークレットのID"
  value       = { for k, v in google_secret_manager_secret.secret : k => v.id }
}

output "secret_version_ids" {
  description = "作成されたシークレットバージョンのID"
  value       = { for k, v in google_secret_manager_secret_version.version : k => v.id }
}
