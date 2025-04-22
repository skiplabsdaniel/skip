use crate::clients;
use libc::free;
use log::{self};
use std::ffi::{CStr, CString, c_char, c_void};
use uuid::Uuid;

#[repr(C)]
pub struct Notification {
    values: *mut c_char,
    watermark: *mut c_char,
    is_initial: u8,
}

#[repr(C)]
pub struct SubscribeResult {
    id: i64,
    error: *mut c_char,
}

#[repr(C)]
pub struct SnapshotResult {
    is_ok: u8,
    value: *mut c_char,
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
pub extern "C" fn Skip_info(skmessage: *const c_char) -> () {
    let values = copy_c_string(skmessage);
    log::info!("{}", values)
}

use crate::error;

unsafe extern "C" {
    fn Skip_instantiate_resource(
        identifier: *const c_char,
        resource: *const c_char,
        parameters: *const c_char,
    ) -> *mut c_char;
    fn Skip_close_resource_instance(identifier: *const c_char) -> *mut c_char;
    fn Skip_subscribe(identifier: *const c_char, watermark: *const c_char) -> SubscribeResult;
    fn Skip_unsubscribe(identifier: i64) -> *mut c_char;
    fn Skip_resource_snapshot(resource: *const c_char, parameters: *const c_char)
    -> SnapshotResult;
    fn Skip_resource_snapshot_lookup(
        resource: *const c_char,
        parameters: *const c_char,
        key: *const c_char,
    ) -> SnapshotResult;
    fn Skip_update(input: *const c_char, data: *const c_char) -> *mut c_char;
    fn Skip_init_service() -> *mut c_char;
    fn Skip_next_notification(identifier: i64) -> Notification;
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

fn check_result(e: *mut c_char) -> Result<(), error::SkipError> {
    if !e.is_null() {
        let error = copy_c_string_and_free(e);
        if !error.is_empty() {
            return Err(error::SkipError { msg: error });
        }
    }
    Ok(())
}

pub fn init_service() -> Result<(), error::SkipError> {
    unsafe { check_result(Skip_init_service()) }
}

pub fn next_nofication(identifier: i64) -> Option<clients::Notification> {
    unsafe {
        let notif = Skip_next_notification(identifier);
        if notif.values.is_null() {
            return None;
        };
        let values = copy_c_string_and_free(notif.values);
        let watermark = copy_c_string_and_free(notif.watermark);
        let is_initial = notif.is_initial != 0;
        return Some(clients::Notification {
            values,
            watermark,
            is_initial,
        });
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
        check_result(Skip_instantiate_resource(
            c_identifier.as_ptr(),
            c_resource.as_ptr(),
            c_parameters.as_ptr(),
        ))
    }
}

pub fn close_resource_instance(identifier: String) -> Result<(), error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        check_result(Skip_close_resource_instance(c_identifier.as_ptr()))
    }
}

pub fn subscribe(identifier: String, watermark: Option<String>) -> Result<i64, error::SkipError> {
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
        let result = Skip_subscribe(c_identifier.as_ptr(), c_watermark_ptr);
        match check_result(result.error) {
            Ok(()) => Ok(result.id),
            Err(err) => Err(err),
        }
    }
}

pub fn unsubscribe(identifier: i64) -> Result<(), error::SkipError> {
    unsafe { check_result(Skip_unsubscribe(identifier)) }
}

fn resource_snapshot_<F>(
    resource: String,
    parameters: String,
    f: F,
) -> Result<String, error::SkipError>
where
    F: Fn(*const c_char, *const c_char) -> SnapshotResult + Send + Sync + 'static,
{
    let uuid = Uuid::new_v4().to_string();
    match instantiate_resource(uuid.clone(), resource.clone(), parameters.clone()) {
        Err(err) => return Err(err),
        _ => (),
    };
    let c_resource = CString::new(resource).expect("CString::new failed");
    let c_parameters = CString::new(parameters).expect("CString::new failed");
    let result = f(c_resource.as_ptr(), c_parameters.as_ptr());
    let value_or_error = copy_c_string_and_free(result.value);
    let res = if result.is_ok != 0 {
        Ok(value_or_error)
    } else {
        Err(error::SkipError {
            msg: value_or_error,
        })
    };
    _ = close_resource_instance(uuid);
    res
}

pub fn resource_snapshot(resource: String, parameters: String) -> Result<String, error::SkipError> {
    resource_snapshot_(resource, parameters, |p1, p2| unsafe {
        Skip_resource_snapshot(p1, p2)
    })
}

pub fn resource_snapshot_lookup(
    resource: String,
    parameters: String,
    key: String,
) -> Result<String, error::SkipError> {
    resource_snapshot_(resource, parameters, move |p1, p2| unsafe {
        let c_key = CString::new(key.clone()).expect("CString::new failed");
        Skip_resource_snapshot_lookup(p1, p2, c_key.as_ptr())
    })
}

pub fn update(input: String, data: String) -> Result<(), error::SkipError> {
    unsafe {
        let c_input = CString::new(input).expect("CString::new failed");
        let c_data = CString::new(data).expect("CString::new failed");
        check_result(Skip_update(c_input.as_ptr(), c_data.as_ptr()))
    }
}
