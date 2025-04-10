package io.skiplabs.types.proxies;

public class B implements io.skiplabs.types.B {

    private long skPtr;

    @SuppressWarnings("unused")
    private B(long skPtr) {
        this.skPtr = skPtr;
    }

    @Override
    public double getField1() {
        assert this.skPtr != 0L;
        return this.skPtrGetField1(this.skPtr);
    }

    public void skPtrClear() {
        this.skPtr = 0L;
    }

    public native static B newB(double field1);

    private native double skPtrGetField1(long skPtr);

    @SuppressWarnings("unused")
    private native static void setSkPtrNew(long newB);

    @SuppressWarnings("unused")
    private native static void setSkPtrGetField1(long skPtrGetField1);
}
