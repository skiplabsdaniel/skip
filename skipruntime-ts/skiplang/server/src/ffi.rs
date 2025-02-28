use std::ffi::{CString, c_char};

#[path = "./error.rs"]
mod error;

unsafe extern "C" {
    fn SkipRuntime_instantiateResource(
        identifier: *const c_char,
        resource: *const c_char,
        parameters: *const c_char,
    ) -> *const c_char;
    fn SkipRuntime_closeResourceInstance(identifier: *const c_char) -> *const c_char;
}

#[allow(dead_code)]
pub fn instantiate_resource(
    identifier: String,
    resource: String,
    parameters: String,
) -> Result<(), error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        let c_resource = CString::new(resource).expect("CString::new failed");
        let c_parameters = CString::new(parameters).expect("CString::new failed");
        let result = SkipRuntime_instantiateResource(
            c_identifier.as_ptr(),
            c_resource.as_ptr(),
            c_parameters.as_ptr(),
        );
        // Free the result const char *
        let c_str = CString::from_raw(result.cast_mut());
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(());
        } else {
            return Err(error::SkipError { msg: owned });
        }
    };
}

#[allow(dead_code)]
pub fn close_resource_instance(identifier: String) -> Result<(), error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        let result = SkipRuntime_closeResourceInstance(c_identifier.as_ptr());
        // Free the result const char *
        let c_str = CString::from_raw(result.cast_mut());
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(());
        } else {
            return Err(error::SkipError { msg: owned });
        }
    };
}
