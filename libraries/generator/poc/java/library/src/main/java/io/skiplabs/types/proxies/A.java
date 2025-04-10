package io.skiplabs.types.proxies;

public class A implements io.skiplabs.types.A {

    private B field2;
    private long skPtr;

    @SuppressWarnings("unused")
    private A(long skPtr) {
        this.skPtr = skPtr;
    }

    @Override
    public long getField1() {
        assert this.skPtr != 0L;
        return this.skPtrGetField1();
    }

    @Override
    public io.skiplabs.types.B getField2() {
        if (this.field2 == null) {
            assert this.skPtr != 0L;
            this.field2 = this.skPtrGetField2();
        }
        return this.field2;
    }

    public void skPtrClear() {
        if (this.field2 != null) {
            this.field2.skPtrClear();
        }
        this.skPtr = 0L;
    }

    private native long skPtrGetField1();

    private native B skPtrGetField2();

    public native static A newA(long field1, io.skiplabs.types.B field2);

    @SuppressWarnings("unused")
    private native static void setSkPtrNew(long newA);

    @SuppressWarnings("unused")
    private native static void setSkPtrGetField1(long skPtrGetField1);

    @SuppressWarnings("unused")
    private native static void setSkPtrGetField2(long skPtrGetField2);
}
