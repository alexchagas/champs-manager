declare module './editorFileStore.mjs' {
  export function persistClubEdits(root: string, clubs: import('./src/types').Club[]): Promise<void>;
}
