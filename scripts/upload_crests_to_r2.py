#!/usr/bin/env python3
"""
Upload script for Champs Manager crests to Cloudflare R2 bucket.
Supports multi-threaded concurrent uploads via S3-compatible API.

Usage:
  export R2_ACCOUNT_ID="your_account_id"
  export R2_ACCESS_KEY_ID="your_access_key_id"
  export R2_SECRET_ACCESS_KEY="your_secret_access_key"
  export R2_BUCKET_NAME="champs-crests"
  python3 scripts/upload_crests_to_r2.py
"""

import os
import sys
import glob
from concurrent.futures import ThreadPoolExecutor, as_completed

def main():
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket_name = os.environ.get("R2_BUCKET_NAME", "champs-crests")

    if not all([account_id, access_key, secret_key]):
        print("Erro: Variáveis de ambiente R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY são obrigatórias.")
        print("\nExemplo:")
        print("  export R2_ACCOUNT_ID=\"xxx\"")
        print("  export R2_ACCESS_KEY_ID=\"xxx\"")
        print("  export R2_SECRET_ACCESS_KEY=\"xxx\"")
        print("  export R2_BUCKET_NAME=\"champs-crests\"")
        sys.exit(1)

    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        print("Instalando dependência boto3 para comunicação S3/R2...")
        os.system(f"{sys.executable} -m pip install boto3")
        import boto3
        from botocore.config import Config

    endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
    print(f"Conectando ao Cloudflare R2: {endpoint_url}")

    s3 = boto3.client(
        service_name="s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
        config=Config(s3={"addressing_style": "path"})
    )

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    escudos_dir = os.path.join(root, "web/public/escudos")
    escudos_mini_dir = os.path.join(root, "web/public/escudosMini")

    files_to_upload = []
    for filepath in glob.glob(os.path.join(escudos_dir, "*.png")):
        filename = os.path.basename(filepath)
        files_to_upload.append((filepath, f"escudos/{filename}"))

    for filepath in glob.glob(os.path.join(escudos_mini_dir, "*.png")):
        filename = os.path.basename(filepath)
        files_to_upload.append((filepath, f"escudosMini/{filename}"))

    total = len(files_to_upload)
    print(f"Encontrados {total} arquivos para upload no bucket '{bucket_name}'.")

    if total == 0:
        print("Nenhum arquivo encontrado em web/public/escudos ou web/public/escudosMini.")
        return

    success_count = 0
    error_count = 0

    def upload_file(item):
        local_path, s3_key = item
        try:
            s3.upload_file(
                Filename=local_path,
                Bucket=bucket_name,
                Key=s3_key,
                ExtraArgs={
                    "ContentType": "image/png",
                    "CacheControl": "public, max-age=31536000, immutable"
                }
            )
            return True, s3_key
        except Exception as e:
            return False, f"{s3_key}: {e}"

    print(f"Iniciando upload com 24 threads simultâneas...")
    with ThreadPoolExecutor(max_workers=24) as executor:
        futures = {executor.submit(upload_file, item): item for item in files_to_upload}
        for idx, future in enumerate(as_completed(futures), 1):
            success, msg = future.result()
            if success:
                success_count += 1
            else:
                error_count += 1
                print(f"\nFalha no upload: {msg}")

            if idx % 500 == 0 or idx == total:
                percent = (idx / total) * 100
                print(f"Progresso: {idx}/{total} ({percent:.1f}%) | Sucessos: {success_count} | Erros: {error_count}")

    print("\n" + "=" * 50)
    print(f"Upload finalizado!")
    print(f"Total enviado com sucesso: {success_count}")
    print(f"Erros: {error_count}")
    print("=" * 50)

if __name__ == "__main__":
    main()
