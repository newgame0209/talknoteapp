/**
 * しゃべるノート - 本番環境 Terraform 設定
 */

terraform {
  required_version = ">= 1.0.0"
  
  backend "gcs" {
    bucket = "talknote-tfstate-prod"
    prefix = "terraform/state"
  }
}

module "talknote_prod" {
  source = "../../"
  
  # プロジェクト設定
  project_id         = var.project_id
  region             = var.region
  environment        = "prod"
  
  # アプリケーション設定
  api_image          = var.api_image
  debug              = false
  bypass_auth        = false
  firebase_project_id = var.firebase_project_id
  gcs_bucket_name    = "talknote-media-prod"
  
  # データベース設定
  db_user            = var.db_user
  db_password        = var.db_password
  
  # サービスアカウント
  service_account_json = var.service_account_json
}
