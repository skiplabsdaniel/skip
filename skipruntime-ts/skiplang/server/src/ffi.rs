#![allow(dead_code)]
use actix_web_lab::sse::SendError;
use log;
use std::ffi::{CString, c_char};
use std::{thread, time};

use crate::error;

struct Update {
    values: String,
    watermark: String,
    is_initial: bool,
}

pub trait Notifier {
    fn update(&self, values: String, watermark: String, is_initial: bool) -> Result<(), SendError>;
    fn close(&self) -> ();
}

pub struct Subscriber<T: Notifier> {
    notifier: Option<T>,
    closed: bool,
    updates: Vec<Update>,
}

impl<T: Notifier> Subscriber<T> {
    pub fn new() -> Self {
        Subscriber::<T> {
            notifier: None,
            closed: false,
            updates: Vec::new(),
        }
    }

    pub fn init(&mut self, notifier: T) -> () {
        if self.closed {
            notifier.close()
        } else {
            for update in &self.updates {
                match notifier.update(
                    update.values.clone(),
                    update.watermark.clone(),
                    update.is_initial,
                ) {
                    Err(e) => log::error!("{}", e),
                    Ok(()) => (),
                }
            }
            self.notifier = Some(notifier);
        }
    }

    pub fn update(
        &mut self,
        values: String,
        watermark: String,
        is_initial: bool,
    ) -> Result<(), SendError> {
        match &self.notifier {
            Some(n) => n.update(values, watermark, is_initial),
            None => {
                self.updates.push(Update {
                    values: values,
                    watermark: watermark,
                    is_initial: is_initial,
                });
                Ok(())
            }
        }
    }

    pub fn close(&mut self) -> () {
        match &self.notifier {
            Some(n) => n.close(),
            None => self.closed = true,
        }
    }
}

unsafe extern "C" {
    fn SkipRuntime_instantiateResource(
        identifier: *const c_char,
        resource: *const c_char,
        parameters: *const c_char,
    ) -> *mut c_char;
    fn SkipRuntime_closeResourceInstance(identifier: *const c_char) -> *mut c_char;
    fn SkipRuntime_subscribe(identifier: *const c_char) -> *mut c_char;
    fn SkipRuntime_unsubscribe(identifier: *const c_char) -> *mut c_char;
    fn SkipRuntime_getAll(
        resource: *const c_char,
        parameters: *const c_char,
        request: *const c_char,
    ) -> *mut c_char;
    fn SkipRuntime_getArray(
        resource: *const c_char,
        key_parameters: *const c_char,
        request: *const c_char,
    ) -> *mut c_char;
    fn SkipRuntime_update(input: *const c_char, data: *const c_char) -> *mut c_char;
}

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
        // Supposed to free the result mut char *
        let c_str = CString::from_raw(result);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(());
        } else {
            return Err(error::SkipError { msg: owned });
        }
    };
}

pub fn close_resource_instance(identifier: String) -> Result<(), error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        let result = SkipRuntime_closeResourceInstance(c_identifier.as_ptr());
        // Supposed to free the result mut char *
        let c_str = CString::from_raw(result);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(());
        } else {
            return Err(error::SkipError { msg: owned });
        }
    };
}

pub fn subscribe<T: Notifier>(identifier: String) -> Result<Subscriber<T>, error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        let result = SkipRuntime_unsubscribe(c_identifier.as_ptr());
        // Supposed to free the result mut char *
        let c_str = CString::from_raw(result);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(Subscriber::new());
        } else {
            return Err(error::SkipError { msg: owned });
        }
    }
}

pub fn unsubscribe(identifier: String) -> Result<(), error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        let result = SkipRuntime_subscribe(c_identifier.as_ptr());
        // Supposed to free the result mut char *
        let c_str = CString::from_raw(result);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(());
        } else {
            return Err(error::SkipError { msg: owned });
        }
    }
}

pub fn resource_snapshot_<F>(
    resource: String,
    data: String,
    f: F,
) -> Result<String, error::SkipError>
where
    F: Fn(*const c_char, *const c_char, *const c_char) -> *mut c_char,
{
    let ten_millis = time::Duration::from_millis(10);
    let mut request: Option<String> = None;
    unsafe {
        let c_resource = CString::new(resource).expect("CString::new failed");
        let c_data = CString::new(data).expect("CString::new failed");
        loop {
            let c_request = match request {
                Some(v) => Some(CString::new(v).expect("CString::new failed")),
                _ => None,
            };
            let c_request_ptr = match c_request {
                Some(v) => v.as_ptr(),
                _ => 0x0 as *const u8,
            };
            let result = f(c_resource.as_ptr(), c_data.as_ptr(), c_request_ptr);
            // Supposed to free the result mut char *
            let c_str = CString::from_raw(result);
            let rust_str = c_str.to_str().expect("Bad encoding");
            let owned = rust_str.to_owned();
            if owned.is_empty() {
                return Err(error::SkipError {
                    msg: "resource_snapshot_lookup: Unknown result.".to_string(),
                });
            } else if owned.starts_with("OK:") {
                return Ok(owned[3..].to_string());
            } else if owned.starts_with("ID:") {
                request = Some(owned[3..].to_string());
                thread::sleep(ten_millis);
            } else {
                return Err(error::SkipError { msg: owned });
            }
        }
    };
}

pub fn resource_snapshot(resource: String, parameters: String) -> Result<String, error::SkipError> {
    resource_snapshot_(resource, parameters, |p1, p2, p3| unsafe {
        SkipRuntime_getAll(p1, p2, p3)
    })
}

pub fn resource_snapshot_lookup(
    resource: String,
    key_parameters: String,
) -> Result<String, error::SkipError> {
    resource_snapshot_(resource, key_parameters, |p1, p2, p3| unsafe {
        SkipRuntime_getArray(p1, p2, p3)
    })
}

pub fn input(input: String, data: String) -> Result<(), error::SkipError> {
    unsafe {
        let c_input = CString::new(input).expect("CString::new failed");
        let c_data = CString::new(data).expect("CString::new failed");
        let result = SkipRuntime_update(c_input.as_ptr(), c_data.as_ptr());
        // Supposed to free the result mut char *
        let c_str = CString::from_raw(result);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(());
        } else {
            return Err(error::SkipError { msg: owned });
        }
    }
}
