package io.skiplabs.types;

public interface C extends EObject {

    public static C newC(B field1) {
        return io.skiplabs.types.proxies.C.newC(field1);
    }

    public B getField1();
}
