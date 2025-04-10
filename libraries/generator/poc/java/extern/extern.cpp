#include <jni.h>
#include <stdarg.h>
#include <stdint.h>
#include <string.h>

extern "C" {

char* sk_string_create(const char* buffer, uint32_t size);
void* SKIP_create_vector();
void SKIP_push_into_vector(void*, void*);
void* SKIP_vector_to_array(void*);
jlong SKIP_get_array_size(void*);
void* SKIP_get_array_value_at(void*, jlong);
jlong* SKIP_create_long_array(jlong);
jint* SKIP_create_int_array(jlong);
jshort* SKIP_create_short_array(jlong);
jbyte* SKIP_create_byte_array(jlong);
jdouble* SKIP_create_double_array(jlong);
jboolean* SKIP_create_boolean_array(jlong);

__attribute__((noreturn)) void SKIP_throwLibraryException(char*, char*,
                                                          char* = nullptr);
void* SKIP_createJVM(JavaVM* jvm, JNIEnv* env);

static JavaVM* vm;
static JNIEnv* env;

static const char* kJVMType = "Java";
static size_t kJVMTypeSize = strlen(kJVMType);
static const char* kUnableToLoadJVM = "Unable to load Java virtual machine.";
static size_t kUnableToLoadJVMSize = strlen(kUnableToLoadJVM);
static const char* kJVMAlreadyLoaded = "Java virtual machine already loaded.";
static size_t kJVMAlreadyLoadedSize = strlen(kJVMAlreadyLoaded);
static const char* kJVMNotLoaded = "Java virtual machine not loaded.";
static size_t kJVMNotLoadedSize = strlen(kJVMNotLoaded);

typedef void* (*CheckObject)(JNIEnv*, jobject);
typedef jobject (*CreateObject)(JNIEnv*, void*);

__attribute__((noreturn)) void SKIP_throwUnableToLoadJVM() {
  SKIP_throwLibraryException(
      sk_string_create(kJVMType, kJVMTypeSize),
      sk_string_create(kUnableToLoadJVM, kUnableToLoadJVMSize));
}

__attribute__((noreturn)) void SKIP_throwJVMAlreadyLoaded() {
  SKIP_throwLibraryException(
      sk_string_create(kJVMType, kJVMTypeSize),
      sk_string_create(kJVMAlreadyLoaded, kJVMAlreadyLoadedSize));
}

__attribute__((noreturn)) void SKIP_throwJVMNotLoaded() {
  SKIP_throwLibraryException(
      sk_string_create(kJVMType, kJVMTypeSize),
      sk_string_create(kJVMNotLoaded, kJVMNotLoadedSize));
}

jstring getClassName(JNIEnv* env, jobject object, jclass clazz) {
  jmethodID getClass =
      env->GetMethodID(clazz, "getClass", "()Ljava/lang/Class;");
  jobject classObj = env->CallObjectMethod(object, getClass);
  jclass classClass = env->FindClass("java/lang/Class");
  jmethodID getName =
      env->GetMethodID(classClass, "getName", "()Ljava/lang/String;");
  return (jstring)env->CallObjectMethod(classObj, getName);
}

void clearPointers(JNIEnv* env, jobject obj) {
  jclass clazz = env->GetObjectClass(obj);
  jmethodID clear = env->GetMethodID(clazz, "skPtrClear", "()V");
  if (clear != nullptr) env->CallObjectMethod(obj, clear);
}

void collectStackTrace(JNIEnv* env, jthrowable exception, jclass throwableClass,
                       char** sktrace) {
  jmethodID printStackTrace = env->GetMethodID(
      throwableClass, "printStackTrace", "(Ljava/io/PrintWriter;)V");

  // Create Java StringWriter and PrintWriter
  jclass stringWriterClass = env->FindClass("java/io/StringWriter");
  jmethodID stringWriterInit =
      env->GetMethodID(stringWriterClass, "<init>", "()V");
  jobject stringWriter = env->NewObject(stringWriterClass, stringWriterInit);

  jclass printWriterClass = env->FindClass("java/io/PrintWriter");
  jmethodID printWriterInit =
      env->GetMethodID(printWriterClass, "<init>", "(Ljava/io/Writer;)V");
  jobject printWriter =
      env->NewObject(printWriterClass, printWriterInit, stringWriter);

  // Call printStackTrace(PrintWriter)
  env->CallVoidMethod(exception, printStackTrace, printWriter);

  // Get String result with toString()
  jmethodID toString =
      env->GetMethodID(stringWriterClass, "toString", "()Ljava/lang/String;");
  jstring stackTrace = (jstring)env->CallObjectMethod(stringWriter, toString);
  const char* trace = env->GetStringUTFChars(stackTrace, NULL);
  (*sktrace) = sk_string_create(trace, strlen(trace));
  env->ReleaseStringUTFChars(stackTrace, trace);
}

void collectException(JNIEnv* env, jthrowable exception, char** skclazzName,
                      char** skmsg, char** sktrace = nullptr) {
  jclass throwableClass = env->GetObjectClass(exception);
  jmethodID getMessage =
      env->GetMethodID(throwableClass, "getMessage", "()Ljava/lang/String;");
  jstring message = (jstring)env->CallObjectMethod(exception, getMessage);
  jstring className = getClassName(env, exception, throwableClass);
  const char* msg = env->GetStringUTFChars(message, NULL);
  const char* clazzName = env->GetStringUTFChars(className, NULL);
  (*skmsg) = sk_string_create(msg, strlen(msg));
  (*skclazzName) = sk_string_create(clazzName, strlen(clazzName));
  env->ReleaseStringUTFChars(message, msg);
  env->ReleaseStringUTFChars(className, clazzName);
  if (sktrace != nullptr) {
    collectStackTrace(env, exception, throwableClass, sktrace);
  }
}

void checkException(JNIEnv* env) {
  if (env->ExceptionCheck()) {
    char* type;
    char* message;
    jthrowable exception = env->ExceptionOccurred();
    env->ExceptionClear();
    collectException(env, exception, &type, &message);
    SKIP_throwLibraryException(type, message);
  }
}

void* getPointer(JNIEnv* env, jobject obj) {
  jclass clazz = env->GetObjectClass(obj);
  jfieldID hfid = env->GetFieldID(clazz, "skPtr", "J");
  checkException(env);
  jlong handle = env->GetLongField(obj, hfid);
  return (void*)handle;
}

void callStaticSetPointer(JNIEnv* env, jclass clazz, const char* staticMethod,
                          jlong value) {
  jmethodID methodID = env->GetStaticMethodID(clazz, staticMethod, "(J)V");
  checkException(env);
  env->CallStaticVoidMethod(clazz, methodID, value);
  checkException(env);
}

jobjectArray createObjectArray(JNIEnv* env, void* skarray, const char* type,
                               CreateObject createObject) {
  jlong size = SKIP_get_array_size(skarray);
  jclass clazz = env->FindClass(type);
  jobjectArray array = env->NewObjectArray(size, clazz, NULL);
  for (jlong i = 0; i < size; i++) {
    // Check if the element is An object Array
    if (type[0] == '[' && type[1] == 'L')
      env->SetObjectArrayElement(
          array, i,
          createObjectArray(env, SKIP_get_array_value_at(skarray, i), type + 1,
                            createObject));
    else
      env->SetObjectArrayElement(
          array, i, createObject(env, SKIP_get_array_value_at(skarray, i)));
  }
  return array;
}

jobject createLongArray(JNIEnv* env, void* skarray) {
  jlong size = SKIP_get_array_size(skarray);
  jlongArray array = env->NewLongArray(size);
  env->SetLongArrayRegion(array, 0, size,
                          reinterpret_cast<const jlong*>(skarray));
  return array;
}

jobject createIntArray(JNIEnv* env, void* skarray) {
  jlong size = SKIP_get_array_size(skarray);
  jintArray array = env->NewIntArray(size);
  env->SetIntArrayRegion(array, 0, size,
                         reinterpret_cast<const jint*>(skarray));
  return array;
}

jobject createShortArray(JNIEnv* env, void* skarray) {
  jlong size = SKIP_get_array_size(skarray);
  jshortArray array = env->NewShortArray(size);
  env->SetShortArrayRegion(array, 0, size,
                           reinterpret_cast<const jshort*>(skarray));
  return array;
}

jobject createByteArray(JNIEnv* env, void* skarray) {
  jlong size = SKIP_get_array_size(skarray);
  jbyteArray array = env->NewByteArray(size);
  env->SetByteArrayRegion(array, 0, size,
                          reinterpret_cast<const jbyte*>(skarray));
  return array;
}

jobject createDoubleArray(JNIEnv* env, void* skarray) {
  jlong size = SKIP_get_array_size(skarray);
  jdoubleArray array = env->NewDoubleArray(size);
  env->SetDoubleArrayRegion(array, 0, size,
                            reinterpret_cast<const jdouble*>(skarray));
  return array;
}

void* toObjectArray(JNIEnv* env, jobjectArray array, CheckObject checkObject) {
  jclass objectArrayClass = env->FindClass("[Ljava/lang/Object;");
  checkException(env);
  jsize size = env->GetArrayLength(array);
  void* vector = SKIP_create_vector();
  for (int i = 0; i < size; i++) {
    jobject element = env->GetObjectArrayElement(array, i);
    if (env->IsInstanceOf(element, objectArrayClass)) {
      SKIP_push_into_vector(
          vector, toObjectArray(env, (jobjectArray)element, checkObject));
    } else {
      SKIP_push_into_vector(vector, checkObject(env, element));
    }
    env->DeleteLocalRef(element);
  }
  return SKIP_vector_to_array(vector);
}

void clearObjectArray(JNIEnv* env, jobjectArray array) {
  jclass objectArrayClass = env->FindClass("[Ljava/lang/Object;");
  checkException(env);
  jsize size = env->GetArrayLength(array);
  for (int i = 0; i < size; i++) {
    jobject element = env->GetObjectArrayElement(array, i);
    if (env->IsInstanceOf(element, objectArrayClass)) {
      clearObjectArray(env, (jobjectArray)element);
    } else {
      clearPointers(env, element);
    }
    env->DeleteLocalRef(element);
  }
}

void* toStringArray(JNIEnv* env, jobjectArray array) {
  jclass objectArrayClass = env->FindClass("[Ljava/lang/String;");
  checkException(env);
  jsize size = env->GetArrayLength(array);
  void* vector = SKIP_create_vector();
  for (int i = 0; i < size; i++) {
    jobject element = env->GetObjectArrayElement(array, i);
    const char* cStr;
    if (env->IsInstanceOf(element, objectArrayClass)) {
      SKIP_push_into_vector(vector, toStringArray(env, (jobjectArray)element));
    } else {
      cStr = env->GetStringUTFChars((jstring)element, NULL);
      SKIP_push_into_vector(vector, sk_string_create(cStr, strlen(cStr)));
      env->ReleaseStringUTFChars((jstring)element, cStr);
    }
    env->DeleteLocalRef(element);
  }
  return SKIP_vector_to_array(vector);
}

void* toLongArray(JNIEnv* env, jlongArray array) {
  jsize size = env->GetArrayLength(array);
  jlong* skarray = SKIP_create_long_array((jlong)size);
  for (int i = 0; i < size; i++) {
    env->GetLongArrayRegion(array, 0, size, skarray);
  }
  return skarray;
}

void* toIntArray(JNIEnv* env, jintArray array) {
  jsize size = env->GetArrayLength(array);
  jint* skarray = SKIP_create_int_array((jlong)size);
  for (int i = 0; i < size; i++) {
    env->GetIntArrayRegion(array, 0, size, skarray);
  }
  return skarray;
}

void* toShortArray(JNIEnv* env, jshortArray array) {
  jsize size = env->GetArrayLength(array);
  jshort* skarray = SKIP_create_short_array((jlong)size);
  for (int i = 0; i < size; i++) {
    env->GetShortArrayRegion(array, 0, size, skarray);
  }
  return skarray;
}

void* toByteArray(JNIEnv* env, jbyteArray array) {
  jsize size = env->GetArrayLength(array);
  jbyte* skarray = SKIP_create_byte_array((jlong)size);
  for (int i = 0; i < size; i++) {
    env->GetByteArrayRegion(array, 0, size, skarray);
  }
  return skarray;
}

void* toBooleanArray(JNIEnv* env, jbooleanArray array) {
  jsize size = env->GetArrayLength(array);
  jboolean* skarray = SKIP_create_boolean_array((jlong)size);
  for (int i = 0; i < size; i++) {
    env->GetBooleanArrayRegion(array, 0, size, skarray);
  }
  return skarray;
}

jlong SKIP_A__getField1(void*);
void* SKIP_A__getField2(void*);
void* SKIP_create_A(jlong, void*);
void* copy_A(JNIEnv*, jobject);
void* check_A(JNIEnv*, jobject);
jobject create_A(JNIEnv*, void*);
jdouble SKIP_B__getField1(void*);
void* SKIP_create_B(jdouble);
void* copy_B(JNIEnv*, jobject);
void* check_B(JNIEnv*, jobject);
jobject create_B(JNIEnv*, void*);
void* SKIP_C__getField1(void*);
void* SKIP_create_C(void*);
void* copy_C(JNIEnv*, jobject);
void* check_C(JNIEnv*, jobject);
jobject create_C(JNIEnv*, void*);

void* check_A(JNIEnv* env, jobject object) {
  jclass clazz = env->FindClass("io/skiplabs/types/proxies/A");
  checkException(env);
  if (env->IsInstanceOf(object, clazz)) {
    return getPointer(env, object);
  } else {
    return copy_A(env, object);
  }
}

jobject create_A(JNIEnv* env, void* handle) {
  jclass clazz = env->FindClass("io/skiplabs/types/proxies/A");
  checkException(env);
  jmethodID constructor = env->GetMethodID(clazz, "<init>", "(J)V");
  checkException(env);
  jobject obj =
      env->NewObject(clazz, constructor, reinterpret_cast<jlong>(handle));
  checkException(env);
  return obj;
}

void* copy_A(JNIEnv* env, jobject object) {
  jclass clazz = env->GetObjectClass(object);
  jmethodID getField1 = env->GetMethodID(clazz, "getField1", "()J");
  checkException(env);
  jlong field1 = env->CallLongMethod(object, getField1);
  checkException(env);
  jmethodID getField2 =
      env->GetMethodID(clazz, "getField2", "()Lio/skiplabs/types/B;");
  checkException(env);
  jobject field2 = env->CallObjectMethod(object, getField2);
  checkException(env);
  return SKIP_create_A(field1, check_B(env, field2));
}

jobject Java_create_A(JNIEnv*, jlong field1, jobject field2) {
  void* skfield2 = check_B(env, field2);
  return create_A(env, SKIP_create_A(field1, skfield2));
}

jlong Java_A__getField1(JNIEnv* env, jobject object) {
  return SKIP_A__getField1(getPointer(env, object));
}

jobject Java_A__getField2(JNIEnv* env, jobject object) {
  return create_B(env, SKIP_A__getField2(getPointer(env, object)));
}

void* check_B(JNIEnv* env, jobject object) {
  jclass clazz = env->FindClass("io/skiplabs/types/proxies/B");
  checkException(env);
  if (env->IsInstanceOf(object, clazz)) {
    return getPointer(env, object);
  } else {
    return copy_B(env, object);
  }
}

jobject create_B(JNIEnv* env, void* handle) {
  jclass clazz = env->FindClass("io/skiplabs/types/proxies/B");
  checkException(env);
  jmethodID constructor = env->GetMethodID(clazz, "<init>", "(J)V");
  checkException(env);
  jobject obj =
      env->NewObject(clazz, constructor, reinterpret_cast<jlong>(handle));
  checkException(env);
  return obj;
}

void* copy_B(JNIEnv* env, jobject object) {
  jclass clazz = env->GetObjectClass(object);
  jmethodID getField1 = env->GetMethodID(clazz, "getField1", "()D");
  checkException(env);
  jdouble field1 = env->CallDoubleMethod(object, getField1);
  checkException(env);
  return SKIP_create_B(field1);
}

jobject Java_create_B(JNIEnv*, jdouble field1) {
  return create_B(env, SKIP_create_B(field1));
}

jdouble Java_B__getField1(JNIEnv* env, jobject object) {
  return SKIP_B__getField1(getPointer(env, object));
}

void* check_C(JNIEnv* env, jobject object) {
  jclass clazz = env->FindClass("io/skiplabs/types/proxies/C");
  checkException(env);
  if (env->IsInstanceOf(object, clazz)) {
    return getPointer(env, object);
  } else {
    return copy_C(env, object);
  }
}

jobject create_C(JNIEnv* env, void* handle) {
  jclass clazz = env->FindClass("io/skiplabs/types/proxies/C");
  checkException(env);
  jmethodID constructor = env->GetMethodID(clazz, "<init>", "(J)V");
  checkException(env);
  jobject obj =
      env->NewObject(clazz, constructor, reinterpret_cast<jlong>(handle));
  checkException(env);
  return obj;
}

void* copy_C(JNIEnv* env, jobject object) {
  jclass clazz = env->GetObjectClass(object);
  jmethodID getField1 =
      env->GetMethodID(clazz, "getField1", "()Lio/skiplabs/types/B;");
  checkException(env);
  jobject field1 = env->CallObjectMethod(object, getField1);
  checkException(env);
  return SKIP_create_C(check_B(env, field1));
}

jobject Java_create_C(JNIEnv*, jobject field1) {
  void* skfield1 = check_B(env, field1);
  return create_C(env, SKIP_create_C(skfield1));
}

jobject Java_C__getField1(JNIEnv* env, jobject object) {
  return create_B(env, SKIP_C__getField1(getPointer(env, object)));
}

void* SKIP_performSomething(void* a) {
  if (env == nullptr) {
    SKIP_throwJVMNotLoaded();
  }
  jclass clazz = env->FindClass("io/skiplabs/Library");
  checkException(env);
  jmethodID method =
      env->GetStaticMethodID(clazz, "performSomething",
                             "(Lio/skiplabs/types/A;)Lio/skiplabs/types/C;");
  checkException(env);
  jobject ja = create_A(env, a);
  jobject jrez = env->CallStaticObjectMethod(clazz, method, ja);
  checkException(env);
  void* skrez = check_C(env, jrez);
  clearPointers(env, ja);
  clearPointers(env, jrez);
  return skrez;
}

void* SKIP_performSomethingOnArray(void* array) {
  if (env == nullptr) {
    SKIP_throwJVMNotLoaded();
  }
  jclass clazz = env->FindClass("io/skiplabs/Library");
  checkException(env);
  jmethodID method =
      env->GetStaticMethodID(clazz, "performSomethingOnArray",
                             "([Lio/skiplabs/types/A;)[Lio/skiplabs/types/C;");
  checkException(env);
  jobjectArray jarray =
      createObjectArray(env, array, "Lio/skiplabs/types/A;", create_A);
  jobjectArray jrez =
      (jobjectArray)env->CallStaticObjectMethod(clazz, method, jarray);
  checkException(env);
  void* skrez = toObjectArray(env, jrez, check_C);
  clearObjectArray(env, jarray);
  clearObjectArray(env, jrez);
  return skrez;
}

void SKIP_loadJVM(const char* classpath, bool verboseClass, bool verbodeJNI) {
  if (vm != nullptr || env != nullptr) {
    SKIP_throwJVMAlreadyLoaded();
  }
  jint idx = 1;
  jint nb = idx + (verboseClass ? 1 : 0) + (verbodeJNI ? 1 : 0);
  JavaVMOption options[nb];
  JavaVMInitArgs vm_args;
  vm_args.version = JNI_VERSION_1_8;
  options[0].optionString = const_cast<char*>(classpath);
  if (verboseClass) {
    options[idx++].optionString = const_cast<char*>("-verbose:class");
  }
  if (verbodeJNI) {
    options[idx++].optionString = const_cast<char*>("-verbose:jni");
  }
  vm_args.options = options;
  vm_args.nOptions = nb;
  jint res = JNI_CreateJavaVM(&vm, (void**)&env, &vm_args);
  if (res != JNI_OK) {
    SKIP_throwUnableToLoadJVM();
  }
  jclass loaderClass = env->FindClass("io/skiplabs/SkLoader");
  checkException(env);
  jmethodID methodID =
      env->GetStaticMethodID(loaderClass, "load", "(Ljava/lang/String;)V");
  checkException(env);
  env->CallStaticVoidMethod(loaderClass, methodID,
                            env->NewStringUTF("skiplinks"));
  checkException(env);
  jclass clazz_io_skiplabs_types_proxies_A =
      env->FindClass("io/skiplabs/types/proxies/A");
  checkException(env);
  callStaticSetPointer(env, clazz_io_skiplabs_types_proxies_A, "setSkPtrNew",
                       reinterpret_cast<jlong>(Java_create_A));
  callStaticSetPointer(env, clazz_io_skiplabs_types_proxies_A,
                       "setSkPtrGetField1",
                       reinterpret_cast<jlong>(Java_A__getField1));
  callStaticSetPointer(env, clazz_io_skiplabs_types_proxies_A,
                       "setSkPtrGetField2",
                       reinterpret_cast<jlong>(Java_A__getField2));
  jclass clazz_io_skiplabs_types_proxies_B =
      env->FindClass("io/skiplabs/types/proxies/B");
  checkException(env);
  callStaticSetPointer(env, clazz_io_skiplabs_types_proxies_B, "setSkPtrNew",
                       reinterpret_cast<jlong>(Java_create_B));
  callStaticSetPointer(env, clazz_io_skiplabs_types_proxies_B,
                       "setSkPtrGetField1",
                       reinterpret_cast<jlong>(Java_B__getField1));
  jclass clazz_io_skiplabs_types_proxies_C =
      env->FindClass("io/skiplabs/types/proxies/C");
  checkException(env);
  callStaticSetPointer(env, clazz_io_skiplabs_types_proxies_C, "setSkPtrNew",
                       reinterpret_cast<jlong>(Java_create_C));
  callStaticSetPointer(env, clazz_io_skiplabs_types_proxies_C,
                       "setSkPtrGetField1",
                       reinterpret_cast<jlong>(Java_C__getField1));
}

}  // extern "C"
