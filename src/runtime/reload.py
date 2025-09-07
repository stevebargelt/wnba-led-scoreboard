from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Dict


@dataclass
class FileSig:
    mtime_ns: int
    size: int


def _stat_sig(p: Path) -> FileSig | None:
    try:
        st = p.stat()
        return FileSig(mtime_ns=int(getattr(st, "st_mtime_ns", int(st.st_mtime * 1e9))), size=st.st_size)
    except FileNotFoundError:
        return None
    except PermissionError:
        return None


class ConfigWatcher:
    """Watches one or more files and reports when any signature changes."""

    def __init__(self, paths: Iterable[os.PathLike | str], poll_secs: float = 0.0):
        self.paths = [Path(p) for p in paths]
        self.poll_secs = poll_secs
        self._sigs: Dict[Path, FileSig | None] = {p: _stat_sig(p) for p in self.paths}

    def snapshot(self) -> None:
        self._sigs = {p: _stat_sig(p) for p in self.paths}

    def changed(self) -> bool:
        for p in self.paths:
            old = self._sigs.get(p)
            cur = _stat_sig(p)
            if (old is None) != (cur is None):
                self._sigs[p] = cur
                return True
            if cur and old and (cur.mtime_ns != old.mtime_ns or cur.size != old.size):
                self._sigs[p] = cur
                return True
        return False

    def wait_for_change(self, timeout: float | None = None) -> bool:
        start = time.monotonic()
        while True:
            if self.changed():
                return True
            if timeout is not None and (time.monotonic() - start) >= timeout:
                return False
            if self.poll_secs:
                time.sleep(self.poll_secs)

