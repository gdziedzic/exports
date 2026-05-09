import json
from pathlib import Path

CONFIG_FILE = Path(__file__).parent / "powledge.config.json"

def load_config(path: Path = CONFIG_FILE) -> dict:
    with open(path) as f:
        return json.load(f)

def get_dir(config: dict, key: str) -> Path:
    """Resolve a configured dir path relative to the toolkit root."""
    root = CONFIG_FILE.parent
    return root / config["dirs"][key]

def raw_dir(config: dict) -> Path:
    return get_dir(config, "raw")

def knowledge_dir(config: dict) -> Path:
    return get_dir(config, "knowledge")

def index_dir(config: dict) -> Path:
    return get_dir(config, "index")

def ensure_dirs(config: dict) -> None:
    for key in config["dirs"]:
        get_dir(config, key).mkdir(parents=True, exist_ok=True)
