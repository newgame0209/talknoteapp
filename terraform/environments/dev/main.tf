/**
 * しゃべるノート - 開発環境 Terraform 設定
 */

terraform {
  required_version = ">= 1.0.0"
  
  backend "gcs" {
    bucket = "talknote-tfstate-dev"
    prefix = "terraform/state"
  }
}

module "talknote_dev" {
  source = "../../"
  
  # プロジェクト設定
  project_id         = var.project_id
  region             = var.region
  environment        = "dev"
  
  # アプリケーション設定
  api_image          = var.api_image
  debug              = true
  bypass_auth        = true
  firebase_project_id = var.firebase_project_id
  gcs_bucket_name    = "talknote-media-dev"
  
  # データベース設定
  db_user            = var.db_user
  db_password        = var.db_password
  
  # サービスアカウント
  service_account_json = var.service_account_json
}
