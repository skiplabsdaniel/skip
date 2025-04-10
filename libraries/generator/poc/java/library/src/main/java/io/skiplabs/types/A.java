package io.skiplabs.types;

public interface A extends EObject {

    public static A newA(long field1, B field2) {
        return io.skiplabs.types.proxies.A.newA(field1, field2);
    }

    public long getField1();

    public B getField2();
}
