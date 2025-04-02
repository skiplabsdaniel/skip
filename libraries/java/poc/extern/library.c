
#include <jni.h>

typedef jlong (*SKIP_A__getField1)(void*);
typedef void* (*Java_A__getField2)(JNIEnv*, void*);
typedef jdouble (*SKIP_B__getField1)(void*);
typedef jobject (*Java_createB)(JNIEnv*, jdouble);
typedef jobject (*Java_createC)(JNIEnv*, void*);

void* getBPointer(JNIEnv* env, jobject obj) {
  char* type;
  char* message;
  jclass clazz = (*env)->GetObjectClass(env, obj);
  jfieldID pfid =
      (*env)->GetFieldID(env, clazz, "pointer", "Lio/skiplabs/types/BPointer;");
  jobject pointer = (*env)->GetObjectField(env, obj, pfid);
  jclass pclazz = (*env)->FindClass(env, "io/skiplabs/types/BPointer");
  jfieldID hfid = (*env)->GetFieldID(env, pclazz, "handle", "J");
  jlong handle = (*env)->GetLongField(env, pointer, hfid);
  return (void*)handle;
}

/*
 * Class:     io_skiplabs_types_APointer
 * Method:    callField1
 * Signature: (JJ)J
 */
JNIEXPORT jlong JNICALL Java_io_skiplabs_types_APointer_callField1(
    JNIEnv* env, jobject thisObject, jlong handle, jlong function) {
  (void)env;
  (void)thisObject;
  //
  return ((SKIP_A__getField1)function)((void*)handle);
}

/*
 * Class:     io_skiplabs_types_APointer
 * Method:    callField2
 * Signature: (JJ)Lio/skiplabs/types/B;
 */
JNIEXPORT jobject JNICALL Java_io_skiplabs_types_APointer_callField2(
    JNIEnv* env, jobject thisObject, jlong handle, jlong function) {
  (void)env;
  (void)thisObject;
  //
  return ((Java_A__getField2)function)(env, (void*)handle);
}

/*
 * Class:     io_skiplabs_types_BPointer
 * Method:    callField1
 * Signature: (JJ)D
 */
JNIEXPORT jdouble JNICALL Java_io_skiplabs_types_BPointer_callField1(
    JNIEnv* env, jobject thisObject, jlong handle, jlong function) {
  return ((SKIP_B__getField1)function)((void*)handle);
}

/*
 * Class:     io_skiplabs_types_Pointers
 * Method:    callCreateB
 * Signature: (JD)Lio/skiplabs/types/BPointer;
 */
JNIEXPORT jobject JNICALL Java_io_skiplabs_types_Pointers_callCreateB(
    JNIEnv* env, jclass thisClass, jlong function, jdouble value) {
  return ((Java_createB)function)(env, value);
}

/*
 * Class:     io_skiplabs_types_Pointers
 * Method:    callCreateC
 * Signature: (JJ)Lio/skiplabs/types/CPointer;
 */
JNIEXPORT jobject JNICALL Java_io_skiplabs_types_Pointers_callCreateC(
    JNIEnv* env, jclass thisClass, jlong function, jobject b) {
  return ((Java_createC)function)(env, getBPointer(env, b));
}
