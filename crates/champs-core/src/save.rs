//! `.cmsav` persistence: bincode + zstd with a versioned, checksummed header,
//! plus JSON export (see rea/02, section 5).
//!
//! Layout:
//! ```text
//! offset size  field
//! 0      4     magic  "CMSV"
//! 4      4     schema version (u32 LE)
//! 8      32    SHA-256 of the payload (compressed bytes)
//! 40     ..    payload = zstd(bincode(SaveGame))
//! ```

use crate::error::SaveError;
use crate::season::SeasonState;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub const MAGIC: &[u8; 4] = b"CMSV";
pub const SCHEMA_VERSION: u32 = 1;
const HEADER_LEN: usize = 4 + 4 + 32;
const ZSTD_LEVEL: i32 = 3;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SaveMetadata {
    pub save_name: String,
    pub schema_version: u32,
    pub game_version: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SaveGame {
    pub meta: SaveMetadata,
    pub season: SeasonState,
}

impl SaveGame {
    pub fn new(save_name: impl Into<String>, season: SeasonState) -> Self {
        Self {
            meta: SaveMetadata {
                save_name: save_name.into(),
                schema_version: SCHEMA_VERSION,
                game_version: env!("CARGO_PKG_VERSION").to_string(),
            },
            season,
        }
    }

    /// Encodes into the `.cmsav` byte format.
    pub fn to_bytes(&self) -> Result<Vec<u8>, SaveError> {
        let raw = bincode::serialize(self)?;
        #[cfg(not(target_arch = "wasm32"))]
        let payload = zstd::encode_all(raw.as_slice(), ZSTD_LEVEL)?;
        #[cfg(target_arch = "wasm32")]
        let payload = raw;

        let digest = Sha256::digest(&payload);
        let mut out = Vec::with_capacity(HEADER_LEN + payload.len());
        out.extend_from_slice(MAGIC);
        out.extend_from_slice(&SCHEMA_VERSION.to_le_bytes());
        out.extend_from_slice(&digest);
        out.extend_from_slice(&payload);
        Ok(out)
    }

    /// Decodes and validates a `.cmsav` buffer.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, SaveError> {
        if bytes.len() < HEADER_LEN {
            return if bytes.len() >= 4 && &bytes[..4] != MAGIC {
                Err(SaveError::BadMagic)
            } else {
                Err(SaveError::Truncated)
            };
        }
        if &bytes[..4] != MAGIC {
            return Err(SaveError::BadMagic);
        }
        let version = u32::from_le_bytes(bytes[4..8].try_into().unwrap());
        if version > SCHEMA_VERSION {
            return Err(SaveError::UnsupportedVersion { found: version, supported: SCHEMA_VERSION });
        }
        let payload = &bytes[HEADER_LEN..];
        if Sha256::digest(payload).as_slice() != &bytes[8..HEADER_LEN] {
            return Err(SaveError::ChecksumMismatch);
        }
        #[cfg(not(target_arch = "wasm32"))]
        let raw = zstd::decode_all(payload)?;
        #[cfg(target_arch = "wasm32")]
        let raw = payload.to_vec();

        Ok(bincode::deserialize(&raw)?)
    }

    pub fn save_to_writer<W: Write>(&self, mut w: W) -> Result<(), SaveError> {
        w.write_all(&self.to_bytes()?)?;
        Ok(())
    }

    pub fn load_from_reader<R: Read>(mut r: R) -> Result<Self, SaveError> {
        let mut buf = Vec::new();
        r.read_to_end(&mut buf)?;
        Self::from_bytes(&buf)
    }

    /// Writes the save atomically (temp file + rename) and, like the original
    /// game, a `.sbck` backup copy next to it.
    pub fn save_to_file(&self, path: impl AsRef<Path>) -> Result<(), SaveError> {
        let path = path.as_ref();
        if let Some(dir) = path.parent().filter(|d| !d.as_os_str().is_empty()) {
            fs::create_dir_all(dir)?;
        }
        let bytes = self.to_bytes()?;
        let tmp = with_extension_suffix(path, "tmp");
        fs::write(&tmp, &bytes)?;
        fs::rename(&tmp, path)?;
        fs::write(backup_path(path), &bytes)?;
        Ok(())
    }

    /// Loads a save, falling back to the `.sbck` backup if the main file is
    /// missing or corrupted.
    pub fn load_from_file(path: impl AsRef<Path>) -> Result<Self, SaveError> {
        let path = path.as_ref();
        let primary = fs::read(path)
            .map_err(SaveError::from)
            .and_then(|b| Self::from_bytes(&b));
        match primary {
            Ok(s) => Ok(s),
            Err(e) => {
                let bak = backup_path(path);
                match fs::read(&bak) {
                    Ok(b) => Self::from_bytes(&b).map_err(|_| e),
                    Err(_) => Err(e),
                }
            }
        }
    }

    pub fn to_json(&self) -> Result<String, SaveError> {
        Ok(serde_json::to_string_pretty(self)?)
    }

    pub fn from_json(json: &str) -> Result<Self, SaveError> {
        Ok(serde_json::from_str(json)?)
    }

    pub fn export_json(&self, path: impl AsRef<Path>) -> Result<(), SaveError> {
        fs::write(path, self.to_json()?)?;
        Ok(())
    }

    pub fn import_json(path: impl AsRef<Path>) -> Result<Self, SaveError> {
        Self::from_json(&fs::read_to_string(path)?)
    }
}

fn backup_path(path: &Path) -> PathBuf {
    path.with_extension("sbck")
}

fn with_extension_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut s = path.as_os_str().to_owned();
    s.push(".");
    s.push(suffix);
    PathBuf::from(s)
}
