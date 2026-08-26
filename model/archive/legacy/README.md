# legacy

This directory is no longer a place for active development. It exists purely for
backward compatibility.

## Contents

- `__init__.py` — alias exports pointing at `archive/legacy_modules/`
- `shielding_legacy.py` — alias for `archive/legacy_modules/shielding_legacy.py`
- `attenuation_k.py` — alias for `archive/legacy_modules/attenuation_k.py`

## Usage rule

New code should import from `archive/legacy_modules/` directly. `legacy/` only exists
so that older imports keep working.
