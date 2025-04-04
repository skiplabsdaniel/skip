#include <jni.h>
#include <string.h>

#include <sstream>

extern "C" {

int64_t SKIP_A__getField1(void* aObject);
void* SKIP_A__getField2(void* aObject);
double SKIP_B__getField1(void* bObject);
void* SKIP_createB(double field1);
void* SKIP_C__getField1(void* cObject);
void* SKIP_createC(void* bObject);

char* sk_string_create(const char* buffer, uint32_t size);

__attribute__((noreturn)) void SKIP_throwUnableToLoadJVM();
__attribute__((noreturn)) void SKIP_throwLibraryException(char*, char*,
                                                          char* = nullptr);

jobject createBPointer(JNIEnv* env, void* handle);
jobject createCPointer(JNIEnv* env, void* handle);

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
  jmethodID clear = env->GetMethodID(clazz, "clear", "()V");
  env->CallObjectMethod(obj, clear);
}

jobject Java_A__getField2(JNIEnv* env, void* a) {
  return createBPointer(env, SKIP_A__getField2(a));
}

jobject Java_createB(JNIEnv* env, jdouble field1) {
  return createBPointer(env, SKIP_createB(field1));
}

jobject Java_C__getField1(JNIEnv* env, void* c) {
  return createBPointer(env, SKIP_C__getField1(c));
}

jobject Java_createC(JNIEnv* env, void* b) {
  return createCPointer(env, SKIP_createC(b));
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

jobject createAPointer(JNIEnv* env, void* handle) {
  jclass clazz = env->FindClass("io/skiplabs/types/APointer");
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

jobject createBPointer(JNIEnv* env, void* handle) {
  jclass clazz = env->FindClass("io/skiplabs/types/BPointer");
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

jobject createCPointer(JNIEnv* env, void* handle) {
  jclass clazz = env->FindClass("io/skiplabs/types/CPointer");
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
                     reinterpret_cast<jlong>(&Java_C__getField1));
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  return obj;
}

void* getCPointer(JNIEnv* env, jobject obj) {
  char* type;
  char* message;
  jclass clazz = env->GetObjectClass(obj);
  jfieldID pfid =
      env->GetFieldID(clazz, "pointer", "Lio/skiplabs/types/CPointer;");
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jobject pointer = env->GetObjectField(obj, pfid);
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }

  jclass pclazz = env->FindClass("io/skiplabs/types/CPointer");
  jfieldID hfid = env->GetFieldID(pclazz, "handle", "J");
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jlong handle = env->GetLongField(pointer, hfid);
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  return reinterpret_cast<void*>(handle);
}

jobject createA(JNIEnv* env, jobject pointer) {
  jclass clazz = env->FindClass("io/skiplabs/types/A");
  char* type;
  char* message;
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jmethodID constructor =
      env->GetMethodID(clazz, "<init>", "(Lio/skiplabs/types/APointer;)V");
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  jobject obj = env->NewObject(clazz, constructor, pointer);
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  return obj;
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
  jobject jA = createA(env, createAPointer(env, a));
  jobject jC = (jobject)env->CallStaticObjectMethod(clazz, method, jA);
  if (checkException(env, &type, &message)) {
    SKIP_throwLibraryException(type, message);
  }
  void* c = getCPointer(env, jC);
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
  setLongStaticField(env, "io/skiplabs/types/Pointers", "createB",
                     reinterpret_cast<jlong>(&Java_createB));
  setLongStaticField(env, "io/skiplabs/types/Pointers", "createC",
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
