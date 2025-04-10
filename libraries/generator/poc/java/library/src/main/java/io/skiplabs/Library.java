package io.skiplabs;

import java.util.Arrays;

import io.skiplabs.types.A;
import io.skiplabs.types.B;
import io.skiplabs.types.C;

public class Library {

    public static C performSomething(A a) {
        long afield1 = a.getField1();
        System.out.println("Java => A.field1: " + afield1);
        B b = a.getField2();
        System.out.println("Java => A.field2: " + b);
        double bfield1 = b.getField1();
        System.out.println("Java => A.field2.field1: " + bfield1);
        B nb = B.newB(bfield1 + afield1);
        return C.newC(nb);
    }

    public static C[] performSomethingOnArray(A[] values) {
        return Arrays.stream(values).map(Library::performSomething).toArray(C[]::new);
    }
}
