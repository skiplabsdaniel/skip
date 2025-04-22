use std::fmt;

#[derive(Debug, Clone)]
pub struct SkipError {
    pub msg: String,
}

impl fmt::Display for SkipError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", &self.msg)
    }
}
