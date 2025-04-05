package io.skiplabs.types.proxies;

public class A implements io.skiplabs.types.A {

    private B field2;

    private long skPtrHandle;
    private long skPtrGetField1;
    private long skPtrGetField2;

    @SuppressWarnings("unused")
    private A(long skPtrHandle, long skPtrGetField1, long skPtrGetField2) {
        this.skPtrHandle = skPtrHandle;
        this.skPtrGetField1 = skPtrGetField1;
        this.skPtrGetField2 = skPtrGetField2;
    }

    @Override
    public long getField1() {
        assert this.skPtrHandle != 0L && this.skPtrGetField1 != 0L;
        return this.skPtrGetField1(this.skPtrHandle, this.skPtrGetField1);
    }

    @Override
    public io.skiplabs.types.B getField2() {
        if (this.field2 == null) {
            assert this.skPtrHandle != 0L && this.skPtrGetField2 != 0L;
            return this.field2 = this.skPtrGetField2(this.skPtrHandle, this.skPtrGetField2);
        }
        return this.field2;
    }

    public void skPtrClear() {
        if (this.field2 == null) {
            this.field2.skPtrClear();
        }
        this.skPtrHandle = 0L;
        this.skPtrGetField1 = 0L;
        this.skPtrGetField2 = 0L;
    }

    private native long skPtrGetField1(long handler, long function);

    private native B skPtrGetField2(long handler, long function);
}
