target triple = "x86_64-pc-linux-gnu"

declare void @SKIP_print_last_exception_stack_trace_and_exit(ptr)
declare void @SKIP_throw(ptr)
declare void @SKIP_unreachableMethodCall(ptr, ptr)
declare void @SKIP_unreachableWithExplanation(ptr)
declare ptr @SKIP_intern(ptr)
declare ptr @SKIP_llvm_memcpy(ptr, ptr, i64)

; LLVM intrinsics

; Function Attrs: mustprogress nocallback nofree nosync nounwind willreturn memory(argmem: readwrite)
declare void @llvm.lifetime.start(i64 immarg, ptr nocapture)
; Function Attrs: mustprogress nocallback nofree nosync nounwind willreturn memory(argmem: readwrite)
declare void @llvm.lifetime.end(i64 immarg, ptr nocapture)

; Function Attrs: nounwind readnone
declare i32 @llvm.eh.typeid.for(ptr)

; Function Attrs: nounwind readnone
declare i64 @llvm.ctlz.i64(i64, i1)
; Function Attrs: nounwind readnone
declare i64 @llvm.cttz.i64(i64, i1)
; Function Attrs: nounwind readnone
declare i64 @llvm.ctpop.i64(i64)

declare i32 @__gxx_personality_v0(...)
declare ptr @__cxa_begin_catch(ptr)
declare void @__cxa_end_catch()

; Awaitable

define void @SKIP_awaitableNotifyWaitersValueIsReady(ptr) {
  ret void
}

define void @SKIP_awaitableSyncOrThrow(ptr) {
  ret void
}

define void @SKIP_awaitableThrow(ptr, ptr) {
  ret void
}

; Obstack

declare ptr @SKIP_Obstack_alloc(i64)
declare ptr @SKIP_Obstack_calloc(i64)
declare void @SKIP_Obstack_vectorUnsafeSet(ptr, ptr)
declare void @SKIP_Obstack_collect(ptr, ptr, i64)
declare ptr @SKIP_Obstack_shallowClone(i64, ptr)

; Function Attrs: alwaysinline nounwind uwtable
define void @SKIP_Obstack_inl_collect(ptr, ptr, i64) {
  ret void
}

; Function Attrs: alwaysinline nounwind uwtable
define ptr @SKIP_Obstack_note_inl() {
  ret ptr null
}

; Function Attrs: alwaysinline nounwind uwtable
define void @SKIP_Obstack_inl_collect0(ptr) {
  ret void
}

; Function Attrs: alwaysinline nounwind uwtable
define ptr @SKIP_Obstack_inl_collect1(ptr, ptr) {
  ret ptr %1
}

; Function Attrs: alwaysinline nounwind uwtable
define void @SKIP_Obstack_store(ptr %obj, ptr %val) {
  store ptr %val, ptr %obj
  ret void
}

; String

declare ptr @SKIP_String_concat2(ptr, ptr)
declare i64 @SKIP_String_cmp(ptr, ptr)
declare i64 @SKIP_String_hash(ptr)
declare ptr @SKIP_Float_toString(double)

; Function Attrs: noinline nounwind optnone
define i1 @SKIP_String_eq(ptr %0, ptr %1) {
  %3 = call i64 @SKIP_String_cmp(ptr %0, ptr %1)
  %4 = icmp eq i64 %3, 0
  ret i1 %4
}


; Exception

@_ZTIN4skip13SkipExceptionE = external constant { ptr, ptr, ptr }, align 8

declare void @SKIP_saveExn(ptr)

define void @SKIP_etry(ptr %f.0, ptr %onError.1) unnamed_addr uwtable personality ptr @__gxx_personality_v0 {
b0.entry:
  %r20 = getelementptr inbounds i8, ptr %f.0, i64 -8
  %r2 = load ptr, ptr %r20, align 8
  %r22 = getelementptr inbounds i8, ptr %r2, i64 0
  %r3 = load ptr, ptr %r22, align 8
  invoke void %r3(ptr %f.0) to label %b6.exit unwind label %b1.rawcatch_5
b1.rawcatch_5:
  %excpair.25 = landingpad { ptr, i32 }
          catch ptr @_ZTIN4skip13SkipExceptionE
  %caught_type_id.26 = extractvalue { ptr, i32 } %excpair.25, 1
  %expected_type_id.27 = tail call i32 @llvm.eh.typeid.for(ptr nonnull @_ZTIN4skip13SkipExceptionE) nounwind
  %eq_type_id.28 = icmp eq i32 %caught_type_id.26, %expected_type_id.27
  br i1 %eq_type_id.28, label %catch.29, label %no_catch.30
no_catch.30:
  resume { ptr, i32 } %excpair.25
catch.29:
  %r31 = extractvalue { ptr, i32 } %excpair.25, 0
  %cpp_exc.32 = tail call ptr @__cxa_begin_catch(ptr %r31) nounwind
  %exc_field_addr1.33 = getelementptr inbounds i8, ptr %cpp_exc.32, i64 8
  %r8 = load ptr, ptr %exc_field_addr1.33, align 8
  tail call void @__cxa_end_catch()
  br label %b2.record_exc_5
b2.record_exc_5:
  tail call void @SKIP_saveExn(ptr %r8)
  %r35 = getelementptr inbounds i8, ptr %onError.1, i64 -8
  %r6 = load ptr, ptr %r35, align 8
  %r37 = getelementptr inbounds i8, ptr %r6, i64 0
  %r9 = load ptr, ptr %r37, align 8
  tail call void %r9(ptr %onError.1)
  ret void
b6.exit:
  ret void
}
