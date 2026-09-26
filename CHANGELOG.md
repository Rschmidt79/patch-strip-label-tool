# Changelog

All notable changes to Patch Strip Label Tool are documented here.

## [1.0.2] - 2026-09-26

### Fixed
- Pressing Enter in a cell now starts line 2. Previously the line break disappeared as soon as it was typed, because an empty second line was not kept while editing.
- The first click on a cell now puts the cursor in the cell editor, so you can type immediately. Previously focus landed on the cell itself and typed text was lost until you clicked a second time.
- PDF export and Print no longer fail when a cell or group header contains characters the built-in PDF font cannot print, such as `→`, `≥`, `Ω` or `✓`. They are replaced with readable equivalents (`->`, `>=`, `Ohm`, `v`), and any other unsupported character becomes `?`. The message after export or print lists the characters that were replaced. Danish and other Latin-1 characters are unchanged.

## [1.0.1] - 2026-08-26

### Fixed
- Protected multi-row editing and improved the strip join workflow.

## [1.0.0] - 2026-08-21

- First stable release, with refreshed inspector and row controls.

## [0.8.0-beta] - 2026-08-14

- Beta release with print packing, cut guides, PWA project files, US paper sizes, SRA3 support and a mobile notice.
