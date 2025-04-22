use std::env::{self, VarError};
use std::process;

pub struct Info {
    pub librarie: String,
    pub search: Option<String>,
}

fn get_info() -> Result<Info, VarError> {
    println!("cargo:rerun-if-env-changed=SKIP_SERVICE");
    println!("cargo:rerun-if-env-changed=SKIP_SEARCH_PATH");
    let librarie = env::var("SKIP_SERVICE")?;
    let search: Option<String> = env::var("SKIP_SEARCH_PATH").ok();
    return Ok(Info { librarie, search });
}

fn main() {
    match get_info() {
        Ok(info) => {
            println!("cargo:rustc-link-arg=-Wl,-rpath,$ORIGIN");
            println!("cargo:rustc-link-lib=dylib={}", info.librarie);
            match info.search {
                Some(search) => {
                    eprintln!("Search path: {}", search);
                    println!("cargo:rustc-link-search=native={}", search)
                }
                None => (),
            }
        }
        Err(e) => {
            match e {
                std::env::VarError::NotPresent => {
                    eprintln!("Unable to read SKIP_SERVICE environment variable: {}", e)
                }
                std::env::VarError::NotUnicode(_) => {
                    eprintln!("The SKIP_SERVICE environment variable value is invalid")
                }
            };
            process::exit(2);
        }
    }
}
