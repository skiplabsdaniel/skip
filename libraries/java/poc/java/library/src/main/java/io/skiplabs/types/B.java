package io.skiplabs.types;


public class B {
    public final BPointer pointer;

    public B(BPointer pointer) {
        this.pointer = pointer;
    }

    public B(double field) {
        this(Pointers.createB(field));
    }

    public double getField1() {
        return this.pointer.getField1();
    }

    public void clear() {
        this.pointer.clear();
    }
}
