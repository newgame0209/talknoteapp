/**
 * しゃべるノート - Cloud Run モジュール
 * バックエンドAPIサービスのデプロイを管理
 */

resource "google_cloud_run_service" "service" {
  name     = var.service_name
  location = var.region
  project  = var.project_id

  template {
    spec {
      containers {
        image = var.image
        
        # 環境変数設定
        dynamic "env" {
          for_each = var.env_vars
          content {
            name  = env.key
            value = env.value
          }
        }
        
        # シークレットマウント
        dynamic "volume_mounts" {
          for_each = var.secrets
          content {
            name       = volume_mounts.key
            mount_path = "/secrets/${volume_mounts.key}"
          }
        }
        
        resources {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
        }
      }
      
      # シークレットボリューム定義
      dynamic "volumes" {
        for_each = var.secrets
        content {
          name = volumes.key
          secret {
            secret_name = volumes.key
            items {
              key  = "latest"
              path = volumes.key
            }
          }
        }
      }
      
      service_account_name = google_service_account.service_account.email
      container_concurrency = var.concurrency
      timeout_seconds       = var.timeout_seconds
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = var.min_instances
        "autoscaling.knative.dev/maxScale" = var.max_instances
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  autogenerate_revision_name = true
}

# サービス用のサービスアカウント
resource "google_service_account" "service_account" {
  account_id   = "${var.service_name}-sa"
  display_name = "Service Account for ${var.service_name}"
  project      = var.project_id
}

# 必要なIAMロールの付与
resource "google_project_iam_member" "cloud_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.service_account.email}"
}

resource "google_project_iam_member" "storage_object_user" {
  project = var.project_id
  role    = "roles/storage.objectUser"
  member  = "serviceAccount:${google_service_account.service_account.email}"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.service_account.email}"
}

# 公開アクセス設定（認証なしでアクセス可能）
resource "google_cloud_run_service_iam_member" "public" {
  location = google_cloud_run_service.service.location
  project  = google_cloud_run_service.service.project
  service  = google_cloud_run_service.service.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
