# NVIDIA Parakeet-TDT セットアップガイド

このガイドでは、NVIDIA Parakeet-TDT-0.6B-v2 モデルをローカル環境またはクラウド環境にセットアップする手順を説明します。

## 概要

NVIDIA Parakeet-TDT-0.6B-v2 は、高品質な英語音声認識のための 600M パラメータの ASR モデルです。句読点、大文字小文字、正確なタイムスタンプ予測をサポートし、最大 24 分の音声を一度に処理できます。

- **ライセンス**: CC-BY-4.0
- **モデルサイズ**: 約 2 GB
- **対応言語**: 英語のみ（2025-05 時点）
- **必要環境**: NVIDIA GPU (推奨: L4, A10G, A100 など)

## セットアップ方法

### 1. ローカル開発環境 (Docker)

#### 前提条件
- NVIDIA GPU 搭載マシン
- Docker と NVIDIA Container Toolkit

#### 手順

1. Docker イメージのプル

```bash
docker pull nvcr.io/nvidia/nemo:23.10
```

2. モデルのダウンロード

```bash
mkdir -p models
cd models
wget https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2/resolve/main/parakeet_tdt_0.6b_v2.nemo
```

3. 推論サーバー起動

```bash
docker run --gpus all -it --rm \
  -p 8001:8001 \
  -v $(pwd)/models:/models \
  nvcr.io/nvidia/nemo:23.10 \
  python -m torch.distributed.launch \
  --nproc_per_node=1 \
  --master_port=8001 \
  <nemo_path>/examples/asr/transcribe_speech.py \
  model_path=/models/parakeet_tdt_0.6b_v2.nemo \
  audio_dir=<audio_dir> \
  output_dir=<output_dir> \
  batch_size=32 \
  compute_timestamps=True
```

### 2. GKE (Google Kubernetes Engine) セットアップ

#### 前提条件
- Google Cloud アカウント
- `gcloud` CLI ツール

#### 手順

1. GKE クラスタ作成 (GPU ノードプール付き)

```bash
gcloud container clusters create parakeet-cluster \
  --zone us-central1-a \
  --num-nodes 1 \
  --machine-type n1-standard-8 \
  --no-enable-autoupgrade \
  --no-enable-autorepair

gcloud container node-pools create gpu-pool \
  --cluster parakeet-cluster \
  --zone us-central1-a \
  --num-nodes 1 \
  --machine-type n1-standard-8 \
  --accelerator type=nvidia-tesla-t4,count=1 \
  --enable-autoscaling \
  --min-nodes 0 \
  --max-nodes 3
```

2. Triton Inference Server デプロイ

```bash
# Kubernetes マニフェストを作成
cat <<EOF > triton-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: triton-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: triton-server
  template:
    metadata:
      labels:
        app: triton-server
    spec:
      containers:
      - name: triton-server
        image: nvcr.io/nvidia/tritonserver:23.10-py3
        resources:
          limits:
            nvidia.com/gpu: 1
        ports:
        - containerPort: 8000
        - containerPort: 8001
        - containerPort: 8002
        volumeMounts:
        - name: model-store
          mountPath: /models
        env:
        - name: MODEL_REPOSITORY_PATH
          value: /models
        command:
        - tritonserver
        - --model-repository=/models
        - --strict-model-config=false
      volumes:
      - name: model-store
        persistentVolumeClaim:
          claimName: model-store-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: triton-server
spec:
  selector:
    app: triton-server
  ports:
  - port: 8000
    targetPort: 8000
    name: http
  - port: 8001
    targetPort: 8001
    name: grpc
  - port: 8002
    targetPort: 8002
    name: metrics
  type: LoadBalancer
EOF

# デプロイ適用
kubectl apply -f triton-deployment.yaml
```

3. モデルの変換と配置

```bash
# NeMo モデルを Triton 形式に変換
docker run --gpus all -it --rm \
  -v $(pwd)/models:/models \
  nvcr.io/nvidia/nemo:23.10 \
  python -c "
import nemo.collections.asr as nemo_asr
model = nemo_asr.models.ASRModel.restore_from('/models/parakeet_tdt_0.6b_v2.nemo')
model.export_to_triton(
    '/models/triton_models',
    model_name='parakeet_tdt',
    precision='fp16',
    max_batch_size=32,
    optimize_for='throughput',
)
"

# モデルを GCS にアップロード
gsutil cp -r models/triton_models gs://your-bucket/models/
```

## API 統合

### FastAPI での統合例

```python
from fastapi import FastAPI, UploadFile, File
import tritonclient.grpc as grpcclient
import numpy as np
import soundfile as sf
import io
import json

app = FastAPI()

# Triton クライアント設定
triton_client = grpcclient.InferenceServerClient(
    url="triton-server:8001",
    verbose=False
)

@app.post("/stt/parakeet")
async def transcribe_audio(file: UploadFile = File(...)):
    # 音声ファイルを読み込み
    content = await file.read()
    audio, sample_rate = sf.read(io.BytesIO(content))
    
    # 音声データを前処理
    if len(audio.shape) > 1:
        audio = audio[:, 0]  # モノラルに変換
    if sample_rate != 16000:
        # リサンプリングコード (librosa等を使用)
        pass
    
    # Triton へのリクエスト準備
    audio_data = audio.astype(np.float32)
    inputs = [
        grpcclient.InferInput("AUDIO", audio_data.shape, "FP32"),
        grpcclient.InferInput("AUDIO_LEN", [1], "INT32")
    ]
    
    inputs[0].set_data_from_numpy(audio_data)
    inputs[1].set_data_from_numpy(np.array([len(audio_data)], dtype=np.int32))
    
    outputs = [
        grpcclient.InferRequestedOutput("TRANSCRIPTS"),
        grpcclient.InferRequestedOutput("TIMESTAMPS")
    ]
    
    # 推論実行
    response = triton_client.infer(
        model_name="parakeet_tdt",
        inputs=inputs,
        outputs=outputs
    )
    
    # 結果を取得
    transcripts = response.as_numpy("TRANSCRIPTS")
    timestamps = response.as_numpy("TIMESTAMPS")
    
    return {
        "transcript": transcripts[0].decode("utf-8"),
        "timestamps": timestamps[0].tolist()
    }
```

## パフォーマンス最適化

### バッチ処理

長時間音声を処理する場合は、以下の方法でパフォーマンスを最適化できます：

1. チャンク分割: 長い音声を 24 分以下のセグメントに分割
2. バッチサイズ調整: GPU メモリに応じて最適なバッチサイズを選択
3. 混合精度: FP16 を使用してスループットを向上

### スケーリング

- **水平スケーリング**: GKE の HPA (Horizontal Pod Autoscaler) を設定
- **垂直スケーリング**: より大きな GPU (A100 など) を使用

## トラブルシューティング

### 一般的な問題

1. **GPU メモリ不足**
   - バッチサイズを小さくする
   - 音声チャンクを短くする

2. **推論速度が遅い**
   - FP16 精度を使用
   - GPU ドライバーが最新か確認

3. **認識精度の問題**
   - 音声前処理を改善 (ノイズ除去、正規化)
   - サンプルレートが 16kHz であることを確認

## ライセンス表記

CC-BY-4.0 ライセンスに従い、以下の表記をアプリケーション内に含める必要があります：

```
音声認識技術の一部に NVIDIA Parakeet-TDT-0.6B-v2 (CC-BY-4.0) を使用しています。
https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2
```

---

© 2025 Windsurf Engineering
