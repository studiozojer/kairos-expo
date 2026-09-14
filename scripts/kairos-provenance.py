"""Record exactly which checkout produced vendored native artifacts."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

engine, artifact, platform = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
def git(*args):
    return subprocess.check_output(["git", "-C", str(engine), *args])
record = {
    "engine_commit": git("rev-parse", "HEAD").decode().strip(),
    "tracked_diff_sha256": hashlib.sha256(git("diff", "HEAD", "--")).hexdigest(),
    "dirty": bool(git("status", "--porcelain", "--untracked-files=no")),
    "jianyi_commit": subprocess.check_output(["git", "-C", str(engine.parent / "jianyi"), "rev-parse", "HEAD"]).decode().strip(),
    "cargo_lock_sha256": hashlib.sha256((engine / "Cargo.lock").read_bytes()).hexdigest(),
    "features": ["database-sqlite", "tokio-minimal"],
    "rustc": subprocess.check_output(["rustc", "--version"]).decode().strip(),
    "files": {str(p.relative_to(artifact)): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in sorted(artifact.rglob("*")) if p.is_file()},
}
out = Path(__file__).resolve().parents[1] / "modules/kairos" / f"{platform}-provenance.json"
out.write_text(json.dumps(record, indent=2) + "\n")
