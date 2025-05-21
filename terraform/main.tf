/**
 * しゃべるノート - Terraform メインファイル
 * GCP リソースのプロビジョニングを管理
 */

terraform {
  required_version = ">= 1.0.0"
  
  backend "gcs" {
    # 環境ごとに異なるバケットを使用
    # bucket = "talknote-tfstate-${var.environment}"
    # prefix = "terraform/state"
  }
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# ランダムサフィックス生成（リソース名の一意性確保）
resource "random_id" "suffix" {
  byte_length = 4
}

# Cloud Run サービス
module "cloud_run" {
  source = "./modules/cloud_run"
  
  project_id    = var.project_id
  region        = var.region
  service_name  = "talknote-api-${var.environment}"
  image         = var.api_image
  
  # 環境変数
  env_vars = {
    DEBUG                       = var.debug
    BYPASS_AUTH                 = var.bypass_auth
    DATABASE_URL                = module.cloud_sql.database_url
    FIREBASE_PROJECT_ID         = var.firebase_project_id
    GCP_PROJECT_ID              = var.project_id
    GCS_BUCKET_NAME             = var.gcs_bucket_name
    GOOGLE_APPLICATION_CREDENTIALS = "/secrets/service-account.json"
  }
  
  # シークレット
  secrets = {
    "service-account" = module.secret_manager.secret_version_ids["service-account"]
  }
  
  depends_on = [
    module.cloud_sql,
    module.secret_manager
  ]
}

# Cloud SQL インスタンス
module "cloud_sql" {
  source = "./modules/cloud_sql"
  
  project_id      = var.project_id
  region          = var.region
  instance_name   = "talknote-db-${var.environment}-${random_id.suffix.hex}"
  database_name   = "talknote"
  database_version = "POSTGRES_14"
  
  # 開発環境と本番環境で異なる設定
  tier            = var.environment == "prod" ? "db-g1-small" : "db-f1-micro"
  disk_size       = var.environment == "prod" ? 20 : 10
  
  # データベース認証情報
  db_user         = var.db_user
  db_password     = var.db_password
}

# Secret Manager
module "secret_manager" {
  source = "./modules/secret_manager"
  
  project_id      = var.project_id
  secrets = {
    "service-account" = var.service_account_json
    "db-password"     = var.db_password
  }
}
