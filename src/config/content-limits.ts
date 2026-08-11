/**
 * Defensive limits for browser-authored and imported project data.
 * These bounds keep hostile project files from creating excessive DOM/PDF work.
 */
export const MAX_PROJECT_STRIPS = 128
export const MAX_CELLS_PER_STRIP = 256
export const MAX_NAME_LENGTH = 160
export const MAX_CELL_TEXT_LENGTH = 2_000
export const MAX_LABEL_TEXT_LENGTH = 500
export const MAX_ID_LENGTH = 200
export const MAX_TIMESTAMP_LENGTH = 64
export const MAX_PROJECT_FILE_BYTES = 5_000_000
