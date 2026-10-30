"""Losslessly wrap the bundled, unmodified SFNT fonts in WOFF 1 containers.

No font editor or network needed. Input files are installed OFL fonts on Fedora.
Run only to regenerate assets; normal development/builds use the bundled WOFFs.
"""
from pathlib import Path
import struct
import zlib

root = Path(__file__).resolve().parents[1] / 'public' / 'fonts'
fonts = [
    Path('/usr/share/fonts/adwaita-sans-fonts/AdwaitaSans-Regular.ttf'),
    Path('/usr/share/fonts/liberation-serif-fonts/LiberationSerif-Italic.ttf'),
]
for source in fonts:
    raw = source.read_bytes()
    count = struct.unpack_from('>H', raw, 4)[0]
    offset = 44 + 20 * count
    directory, chunks = [], []
    sfnt_size = 12 + 16 * count
    for index in range(count):
        tag, checksum, start, length = struct.unpack_from('>4sIII', raw, 12 + index * 16)
        original = raw[start:start + length]
        compressed = zlib.compress(original, 9)
        payload = compressed if len(compressed) < length else original
        assert (zlib.decompress(payload) if len(payload) < length else payload) == original
        directory.append(struct.pack('>4sIIII', tag, offset, len(payload), length, checksum))
        padding = (4 - len(payload) % 4) % 4
        chunks.append(payload + b'\0' * padding)
        offset += len(payload) + padding
        sfnt_size += (length + 3) & ~3
    header = struct.pack('>4s4sIHHIHHIIIII', b'wOFF', raw[:4], offset, count, 0, sfnt_size, 1, 0, 0, 0, 0, 0, 0)
    result = header + b''.join(directory) + b''.join(chunks)
    assert len(result) == offset
    destination = root / (source.stem + '.woff')
    destination.write_bytes(result)
    print(f'{destination.name}: {len(raw):,} → {len(result):,} bytes')
