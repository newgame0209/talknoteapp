/**
 * しゃべるノート - Cloud SQL モジュール
 * PostgreSQLデータベースインスタンスを管理
 */

resource "google_sql_database_instance" "instance" {
  name             = var.instance_name
  database_version = var.database_version
  region           = var.region
  project          = var.project_id
  
  settings {
    tier              = var.tier
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    disk_size         = var.disk_size
    disk_type         = var.disk_type
    
    backup_configuration {
      enabled            = var.backup_enabled
      start_time         = "02:00"
      binary_log_enabled = false
      
      backup_retention_settings {
        retained_backups = var.backup_retention_days
        retention_unit   = "COUNT"
      }
    }
    
    ip_configuration {
      ipv4_enabled    = true
      private_network = var.private_network_id != "" ? var.private_network_id : null
      
      # 開発環境の場合、特定のIPからのアクセスを許可
      dynamic "authorized_networks" {
        for_each = var.authorized_networks
        content {
          name  = authorized_networks.key
          value = authorized_networks.value
        }
      }
    }
    
    maintenance_window {
      day          = 7  # Sunday
      hour         = 2  # 2 AM
      update_track = "stable"
    }
    
    database_flags {
      name  = "max_connections"
      value = var.max_connections
    }
  }
  
  deletion_protection = var.deletion_protection
}

# データベース作成
resource "google_sql_database" "database" {
  name     = var.database_name
  instance = google_sql_database_instance.instance.name
  project  = var.project_id
}

# データベースユーザー作成
resource "google_sql_user" "user" {
  name     = var.db_user
  instance = google_sql_database_instance.instance.name
  password = var.db_password
  project  = var.project_id
}
