package io.skiplabs.types.proxies;

public class B implements io.skiplabs.types.B {

    private long skPtrHandle;
    private long skPtrGetField1;

    @SuppressWarnings("unused")
    private B(long skPtrHandle, long skPtrGetField1) {
        this.skPtrHandle = skPtrHandle;
        this.skPtrGetField1 = skPtrGetField1;
    }

    @Override
    public double getField1() {
        assert this.skPtrHandle != 0L && this.skPtrGetField1 != 0L;
        return this.skPtrGetField1(this.skPtrHandle, this.skPtrGetField1);
    }

    public void skPtrClear() {
        this.skPtrHandle = 0L;
        this.skPtrGetField1 = 0L;
    }

    private native double skPtrGetField1(long skPtrHandle, long skPtrGetField1);
}
