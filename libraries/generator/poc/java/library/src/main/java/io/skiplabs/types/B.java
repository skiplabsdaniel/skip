package io.skiplabs.types;

public interface B extends EObject {

    public static B newB(double field1) {
        return io.skiplabs.types.proxies.B.newB(field1);
    }

    public double getField1();
}
