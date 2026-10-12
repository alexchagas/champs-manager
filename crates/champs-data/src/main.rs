use std::path::PathBuf;
use std::process::ExitCode;

use champs_data::javaser::{parse_stream, Value};

fn dump(v: &Value, depth: usize, max: usize) {
    let pad = "  ".repeat(depth);
    match v {
        Value::Object(o) => {
            println!("{pad}{} {{", o.class);
            for (n, f) in &o.fields {
                print!("{pad}  {n}: ");
                match f {
                    Value::Object(_) | Value::Array(_) => {
                        println!();
                        dump(f, depth + 2, max)
                    }
                    other => println!("{other:?}"),
                }
            }
            for (i, a) in o.annotations.iter().enumerate() {
                if i >= max {
                    println!("{pad}  ... ({} annotations)", o.annotations.len());
                    break;
                }
                dump(a, depth + 1, max);
            }
            println!("{pad}}}");
        }
        Value::Array(a) => {
            println!("{pad}[");
            for x in a.iter().take(max) {
                dump(x, depth + 1, max);
            }
            println!("{pad}]");
        }
        other => println!("{pad}{other:?}"),
    }
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("import") => {
            let root = PathBuf::from(args.get(1).map(String::as_str).unwrap_or("."));
            let out = PathBuf::from(args.get(2).map(String::as_str).unwrap_or("data/teams.json"));
            (|| -> Result<(), champs_data::DataError> {
                let db = champs_data::import_database(&root)?;
                if let Some(p) = out.parent() {
                    std::fs::create_dir_all(p).map_err(|e| champs_data::DataError::io(p, e))?;
                }
                champs_data::save_json(&db, &out)?;
                println!(
                    "imported {} clubs, {} players -> {}",
                    db.clubs.len(),
                    db.player_count(),
                    out.display()
                );
                Ok(())
            })()
        }
        Some("dump") if args.len() >= 2 => (|| {
            let data =
                std::fs::read(&args[1]).map_err(|e| champs_data::DataError::io(&args[1], e))?;
            for v in parse_stream(&data)? {
                dump(&v, 0, 8);
            }
            Ok(())
        })(),
        _ => {
            eprintln!("usage: champs-data import [root_dir] [out.json]\n       champs-data dump <file.ban|cfg|ces>");
            return ExitCode::from(2);
        }
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}
