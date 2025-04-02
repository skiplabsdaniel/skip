package io.skiplabs.types;

public class C {
    private final CPointer pointer;
    private B field2;

    public C(CPointer pointer) {
        this.pointer = pointer;
    }

    public C(B b) {
        this(Pointers.createC(b));
    }

    public B getField1() {
        if (this.field2 == null) this.field2 = this.pointer.getField1();
        return this.field2;
    }

    public void clear() {
        this.field2.clear();
        this.pointer.clear();
    }
}
