"""Zip and deploy frontend to AWS Amplify with proper Unix file permissions."""

import io
import os
import sys
import time
import zipfile
from pathlib import Path

import boto3
import httpx

APP_ID = "d24otvpswldjmf"
BRANCH = "main"
DIST_DIR = Path(__file__).resolve().parents[1] / "frontend" / "dist"


def build_zip() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(DIST_DIR):
            for d in dirs:
                dir_path = Path(root) / d
                rel_path = dir_path.relative_to(DIST_DIR).as_posix() + "/"
                zinfo = zipfile.ZipInfo(rel_path)
                zinfo.create_system = 3  # Unix
                zinfo.external_attr = 0o40755 << 16
                zf.writestr(zinfo, b"")
            for f in files:
                file_path = Path(root) / f
                rel_path = file_path.relative_to(DIST_DIR).as_posix()
                data = file_path.read_bytes()
                zinfo = zipfile.ZipInfo(rel_path)
                zinfo.create_system = 3  # Unix
                zinfo.external_attr = 0o100644 << 16
                zf.writestr(zinfo, data)
    return buffer.getvalue()


def deploy():
    print("Building Unix-compliant deployment zip...")
    zip_bytes = build_zip()
    print(f"Zip size: {len(zip_bytes)} bytes")

    client = boto3.client("amplify", region_name="us-east-1")
    print(f"Creating deployment for {APP_ID}/{BRANCH}...")
    dep = client.create_deployment(appId=APP_ID, branchName=BRANCH)
    job_id = dep["jobId"]
    upload_url = dep["zipUploadUrl"]
    print(f"Deployment created: Job {job_id}")

    print("Uploading zip package...")
    resp = httpx.put(
        upload_url,
        content=zip_bytes,
        headers={"Content-Type": "application/zip"},
        timeout=60.0,
    )
    resp.raise_for_status()
    print("Upload completed successfully.")

    print(f"Starting deployment for Job {job_id}...")
    client.start_deployment(appId=APP_ID, branchName=BRANCH, jobId=job_id)

    print("Waiting for deployment to complete...")
    for _ in range(60):
        time.sleep(2)
        job = client.get_job(appId=APP_ID, branchName=BRANCH, jobId=job_id)["job"]
        status = job["summary"]["status"]
        print(f"Status: {status}")
        if status in {"SUCCEED", "FAILED", "CANCELLED"}:
            break

    if status != "SUCCEED":
        print(f"Deployment failed with status {status}", file=sys.stderr)
        sys.exit(1)

    print(f"Deployment {job_id} succeeded!")


if __name__ == "__main__":
    deploy()
