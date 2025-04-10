package io.skiplabs.types.proxies;

public class C implements io.skiplabs.types.C {

    private B field2;

    private long skPtr;

    @SuppressWarnings("unused")
    private C(long skPtr) {
        this.skPtr = skPtr;
    }

    @Override
    public B getField1() {
        if (this.field2 == null) {
            assert this.skPtr != 0;
            this.field2 = skPtrGetField1();
        }
        return this.field2;
    }

    public void skPtrClear() {
        if (this.field2 != null) {
            this.field2.skPtrClear();
        }
        this.skPtr = 0L;
    }

    public native static C newC(io.skiplabs.types.B field1);

    private native B skPtrGetField1();

    @SuppressWarnings("unused")
    private native static void setSkPtrNew(long newC);

    @SuppressWarnings("unused")
    private native static void setSkPtrGetField1(long skPtrGetField1);
}
