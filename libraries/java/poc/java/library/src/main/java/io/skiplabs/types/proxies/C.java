package io.skiplabs.types.proxies;

public class C implements io.skiplabs.types.C {

    private B field2;

    private long skPtrHandle;
    private long skPtrGetField1;

    @SuppressWarnings("unused")
    private C(long skPtrHandle, long skPtrGetField1) {
        this.skPtrHandle = skPtrHandle;
        this.skPtrGetField1 = skPtrGetField1;
    }

    @Override
    public B getField1() {
        if (this.field2 == null) {
            assert this.skPtrHandle != 0 && this.skPtrGetField1 != 0;
            return skPtrGetField1(this.skPtrHandle, this.skPtrGetField1);
        }
        return this.field2;
    }

    public void skPtrClear() {
        if (this.field2 == null) {
            this.field2.skPtrClear();
        }
        this.skPtrHandle = 0L;
        this.skPtrGetField1 = 0L;
    }

    private native B skPtrGetField1(long skPtrHandle, long skPtrGetField1);
}
