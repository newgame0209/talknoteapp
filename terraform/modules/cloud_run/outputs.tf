/**
 * しゃべるノート - Cloud Run モジュール出力
 */

output "service_url" {
  description = "Cloud Runサービスの公開URL"
  value       = google_cloud_run_service.service.status[0].url
}

output "service_name" {
  description = "デプロイされたサービス名"
  value       = google_cloud_run_service.service.name
}

output "service_account_email" {
  description = "サービスで使用されるサービスアカウントのメールアドレス"
  value       = google_service_account.service_account.email
}
