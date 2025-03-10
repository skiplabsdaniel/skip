#![allow(dead_code)]
use crate::clients::SseNotifier;
use actix_web_lab::sse::SendError;
use lazy_static::lazy_static;
use libc::free;
use log;
use std::collections::HashMap;
use std::ffi::{CStr, CString, c_char, c_int, c_void};
use std::sync::Mutex;
use std::{thread, time};

lazy_static! {
    static ref CALLBACKS: Mutex<HashMap<u32, Box<dyn MutNotifier + Send + Sync>>> =
        Mutex::new(HashMap::new());
    static ref COUNTER: Mutex<u32> = Mutex::new(0);
}

pub fn register_notifier(notifier: Box<dyn MutNotifier + Send + Sync>) -> u32 {
    let mut counter = COUNTER.lock().unwrap();
    let mut callbacks = CALLBACKS.lock().unwrap();

    *counter += 1;
    let id = *counter;

    callbacks.insert(id, notifier);
    id
}

#[unsafe(no_mangle)]
pub extern "C" fn free_string(s: *mut c_char) {
    if s.is_null() {
        return;
    }
    unsafe {
        drop(CString::from_raw(s));
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn Skip_unregister_notifier(id: u32) {
    let mut callbacks = CALLBACKS.lock().unwrap();
    callbacks.remove(&id);
}

#[unsafe(no_mangle)]
pub extern "C" fn Skip_notifier__notify(
    id: u32,
    skvalues: *const c_char,
    skwatermark: *const c_char,
    is_initial: c_int,
) -> *mut c_char {
    let values = copy_c_string(skvalues);
    let watermark = copy_c_string(skwatermark);
    let mut callbacks = CALLBACKS.lock().unwrap();
    let result = if let Some(callback) = callbacks.get_mut(&id) {
        match callback.update(values, watermark, is_initial != 0) {
            Ok(()) => "".to_string(),
            Err(e) => e.to_string(),
        }
    } else {
        "Invalid callback '{}'".to_string()
    };
    let s = CString::new(result).unwrap();
    s.into_raw()
}

#[unsafe(no_mangle)]
pub extern "C" fn Skip_notifier__close(id: u32) -> *mut c_char {
    let mut callbacks = CALLBACKS.lock().unwrap();
    let result = if let Some(callback) = callbacks.get_mut(&id) {
        callback.close();
        "".to_string()
    } else {
        "Invalid callback '{}'".to_string()
    };
    let s = CString::new(result).unwrap();
    s.into_raw()
}

fn init_notifier(id: u32, notifier: SseNotifier) -> () {
    let mut callbacks = CALLBACKS.lock().unwrap();
    if let Some(callback) = callbacks.get_mut(&id) {
        callback.init(notifier)
    }
}

use crate::error;

struct Update {
    values: String,
    watermark: String,
    is_initial: bool,
}

pub trait MutNotifier {
    fn init(&mut self, notifier: SseNotifier) -> ();
    fn update(
        &mut self,
        values: String,
        watermark: String,
        is_initial: bool,
    ) -> Result<(), SendError>;
    fn close(&mut self) -> ();
}

pub trait Notifier {
    fn update(&self, values: String, watermark: String, is_initial: bool) -> Result<(), SendError>;
    fn close(&self) -> ();
}

pub struct Subscriber {
    notifier: Option<SseNotifier>,
    closed: bool,
    updates: Vec<Update>,
}

impl Subscriber {
    pub fn new() -> Self {
        Subscriber {
            notifier: None,
            closed: false,
            updates: Vec::new(),
        }
    }
}

impl MutNotifier for Subscriber {
    fn init(&mut self, notifier: SseNotifier) -> () {
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

    fn update(
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

    fn close(&mut self) -> () {
        match &self.notifier {
            Some(n) => n.close(),
            None => self.closed = true,
        }
    }
}

unsafe extern "C" {
    fn Skip_instantiate_resource(
        identifier: *const c_char,
        resource: *const c_char,
        parameters: *const c_char,
    ) -> *mut c_char;
    fn Skip_close_resource_instance(identifier: *const c_char) -> *mut c_char;
    fn Skip_subscribe(
        identifier: *const c_char,
        notifier: u32,
        watermark: *const c_char,
    ) -> *mut c_char;
    fn Skip_unsubscribe(identifier: *const c_char) -> *mut c_char;
    fn Skip_get_all(
        resource: *const c_char,
        parameters: *const c_char,
        request: *const c_char,
    ) -> *mut c_char;
    fn Skip_get_array(
        resource: *const c_char,
        key_parameters: *const c_char,
        request: *const c_char,
    ) -> *mut c_char;
    fn Skip_set_input(input: *const c_char, data: *const c_char) -> *mut c_char;
}

fn copy_c_string(s: *const c_char) -> String {
    unsafe {
        let c_str = CStr::from_ptr(s);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        owned
    }
}

fn copy_c_string_and_free(s: *mut c_char) -> String {
    unsafe {
        let c_str = CStr::from_ptr(s);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        free(s as *mut c_void);
        owned
    }
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
        let result = Skip_instantiate_resource(
            c_identifier.as_ptr(),
            c_resource.as_ptr(),
            c_parameters.as_ptr(),
        );
        let owned = copy_c_string_and_free(result);
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
        let result = Skip_close_resource_instance(c_identifier.as_ptr());
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

pub fn subscribe(
    identifier: String,
    watermark: Option<String>,
) -> Result<Box<dyn Fn(SseNotifier) + Send + Sync>, error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        let c_watermark = match watermark {
            Some(v) => Some(CString::new(v).expect("CString::new failed")),
            _ => None,
        };
        let c_watermark_ptr = match c_watermark {
            Some(v) => v.as_ptr(),
            _ => 0x0 as *const u8,
        };
        let handle = register_notifier(Box::new(Subscriber::new()));
        let result = Skip_subscribe(c_identifier.as_ptr(), handle, c_watermark_ptr);
        // Supposed to free the result mut char *
        let c_str = CString::from_raw(result);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(Box::new(move |n| {
                init_notifier(handle, n);
            }));
        } else {
            return Err(error::SkipError { msg: owned });
        }
    }
}

pub fn unsubscribe(identifier: String) -> Result<(), error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        let result = Skip_unsubscribe(c_identifier.as_ptr());
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
        Skip_get_all(p1, p2, p3)
    })
}

pub fn resource_snapshot_lookup(
    resource: String,
    key_parameters: String,
) -> Result<String, error::SkipError> {
    resource_snapshot_(resource, key_parameters, |p1, p2, p3| unsafe {
        Skip_get_array(p1, p2, p3)
    })
}

pub fn set_input(input: String, data: String) -> Result<(), error::SkipError> {
    unsafe {
        let c_input = CString::new(input).expect("CString::new failed");
        let c_data = CString::new(data).expect("CString::new failed");
        let result = Skip_set_input(c_input.as_ptr(), c_data.as_ptr());
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
