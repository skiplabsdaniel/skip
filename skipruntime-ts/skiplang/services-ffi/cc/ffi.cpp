/**
 * @file ffi.cpp
 * @brief C-compatible interface for interacting with the Skip runtime.
 * This file provides the necessary functions to instantiate resources,
 * subscribe to events, and manage executors within the Skip runtime.
 */

#include <stdbool.h>
#include <stdint.h>

#include "executor.h"
#include "handles.h"
#include "notification_queue.h"
#include "stdio.h"
#include "string.h"
#include "worker.h"

static skip::Worker worker;

static skip::ExecutorHandles executors;
static skip::NotificationHandles notifications;

extern "C" {

/**
 * @brief A structure used to represent the result of an operation.
 * @param is_ok A flag indicating whether the operation was successful (1) or
 * failed (0).
 * @param value A message or value returned by the operation, typically used for
 * error messages.
 */
typedef struct {
  uint8_t is_ok;      ///< 1 = Ok, 0 = Err
  const char* value;  ///< Error message or value if Ok
} result_t;

/**
 * @brief A structure representing the result of a subscription operation.
 * @param id The subscription ID; 0 indicates an error, a positive value
 * indicates success.
 * @param error A message indicating the error, if any.
 */
typedef struct {
  int64_t id;         ///< 0 = Err, > 0 = Ok
  const char* error;  ///< Error message if any
} subscribe_t;

typedef struct {
  const char* values;
  const char* watermark;
  bool is_initial;
} notification_t;

/**
 * @brief Frees a dynamically allocated string.
 * @param str The string to be freed.
 */
void free_string(char* str);

/**
 * @brief Creates a new obstack.
 * @return A pointer to the created obstack.
 */
const void* SKIP_new_Obstack();

/**
 * @brief Destroys an obstack created by SKIP_new_Obstack.
 * @param obstack The obstack to be destroyed.
 */
void SKIP_destroy_Obstack(const void* obstack);

/**
 * @brief Checks if a string is safe to use in C.
 * @param str The string to check.
 */
void sk_string_check_c_safe(const char* str);

/**
 * @brief Creates a new string from the provided buffer.
 * @param buffer The string buffer.
 * @param size The size of the buffer.
 * @return A dynamically allocated string.
 */
char* sk_string_create(const char* buffer, uint32_t size);

/**
 * @brief Creates a new Skip executor from a C-level handle.
 *
 * @param handle The executor handle.
 * @return A pointer to the new Skip executor.
 */
const void* SkipRuntime_createExecutor(uint32_t handle);

/**
 * @brief Initializes the Skip service using the provided executor.
 *
 * @param service Pointer to the service object.
 * @param executor The executor to be used for initialization.
 * @return A string containing the error message if any, otherwise NULL.
 */
const char* SkipRuntime_initService(const void* service, const void* executor);

/**
 * @brief Instantiates a resource with given identifier, type and parameters.
 *
 * @param identifier The unique resource identifier.
 * @param resource The type of resource.
 * @param parameters The initialization parameters.
 * @param executor The executor context.
 * @return An error string if any, otherwise NULL.
 */
char* SkipRuntime_instantiateResource(const char* identifier,
                                      const char* resource,
                                      const char* parameters,
                                      const void* executor);

/**
 * @brief Closes a resource instance identified by its ID.
 *
 * @param identifier The unique identifier of the resource instance.
 * @return An error string if any, otherwise NULL.
 */
char* SkipRuntime_closeResourceInstance(const char* identifier);

/**
 * @brief Subscribes to a resource.
 *
 * @param identifier Resource identifier.
 * @param notifier Callback notifier handle.
 * @param watermark Optional watermark for event filtering.
 * @return A structure containing subscription ID and error string if any.
 */
subscribe_t SkipRuntime_subscribe(const char* identifier, const void* notifier,
                                  const char* watermark, uint32_t session);

/**
 * @brief Unsubscribes a subscription by its ID.
 *
 * @param id The subscription ID.
 * @return An error string if any, otherwise NULL.
 */
char* SkipRuntime_unsubscribe(int64_t id);

/**
 * @brief Fetches the current snapshot of a resource.
 *
 * @param resource Resource type.
 * @param parameters Parameters for the snapshot.
 * @return A result structure containing success flag and snapshot string.
 */
result_t SkipRuntime_resourceSnapshot(const char* resource,
                                      const char* parameters);

/**
 * @brief Fetches a specific value from a resource snapshot by key.
 *
 * @param resource Resource type.
 * @param parameters Snapshot parameters.
 * @param key The key to look up in the snapshot.
 * @return A result structure with lookup result and success flag.
 */
result_t SkipRuntime_resourceSnapshotLookup(const char* resource,
                                            const char* parameters,
                                            const char* key);

/**
 * @brief Performs an update operation on a resource.
 *
 * @param input Resource identifier.
 * @param data New data to be applied.
 * @param executor Executor context.
 * @return An error string if any, otherwise NULL.
 */
char* SkipRuntime_update(const char* input, const char* data,
                         const void* executor);

/**
 * @brief Notifies the runtime from a notifier with event values.
 *
 * @param id Notifier ID.
 * @param values JSON-encoded event data.
 * @param watermark Optional watermark value.
 * @param updates Whether the notification contains updates.
 */
void SkipRuntime_Notifier__notify(uint32_t id, const char* values,
                                  const char* watermark, bool updates);

/**
 * @brief Closes a notifier with a given ID.
 *
 * @param id The notifier ID.
 */
void SkipRuntime_Notifier__close(uint32_t id);

/**
 * @brief Deletes a notifier object from the runtime.
 *
 * @param id Notifier ID.
 */
void SkipRuntime_deleteNotifier(uint32_t id);

/**
 * @brief Throws a runtime error if the provided message is not NULL.
 *
 * @param msg The message to be checked and possibly thrown as an exception.
 */
void SkipRuntime_checkNotifierException(const char* msg);

/**
 * @brief Creates a notifier object from a C-level handle.
 *
 * @param handle The notifier handle.
 * @return A pointer to the Skip runtime notifier.
 */
const void* SkipRuntime_createNotifier(uint32_t handle);

/**
 * @brief Returns a pointer to the global Skip service instance.
 *
 * @return A pointer to the service.
 */
const void* Skip_service();

/**
 * @brief Processes a result string and returns a heap-allocated safe C string.
 *
 * Frees the given Skip obstack after use.
 *
 * @param skresult The result string returned from a Skip runtime operation.
 * @param obstack A pointer to the obstack used by Skip.
 * @return A newly allocated C string, or NULL if skresult was NULL.
 */
char* check_error_result(const char* skresult, const void* obstack) {
  char* result = NULL;
  if (skresult != NULL) {
    sk_string_check_c_safe(skresult);
    result = strdup(skresult);
  }
  SKIP_destroy_Obstack(obstack);
  return result;
}

/**
 * @brief Initializes a service in the Skip runtime.
 * @return A string indicating the success or failure of the operation.
 */
char* Skip_init_service() {
  skip::Executor skipExecutor;
  auto executor = executors.createHandle(&skipExecutor);
  auto future = worker.enqueue([executor]() {
    const void* obstack = SKIP_new_Obstack();
    const void* skexecutor = SkipRuntime_createExecutor(executor);
    const char* skresult = SkipRuntime_initService(Skip_service(), skexecutor);
    return check_error_result(skresult, obstack);
  });
  auto error = future.get();
  if (error != nullptr) {
    skipExecutor.resolve();
    return error;
  }
  auto reason = skipExecutor.getResult().reason;
  return reason;
}

/**
 * @brief Instantiates a resource in the Skip runtime.
 * @param identifier The identifier of the resource.
 * @param resource The resource name.
 * @param parameters Parameters for the resource.
 * @param executor The executor to use for the operation.
 * @return A string indicating the success or failure of the operation.
 */
char* Skip_instantiate_resource(const char* identifier, const char* resource,
                                const char* parameters) {
  skip::Executor skipExecutor;
  auto executor = executors.createHandle(&skipExecutor);
  auto future = worker.enqueue([identifier, resource, parameters, executor]() {
    const void* obstack = SKIP_new_Obstack();
    const char* skidentifier = sk_string_create(identifier, strlen(identifier));
    const char* skresource = sk_string_create(resource, strlen(resource));
    const char* skparameters = sk_string_create(parameters, strlen(parameters));
    const void* skexecutor = SkipRuntime_createExecutor(executor);
    const char* skresult = SkipRuntime_instantiateResource(
        skidentifier, skresource, skparameters, skexecutor);
    return check_error_result(skresult, obstack);
  });
  auto error = future.get();
  if (error != nullptr) {
    skipExecutor.resolve();
    return error;
  }
  return skipExecutor.getResult().reason;
}

/**
 * @brief Closes a resource instance in the Skip runtime.
 * @param identifier The identifier of the resource.
 * @return A string indicating the success or failure of the operation.
 */
char* Skip_close_resource_instance(const char* identifier) {
  auto future = worker.enqueue([identifier]() {
    const void* obstack = SKIP_new_Obstack();
    const char* skidentifier = sk_string_create(identifier, strlen(identifier));
    const char* skresult = SkipRuntime_closeResourceInstance(skidentifier);
    return check_error_result(skresult, obstack);
  });
  return future.get();
};

uint64_t SKIP_genSym(uint64_t largerThan);

/**
 * @brief Subscribes to a resource in the Skip runtime.
 * @param identifier The identifier of the resource.
 * @param notifier The notifier ID.
 * @param watermark An optional watermark value.
 * @return A structure containing the subscription ID and error message (if
 * any).
 */
subscribe_t Skip_subscribe(const char* identifier, const char* watermark) {
  auto skipNotification = new skip::NotificationQueue();
  auto notifier = notifications.createHandle(skipNotification);

  auto future = worker.enqueue([identifier, notifier, watermark]() {
    const void* obstack = SKIP_new_Obstack();
    const char* skidentifier = sk_string_create(identifier, strlen(identifier));
    const void* sknotifier = SkipRuntime_createNotifier(notifier);
    const char* skwatermark =
        watermark ? sk_string_create(watermark, strlen(watermark)) : NULL;
    subscribe_t skresult =
        SkipRuntime_subscribe(skidentifier, sknotifier, skwatermark, notifier);
    char* error = check_error_result(skresult.error, obstack);
    subscribe_t res = {skresult.id, error};
    return res;
  });
  return future.get();
}

/**
 * @brief Unsubscribes from a resource in the Skip runtime.
 * @param id The subscription ID to unsubscribe from.
 * @return A string indicating the success or failure of the operation.
 */
char* Skip_unsubscribe(uint64_t id) {
  auto future = worker.enqueue([id]() {
    const void* obstack = SKIP_new_Obstack();
    const char* skresult = SkipRuntime_unsubscribe(id);
    return check_error_result(skresult, obstack);
  });
  return future.get();
}

/**
 * @brief Takes a snapshot of a resource in the Skip runtime.
 * @param resource The resource name.
 * @param parameters Parameters for the resource.
 * @return A structure indicating the result of the snapshot operation.
 */
result_t Skip_resource_snapshot(const char* resource, const char* parameters) {
  auto future = worker.enqueue([resource, parameters]() {
    const void* obstack = SKIP_new_Obstack();
    const char* skresource = sk_string_create(resource, strlen(resource));
    const char* skparameters = sk_string_create(parameters, strlen(parameters));
    result_t skresult = SkipRuntime_resourceSnapshot(skresource, skparameters);
    sk_string_check_c_safe(skresult.value);
    char* result = strdup(skresult.value);
    SKIP_destroy_Obstack(obstack);
    result_t res = {skresult.is_ok, result};
    return res;
  });
  return future.get();
}

/**
 * @brief Looks up a snapshot of a resource in the Skip runtime.
 * @param resource The resource name.
 * @param params Parameters for the resource.
 * @param key The key for the snapshot lookup.
 * @return A structure indicating the result of the snapshot lookup.
 */
result_t Skip_resource_snapshot_lookup(const char* resource, const char* params,
                                       const char* key) {
  auto future = worker.enqueue([resource, params, key]() {
    const void* obstack = SKIP_new_Obstack();
    const char* skresource = sk_string_create(resource, strlen(resource));
    const char* skparams = sk_string_create(params, strlen(params));
    const char* skkey = sk_string_create(key, strlen(key));
    result_t skresult =
        SkipRuntime_resourceSnapshotLookup(skresource, skparams, skkey);
    sk_string_check_c_safe(skresult.value);
    char* result = strdup(skresult.value);
    SKIP_destroy_Obstack(obstack);
    result_t res = {skresult.is_ok, result};
    return res;
  });
  return future.get();
}

/**
 * @brief Updates a resource in the Skip runtime.
 * @param input The input data for the update.
 * @param data The update data.
 * @return A string indicating the success or failure of the update operation.
 */
char* Skip_update(const char* input, const char* data) {
  skip::Executor skipExecutor;
  auto executor = executors.createHandle(&skipExecutor);
  auto future = worker.enqueue([input, data, executor]() {
    const void* obstack = SKIP_new_Obstack();
    const char* skinput = sk_string_create(input, strlen(input));
    const char* skdata = sk_string_create(data, strlen(data));
    const void* skexecutor = SkipRuntime_createExecutor(executor);
    const char* skresult = SkipRuntime_update(skinput, skdata, skexecutor);
    return check_error_result(skresult, obstack);
  });
  auto error = future.get();
  if (error != nullptr) {
    skipExecutor.resolve();
    return error;
  }
  return skipExecutor.getResult().reason;
}

notification_t Skip_next_notification(int64_t id) {
  auto maybeNofifier = notifications.getHandle(id);
  if (maybeNofifier) {
    auto notif = maybeNofifier->pop();
    if (notif.valeurs.empty() && notif.watermark.empty())
      return {nullptr, nullptr, false};
    return {strdup(notif.valeurs.c_str()), strdup(notif.watermark.c_str()),
            notif.is_initial};
  }
  return {nullptr, nullptr, false};
}

/**
 * @brief Notifies the Skip runtime using a notifier.
 * @param id The notifier ID.
 * @param values The values to notify.
 * @param watermark The optional watermark value.
 * @param updates A flag indicating whether the notification is an update.
 */
void SkipRuntime_Notifier__notify(uint32_t id, const char* skvalues,
                                  const char* skwatermark, bool updates) {
  auto maybeNofifier = notifications.getHandle(id);
  if (maybeNofifier) {
    std::string values(skvalues);
    std::string watermark(skwatermark);
    skip::Notification notif = {values, watermark, !updates};
    maybeNofifier->push(notif);
  }
}

/**
 * @brief Closes a notifier in the Skip runtime.
 * @param id The notifier ID.
 */
void SkipRuntime_Notifier__close(uint32_t id) {
  auto maybeNofifier = notifications.getHandle(id);
  if (maybeNofifier) {
    skip::Notification notif = {"", "", false};
    maybeNofifier->push(notif);
  }
}

/**
 * @brief Deletes a notifier from the Skip runtime.
 * @param id The notifier ID.
 */
void SkipRuntime_deleteNotifier(uint32_t id) {
  auto maybeNofifier = notifications.getHandle(id);
  if (maybeNofifier) {
    notifications.deleteHandle(id);
    // delete maybeNofifier;
  }
}

/**
 * @brief Resolves an executor in the Skip runtime.
 * @param id The executor ID to resolve.
 */
void SkipRuntime_Executor__resolve(uint32_t id) {
  auto maybeExecutor = executors.getHandle(id);
  if (maybeExecutor) {
    maybeExecutor->resolve();
  }
}

/**
 * @brief Rejects an executor in the Skip runtime.
 * @param id The executor ID to reject.
 * @param message The rejection message.
 */
void SkipRuntime_Executor__reject(uint32_t id, const char* message) {
  auto maybeExecutor = executors.getHandle(id);
  if (maybeExecutor) {
    maybeExecutor->reject(message);
  }
}

/**
 * @brief Deletes an executor from the Skip runtime.
 * @param id The executor ID to delete.
 */
void SkipRuntime_deleteExecutor(uint32_t id) {
  auto maybeExecutor = executors.getHandle(id);
  if (maybeExecutor) {
    executors.deleteHandle(id);
  }
}

}  // extern "C"
