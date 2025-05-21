/**
 * しゃべるノート - Secret Manager モジュール
 * アプリケーションシークレットを管理
 */

# シークレットリソースの作成
resource "google_secret_manager_secret" "secret" {
  for_each  = var.secrets
  
  project   = var.project_id
  secret_id = each.key
  
  replication {
    automatic = true
  }
  
  labels = {
    environment = var.environment
    managed-by  = "terraform"
  }
}

# シークレットバージョンの作成
resource "google_secret_manager_secret_version" "version" {
  for_each = var.secrets
  
  secret      = google_secret_manager_secret.secret[each.key].id
  secret_data = each.value
}
