use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum DataError {
    #[error("java serialization error at byte {offset}: {message}")]
    Serialization { offset: usize, message: String },
    #[error("unexpected structure in {file}: {message}")]
    Structure { file: String, message: String },
    #[error("i/o error on {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

impl DataError {
    pub fn io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        DataError::Io {
            path: path.into(),
            source,
        }
    }
}
