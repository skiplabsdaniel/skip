package io.skiplabs.types.proxies;

public class SkPtrFactory {

    static long newA = 0L;
    static long newB = 0L;
    static long newC = 0L;

    public static io.skiplabs.types.A newA(long field1, io.skiplabs.types.B field2) {
        assert newA != 0L;
        if (field2 != null && !(field2 instanceof io.skiplabs.types.proxies.B)) {
            field2 = newB(field2.getField1());
        }
        return callCreateA(newA, field1, field2);
    }

    public static io.skiplabs.types.B newB(double field1) {
        assert newB != 0L;
        return callCreateB(newB, field1);
    }

    public static io.skiplabs.types.C newC(io.skiplabs.types.B field1) {
        assert newC != 0L;
        if (field1 != null && !(field1 instanceof io.skiplabs.types.proxies.B)) {
            field1 = newB(field1.getField1());
        }
        return callCreateC(newC, field1);
    }

    private native static io.skiplabs.types.proxies.A callCreateA(long newA, long field1, io.skiplabs.types.B field2);

    private native static io.skiplabs.types.proxies.B callCreateB(long newB, double field1);

    private native static io.skiplabs.types.proxies.C callCreateC(long newC, io.skiplabs.types.B field1);
}
