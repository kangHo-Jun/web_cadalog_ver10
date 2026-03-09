import json
import os
from typing import Dict, Tuple, Any


def detect_changes(old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Compare old/new price maps and return a dict with:
    - changed: keys in both with different values (value from new)
    - added: keys only in new
    - removed: keys only in old (value from old)
    """
    old = old or {}
    new = new or {}

    changed = {k: new[k] for k in new.keys() & old.keys() if new[k] != old[k]}
    added = {k: new[k] for k in new.keys() - old.keys()}
    removed = {k: old[k] for k in old.keys() - new.keys()}
    return {
        "changed": changed,
        "added": added,
        "removed": removed,
    }


def load_cache(filepath: str) -> Dict[str, Any]:
    """Load cache JSON. Returns empty dict if file missing or empty."""
    if not os.path.exists(filepath):
        return {}
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return {}
            data = json.loads(content)
            return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}


def save_cache(data: Dict[str, Any], filepath: str) -> None:
    """Persist cache JSON to disk."""
    dirpath = os.path.dirname(filepath)
    if dirpath:
        os.makedirs(dirpath, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data or {}, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
