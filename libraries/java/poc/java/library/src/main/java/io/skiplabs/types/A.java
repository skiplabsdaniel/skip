package io.skiplabs.types;


public class A {
    private final APointer pointer;
    private B field2;

    public A(APointer pointer) {
        this.pointer = pointer;
    }


    public long getField1() {
        return this.pointer.getField1();
    }

    public B getField2() {
        if (this.field2 == null) this.field2 = this.pointer.getField2();
        return this.field2;
    }

    public void clear() {
        this.field2.clear();
        this.pointer.clear();
    }
}
