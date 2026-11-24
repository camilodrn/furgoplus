"""Verify a Podman or Docker save archive against the frozen IMAGES.tsv."""

import argparse
import csv
import gzip
import hashlib
import json
import tarfile


def member(archive, name):
    entry = archive.getmember(name)
    if not entry.isfile():
        raise ValueError(f"Expected a regular archive member: {name}")
    return archive.extractfile(entry)


def layer_digest(stream):
    magic = stream.read(2)
    stream.seek(0)
    if magic == b"\x1f\x8b":
        with gzip.GzipFile(fileobj=stream) as decompressed:
            return hashlib.file_digest(decompressed, "sha256").hexdigest()
    return hashlib.file_digest(stream, "sha256").hexdigest()


def verify(inventory, image_archive):
    with open(inventory, encoding="utf-8", newline="") as source:
        expected = {row["tag"]: row for row in csv.DictReader(source, delimiter="\t")}
    if len(expected) != 2:
        raise ValueError("Expected exactly two Task 16 tags in the inventory")

    with tarfile.open(image_archive, "r:") as archive:
        with member(archive, "manifest.json") as source:
            manifest = json.load(source)
        entries = {}
        for entry in manifest:
            for tag in entry["RepoTags"]:
                if tag in entries:
                    raise ValueError(f"Duplicate archive tag: {tag}")
                entries[tag] = entry
        if set(entries) != set(expected):
            raise ValueError("Archive tags differ from the frozen inventory")

        for tag, row in expected.items():
            entry = entries[tag]
            with member(archive, entry["Config"]) as source:
                raw_config = source.read()
            if "sha256:" + hashlib.sha256(raw_config).hexdigest() != row["image_id"]:
                raise ValueError(f"Image configuration differs: {tag}")
            config = json.loads(raw_config)
            if f"{config['os']}/{config['architecture']}" != row["platform"]:
                raise ValueError(f"Image platform differs: {tag}")
            digests = config["rootfs"]["diff_ids"]
            layers = entry["Layers"]
            if len(digests) != len(layers):
                raise ValueError(f"Layer count differs: {tag}")
            for position, (path, expected_digest) in enumerate(
                zip(layers, digests, strict=True), start=1
            ):
                with member(archive, path) as source:
                    digest = layer_digest(source)
                if "sha256:" + digest != expected_digest:
                    raise ValueError(f"Layer {position} differs: {tag}")
            print(f"{tag}: {row['platform']}, config and {len(layers)} layers OK")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inventory")
    parser.add_argument("image_archive")
    args = parser.parse_args()
    try:
        verify(args.inventory, args.image_archive)
    except (EOFError, KeyError, TypeError, ValueError, OSError, tarfile.TarError) as error:
        parser.exit(1, f"Verification failed: {error}\n")


if __name__ == "__main__":
    main()
