#include <jni.h>
#include <stdarg.h>
#include <string.h>

#include <sstream>

extern "C" {

int64_t SKIP_A__getField1(void* aObject);
void* SKIP_A__getField2(void* aObject);
double SKIP_B__getField1(void* bObject);
void* SKIP_createB(double field1);
void* SKIP_C__getField1(void* cObject);
void* SKIP_createC(void* bObject);
void* SKIP_createA(int64_t field1, void* field2);

char* sk_string_create(const char* buffer, uint32_t size);

__attribute__((noreturn)) void SKIP_throwUnableToLoadJVM();
__attribute__((noreturn)) void SKIP_throwLibraryException(char*, char*,
                                                          char* = nullptr);

jobject createA(JNIEnv* env, void* handle);
jobject createB(JNIEnv* env, void* handle);
jobject createC(JNIEnv* env, void* handle);

void* SKIP_createJVM(JavaVM* jvm, JNIEnv* env);
JNIEnv* SKIP_getJVMEnv(void* lib);

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
  env->CallObjectMethod(obj, clear);
}

jobject Java_A__getField2(JNIEnv* env, void* a) {
  return createB(env, SKIP_A__getField2(a));
}

jobject Java_createA(JNIEnv* env, jlong field1, void* field2) {
  return createA(env, SKIP_createA(field1, field2));
}

jobject Java_createB(JNIEnv* env, jdouble field1) {
  return createB(env, SKIP_createB(field1));
}

jobject Java_C__getField1(JNIEnv* env, void* c) {
  return createB(env, SKIP_C__getField1(c));
}

jobject Java_createC(JNIEnv* env, void* b) {
  printf("Java_createC %p\n", b);
  void* c = SKIP_createC(b);
  printf("Java_createC res %p\n", c);
  return createC(env, c);
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

bool checkException(JNIEnv* env, char** skclazzName, char** skmsg,
                    char** sktrace = nullptr) {
  if (env->ExceptionCheck()) {
    jthrowable exception = env->ExceptionOccurred();
    env->ExceptionClear();
    jclass throwableClass = env->FindClass("java/lang/Throwable");
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
    return true;
  }
  return false;
}

jobject createProxy(JNIEnv* env, const char* clazzName, const char* signature,
                    void* handle, ...) {
  char* type;
  char* message;
  jclass clazz = env->FindClass(clazzName);
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jmethodID constructor = env->GetMethodID(clazz, "<init>", signature);
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  va_list args;
  jobject obj;
  va_start(args, handle);
  obj = env->NewObject(clazz, constructor, args);
  va_end(args);
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  return obj;
}

jobject createA(JNIEnv* env, void* handle) {
  jclass clazz = env->FindClass("io/skiplabs/types/proxies/A");
  char* type;
  char* message;
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jmethodID constructor = env->GetMethodID(clazz, "<init>", "(JJJ)V");
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jobject obj =
      env->NewObject(clazz, constructor, reinterpret_cast<jlong>(handle),
                     reinterpret_cast<jlong>(&SKIP_A__getField1),
                     reinterpret_cast<jlong>(&Java_A__getField2));
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  return obj;
}

jobject createB(JNIEnv* env, void* handle) {
  jclass clazz = env->FindClass("io/skiplabs/types/proxies/B");
  char* type;
  char* message;
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jmethodID constructor = env->GetMethodID(clazz, "<init>", "(JJ)V");
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jobject obj =
      env->NewObject(clazz, constructor, reinterpret_cast<jlong>(handle),
                     reinterpret_cast<jlong>(&SKIP_B__getField1));
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  return obj;
}

jobject createC(JNIEnv* env, void* handle) {
  char* type;
  char* message;
  jclass clazz = env->FindClass("io/skiplabs/types/proxies/C");
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jmethodID constructor = env->GetMethodID(clazz, "<init>", "(JJ)V");
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jobject obj =
      env->NewObject(clazz, constructor, reinterpret_cast<jlong>(handle),
                     reinterpret_cast<jlong>(&Java_C__getField1));
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  return obj;
}

void* getPointer(JNIEnv* env, jobject obj) {
  char* type;
  char* message;
  jclass clazz = env->GetObjectClass(obj);
  jfieldID hfid = env->GetFieldID(clazz, "skPtrHandle", "J");
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jlong handle = env->GetLongField(obj, hfid);
  return (void*)handle;
}

void* SKIP_Library__performSomething(void* self, void* a) {
  JNIEnv* env = SKIP_getJVMEnv(self);
  jclass clazz = env->FindClass("io/skiplabs/Library");
  char* type;
  char* message;
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jmethodID method =
      env->GetStaticMethodID(clazz, "performSomething",
                             "(Lio/skiplabs/types/A;)Lio/skiplabs/types/C;");
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jobject jA = createA(env, a);
  jobject jC = (jobject)env->CallStaticObjectMethod(clazz, method, jA);
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  void* c = getPointer(env, jC);
  printf("SKIP_Library__performSomething res %p\n", c);
  clearPointers(env, jA);
  clearPointers(env, jC);
  return c;
}

void setLongStaticField(JNIEnv* env, const char* clazzName,
                        const char* fieldName, jlong value) {
  char* type;
  char* message;
  jclass clazz = env->FindClass(clazzName);
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jfieldID fieldID = env->GetStaticFieldID(clazz, fieldName, "J");
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  env->SetStaticIntField(clazz, fieldID, value);
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
}

void* SKIP_loadJVM_(const char* classpath, bool verboseClass, bool verbodeJNI) {
  JavaVM* vm;
  JNIEnv* env;
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
  const char* proxies = "io/skiplabs/types/proxies/SkPtrFactory";
  setLongStaticField(env, proxies, "newA",
                     reinterpret_cast<jlong>(&Java_createA));
  setLongStaticField(env, proxies, "newB",
                     reinterpret_cast<jlong>(&Java_createB));
  setLongStaticField(env, proxies, "newC",
                     reinterpret_cast<jlong>(&Java_createC));
  return SKIP_createJVM(vm, env);
}

void SKIP_destroyJVM(JavaVM* vm) {
  vm->DestroyJavaVM();
}

void SKIP_setBPointer(void* b, void** ptr) {
  *ptr = b;
}

void* SKIP_unsafe_cast(void* obj) {
  return obj;
}

}  // extern "C"
