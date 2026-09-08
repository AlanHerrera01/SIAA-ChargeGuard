#!/usr/bin/env python3
"""Unified Lambda packaging and deployment script for ChargeGuard.

Builds reproducible Linux x86_64 deployment packages for:
- chargeguard-backend
- chargeguard-mock-bank
- chargeguard-mock-merchant

Works both in local environments (using Docker when available) and in GitHub Actions runners.
"""

import argparse
import os
import platform
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_cmd(cmd: list[str], cwd: Path | None = None) -> None:
    print(f"Running: {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=cwd or ROOT, check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"Command failed with exit code {result.returncode}: {' '.join(str(c) for c in cmd)}"
        )


def has_docker() -> bool:
    try:
        res = subprocess.run(
            ["docker", "info"], capture_output=True, text=True, check=False
        )
        return res.returncode == 0
    except Exception:
        return False


def install_requirements(req_file: Path, target_dir: Path, use_docker: bool) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    if use_docker:
        print(
            f"Building dependencies in Linux container using Docker for {req_file}..."
        )
        # Mount repo root as /workspace and target_dir as /target
        req_rel = req_file.relative_to(ROOT).as_posix()
        target_rel = target_dir.relative_to(ROOT).as_posix()
        docker_cmd = [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{ROOT.resolve().as_posix()}:/workspace",
            "-w",
            "/workspace",
            "python:3.12-slim",
            "sh",
            "-c",
            f"pip install --no-cache-dir --quiet -r {req_rel} -t {target_rel}",
        ]
        run_cmd(docker_cmd)
    else:
        print(f"Installing dependencies directly using pip for {req_file}...")
        pip_cmd = [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--quiet",
            "--no-cache-dir",
            "-r",
            str(req_file),
            "-t",
            str(target_dir),
        ]
        if platform.system() == "Windows":
            # On Windows without Docker, attempt manylinux binary wheel download if possible
            pip_cmd.extend(
                [
                    "--platform",
                    "manylinux2014_x86_64",
                    "--only-binary=:all:",
                ]
            )
        run_cmd(pip_cmd)


def create_zip(source_dir: Path, output_zip: Path) -> None:
    print(f"Creating archive {output_zip}...")
    output_zip.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(source_dir):
            # Skip __pycache__ and git metadata
            dirs[:] = [
                d for d in dirs if d not in ("__pycache__", ".git", ".pytest_cache")
            ]
            for file in files:
                if file.endswith((".pyc", ".pyo")):
                    continue
                file_path = Path(root) / file
                arcname = file_path.relative_to(source_dir).as_posix()
                zf.write(file_path, arcname)
    size_mb = output_zip.stat().st_size / (1024 * 1024)
    print(f"Created {output_zip.name} ({size_mb:.2f} MB)")


def copy_tree(src: Path, dst: Path) -> None:
    if src.is_file():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    elif src.is_dir():
        shutil.copytree(
            src,
            dst,
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
        )


def package_backend(output_zip: Path, use_docker: bool) -> None:
    print("\n--- Packaging chargeguard-backend ---")
    build_dir = ROOT / "build_pkg_backend"
    if build_dir.exists():
        shutil.rmtree(build_dir)
    build_dir.mkdir(parents=True)

    try:
        install_requirements(
            ROOT / "backend" / "requirements.txt", build_dir, use_docker
        )
        copy_tree(ROOT / "backend", build_dir / "backend")
        copy_tree(ROOT / "agents", build_dir / "agents")
        copy_tree(ROOT / "config.py", build_dir / "config.py")
        copy_tree(ROOT / "datasets", build_dir / "datasets")
        create_zip(build_dir, output_zip)
    finally:
        shutil.rmtree(build_dir, ignore_errors=True)


def package_bank(output_zip: Path, use_docker: bool) -> None:
    print("\n--- Packaging chargeguard-mock-bank ---")
    build_dir = ROOT / "build_pkg_bank"
    if build_dir.exists():
        shutil.rmtree(build_dir)
    build_dir.mkdir(parents=True)

    try:
        install_requirements(
            ROOT / "mock-services" / "bank" / "requirements.txt", build_dir, use_docker
        )
        copy_tree(ROOT / "mock-services" / "bank", build_dir)
        copy_tree(ROOT / "datasets", build_dir / "datasets")
        create_zip(build_dir, output_zip)
    finally:
        shutil.rmtree(build_dir, ignore_errors=True)


def package_merchant(output_zip: Path, use_docker: bool) -> None:
    print("\n--- Packaging chargeguard-mock-merchant ---")
    build_dir = ROOT / "build_pkg_merchant"
    if build_dir.exists():
        shutil.rmtree(build_dir)
    build_dir.mkdir(parents=True)

    try:
        install_requirements(
            ROOT / "mock-services" / "merchant" / "requirements.txt",
            build_dir,
            use_docker,
        )
        copy_tree(ROOT / "mock-services" / "merchant", build_dir)
        copy_tree(ROOT / "datasets", build_dir / "datasets")
        create_zip(build_dir, output_zip)
    finally:
        shutil.rmtree(build_dir, ignore_errors=True)


def deploy_lambda(function_name: str, zip_path: Path) -> None:
    print(f"Deploying {zip_path.name} to Lambda function {function_name}...")
    run_cmd(
        [
            "aws",
            "lambda",
            "update-function-code",
            "--function-name",
            function_name,
            "--zip-file",
            f"fileb://{zip_path.resolve().as_posix()}",
            "--no-cli-pager",
        ]
    )
    print(f"Waiting for function {function_name} update to complete...")
    run_cmd(
        [
            "aws",
            "lambda",
            "wait",
            "function-updated",
            "--function-name",
            function_name,
        ]
    )
    print(f"Lambda {function_name} successfully updated.")


def main():
    parser = argparse.ArgumentParser(
        description="Package and deploy ChargeGuard Lambdas."
    )
    parser.add_argument(
        "--component",
        choices=["backend", "bank", "merchant", "all"],
        default="all",
        help="Component to package (default: all)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT,
        help="Output directory for generated zip files (default: project root)",
    )
    parser.add_argument(
        "--upload",
        action="store_true",
        help="Upload the generated zip files to AWS Lambda after packaging",
    )
    parser.add_argument(
        "--force-pip",
        action="store_true",
        help="Force direct pip install without Docker even if Docker is available",
    )
    args = parser.parse_args()

    use_docker = (
        has_docker() and not args.force_pip and (platform.system() == "Windows")
    )
    print(f"Packaging environment: OS={platform.system()}, Docker={use_docker}")

    artifacts = {}

    if args.component in ("backend", "all"):
        backend_zip = args.output_dir / "backend_deploy.zip"
        package_backend(backend_zip, use_docker)
        artifacts["chargeguard-backend"] = backend_zip

    if args.component in ("bank", "all"):
        bank_zip = args.output_dir / "mock_bank_deploy.zip"
        package_bank(bank_zip, use_docker)
        artifacts["chargeguard-mock-bank"] = bank_zip

    if args.component in ("merchant", "all"):
        merchant_zip = args.output_dir / "mock_merchant_deploy.zip"
        package_merchant(merchant_zip, use_docker)
        artifacts["chargeguard-mock-merchant"] = merchant_zip

    if args.upload:
        print("\n=== Uploading Lambdas to AWS ===")
        for func_name, zip_file in artifacts.items():
            deploy_lambda(func_name, zip_file)

    print("\nPackaging completed successfully!")
    for func, path in artifacts.items():
        print(f"  {func}: {path}")


if __name__ == "__main__":
    main()
