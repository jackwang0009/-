"""Shared cache validation for Qimao chapter-list responses."""

import json
import os
import tempfile


def parse_chapters(body):
    """Return a validated chapter list, or None for HTML/invalid responses."""
    try:
        payload = json.loads(body)
    except (TypeError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    data = payload.get('data')
    chapters = data.get('chapters') if isinstance(data, dict) else None
    if not isinstance(chapters, list) or not chapters:
        return None
    for chapter in chapters:
        if not isinstance(chapter, dict):
            return None
        try:
            int(chapter['update_time'])
        except (KeyError, TypeError, ValueError):
            return None
    return chapters


def read_cached(path):
    """Read a cache only when it contains a usable chapter-list response."""
    try:
        with open(path, encoding='utf-8') as f:
            return parse_chapters(f.read())
    except (OSError, UnicodeError):
        return None


def write_cached(path, body):
    """Atomically replace a cache after the response has passed validation."""
    directory = os.path.dirname(path) or '.'
    fd, tmp = tempfile.mkstemp(prefix='.qmc-', suffix='.tmp', dir=directory,
                               text=True)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(body)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def write_output(path, value):
    """Atomically write the derived chapter summary."""
    directory = os.path.dirname(path) or '.'
    fd, tmp = tempfile.mkstemp(prefix='.qm-chaps-', suffix='.tmp', dir=directory,
                               text=True)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(value, f, ensure_ascii=False, indent=1)
            f.write('\n')
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
